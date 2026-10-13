"""Proses mesin suara Kira (anak proses dari server.py).

Model dimuat di proses terpisah ini, bukan di server HTTP. Saat tidak dipakai lama, server mematikan
proses ini, sehingga seluruh memori GPU (termasuk konteks CUDA) benar-benar kembali ke sistem.
Satu model dimuat pada satu waktu (VoiceDesign atau CustomVoice); ganti gaya ke model lain
membongkar model lama dulu.

Pesan ke mesin (lewat Pipe): dict {style, segments, seed, device, minFreeMiB, cpuDtype} atau None untuk berhenti.
Jawaban: {ok: True, pcm: bytes float32 mono, sr, ms, voice, device} atau {ok: False, error, detail}.
Kode error: gpu_oom, no_gpu, failed.
"""

from __future__ import annotations

import gc
import json
import os
import sys
import time
from typing import Any

STYLES_PATH = os.environ.get("TTS_STYLES_PATH", os.path.join(os.path.dirname(__file__), "styles.json"))


def load_styles() -> dict[str, Any]:
    with open(STYLES_PATH, encoding="utf-8") as f:
        return json.load(f)


def log(msg: str) -> None:
    print(f"[engine] {msg}", flush=True)


def local_model_path(repo: str) -> str:
    """Folder model di volume /models. Dibaca langsung supaya tidak ada panggilan ke huggingface.co (layanan tanpa internet)."""
    from huggingface_hub import snapshot_download

    try:
        return snapshot_download(repo_id=repo, local_files_only=True)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError(f"Model {repo} belum diunduh. Jalankan: docker compose --profile tts-setup run --rm tts-fetch") from e


def is_oom(e: BaseException) -> bool:
    name = type(e).__name__
    return name == "OutOfMemoryError" or "out of memory" in str(e).lower()


def group_by_kind(segments: list[dict[str, str]]) -> list[tuple[str, str]]:
    """Gabungkan kalimat berurutan dengan golongan sama menjadi satu panggilan (suara lebih konsisten)."""
    groups: list[tuple[str, str]] = []
    for seg in segments:
        kind = seg.get("kind", "statement")
        if groups and groups[-1][0] == kind:
            groups[-1] = (kind, groups[-1][1] + " " + seg["text"])
        else:
            groups.append((kind, seg["text"]))
    return groups


def voice_instruct(style: dict[str, Any], voice: dict[str, Any], kind: str) -> str:
    tone = style["tone"].get(kind) or style["tone"]["statement"]
    # Suara rancangan: deskripsi suara ditambah nada. Suara bawaan: nada saja.
    return f"{voice['design']} {tone}" if "design" in voice else tone


def engine_main(conn: Any) -> None:
    import numpy as np
    import torch
    from qwen_tts import Qwen3TTSModel

    styles = load_styles()
    language = styles.get("language", "English")
    loaded_kind: str | None = None
    loaded_device: str | None = None
    model: Any = None

    def unload() -> None:
        nonlocal model, loaded_kind, loaded_device
        model = None
        loaded_kind = None
        loaded_device = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    log("mesin mulai")
    while True:
        try:
            req = conn.recv()
        except EOFError:
            return
        if req is None:
            return
        started = time.monotonic()
        try:
            style_id = req["style"]
            style = styles["styles"][style_id]
            kind = style["model"]
            pref = req.get("device", "auto")
            if pref == "cpu" or not torch.cuda.is_available():
                if pref == "cuda":
                    conn.send({"ok": False, "error": "no_gpu", "detail": "GPU NVIDIA tidak terlihat oleh kontainer."})
                    return
                device = "cpu"
            else:
                device = "cuda:0"

            if model is None or loaded_kind != kind or loaded_device != device:
                unload()
                if device != "cpu":
                    # Pemeriksaan memori kosong dilakukan server.py lewat NVML sebelum proses ini dibuat.
                    dtype = torch.bfloat16
                else:
                    dtype = torch.bfloat16 if req.get("cpuDtype") == "bfloat16" else torch.float32
                t0 = time.monotonic()
                log(f"memuat {styles['models'][kind]} di {device} ({str(dtype).replace('torch.', '')})")
                model = Qwen3TTSModel.from_pretrained(local_model_path(styles["models"][kind]), device_map=device, dtype=dtype)
                loaded_kind, loaded_device = kind, device
                log(f"model siap dalam {time.monotonic() - t0:.1f} detik")

            voices = style["voices"]
            voice = voices[int(req.get("seed", 0)) % len(voices)]
            sr = 24000
            parts: list[Any] = []
            gap_ms = int(style.get("gapMs", 300))
            seed = int(req.get("seed", 0))
            for i, (seg_kind, text) in enumerate(group_by_kind(req["segments"])):
                torch.manual_seed(seed + i)
                instruct = voice_instruct(style, voice, seg_kind)
                if kind == "design":
                    wavs, sr = model.generate_voice_design(text=text, language=language, instruct=instruct)
                else:
                    wavs, sr = model.generate_custom_voice(text=text, language=language, speaker=voice["speaker"], instruct=instruct)
                parts.append(np.asarray(wavs[0], dtype=np.float32).reshape(-1))
                parts.append(np.zeros(int(sr * gap_ms / 1000), dtype=np.float32))
            audio = np.concatenate(parts[:-1]) if len(parts) > 1 else parts[0]
            peak = float(np.max(np.abs(audio))) if audio.size else 0.0
            if peak > 0:
                audio = audio * (0.89 / peak)
            conn.send({
                "ok": True,
                "pcm": audio.astype(np.float32).tobytes(),
                "sr": int(sr),
                "ms": int((time.monotonic() - started) * 1000),
                "voice": voice.get("speaker") or voice.get("design", "")[:60],
                "device": device,
            })
        except Exception as e:  # noqa: BLE001 - semua kegagalan dilaporkan ke server
            if is_oom(e):
                conn.send({"ok": False, "error": "gpu_oom", "detail": str(e)[:300]})
                return
            log(f"gagal: {type(e).__name__}: {e}")
            conn.send({"ok": False, "error": "failed", "detail": f"{type(e).__name__}: {e}"[:300]})


if __name__ == "__main__":
    print("engine.py dijalankan lewat server.py", file=sys.stderr)
