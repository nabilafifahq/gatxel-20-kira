"""Proses mesin suara Kira (anak proses dari server.py), memakai Kokoro-82M (Apache-2.0).

Model dimuat di proses terpisah ini, bukan di server HTTP. Saat tidak dipakai lama, server mematikan proses ini,
sehingga seluruh memori GPU (termasuk konteks CUDA) benar-benar kembali ke sistem.

Aturan suara: tiap peran punya SATU suara tetap (styles.json). Tidak ada rotasi suara, tidak ada suara baru per kalimat,
dan tidak ada benih acak: Kokoro deterministik, jadi teks yang sama selalu menghasilkan audio yang sama.
Satu klip = satu suara dari awal sampai akhir.

Pesan ke mesin (lewat Pipe): dict {clips: [{style, segments}], device} atau None untuk berhenti.
Jawaban: {ok: True, results: [{ok, pcm (float32 mono bytes), sr, ms, voice}], device, ms} atau {ok: False, error, detail}.
Kode error: gpu_oom, no_gpu, failed.
"""

from __future__ import annotations

import gc
import json
import os
import sys
import time
from typing import Any

from textprep import prepare_text

STYLES_PATH = os.environ.get("TTS_STYLES_PATH", os.path.join(os.path.dirname(__file__), "styles.json"))
SR = 24000
TARGET_RMS = 0.085  # sekitar -21 dBFS: kenyaringan sama antar klip
PEAK_LIMIT = 0.89


def load_styles() -> dict[str, Any]:
    with open(STYLES_PATH, encoding="utf-8") as f:
        return json.load(f)


def log(msg: str) -> None:
    print(f"[engine] {msg}", flush=True)


def is_oom(e: BaseException) -> bool:
    name = type(e).__name__
    return name == "OutOfMemoryError" or "out of memory" in str(e).lower()


def normalise_audio(audio: Any) -> Any:
    import numpy as np

    if audio.size == 0:
        return audio
    rms = float(np.sqrt(np.mean(np.square(audio))))
    gain = TARGET_RMS / rms if rms > 1e-6 else 1.0
    peak = float(np.max(np.abs(audio))) * gain
    if peak > PEAK_LIMIT:
        gain *= PEAK_LIMIT / peak
    return audio * gain


class Synth:
    """Pembungkus Kokoro. Satu KPipeline bahasa Inggris Britania; suara dimuat sekali dan disimpan."""

    def __init__(self, styles: dict[str, Any], device: str) -> None:
        import torch
        from kokoro import KModel, KPipeline

        repo = styles["models"]["kokoro"]
        self.styles = styles["styles"]
        self.torch = torch
        t0 = time.monotonic()
        model = KModel(repo_id=repo).to(device).eval()
        self.pipeline = KPipeline(lang_code=styles.get("language", "b"), repo_id=repo, model=model)
        self.voices = {v for v in (s["voice"] for s in self.styles.values())}
        for v in self.voices:
            self.pipeline.load_voice(v)
        log(f"model siap di {device} dalam {time.monotonic() - t0:.1f} detik")

    def one(self, style_id: str, segments: list[dict[str, str]], variant: int = 0) -> tuple[Any, str]:
        """Satu klip = satu suara. variant 0 = normal; 1 dan 2 dipakai pemeriksa mutu untuk membuat ulang klip yang gagal
        (kecepatan sedikit berbeda, karena teks yang sama pada kecepatan yang sama selalu menghasilkan audio yang sama)."""
        import numpy as np

        style = self.styles[style_id]
        voice, speed = style["voice"], float(style.get("speed", 1.0)) * (1.0, 0.95, 1.05)[variant]
        gap = np.zeros(int(SR * int(style.get("gapMs", 300)) / 1000), dtype=np.float32)
        parts: list[Any] = []
        for seg in segments:
            text = prepare_text(seg["text"])
            chunks = []
            with self.torch.inference_mode():
                for res in self.pipeline(text, voice=voice, speed=speed, split_pattern=None):
                    if res.audio is not None:
                        chunks.append(res.audio.detach().cpu().numpy().astype(np.float32).reshape(-1))
            if not chunks:
                raise RuntimeError("tidak ada audio untuk: " + text[:40])
            parts.append(np.concatenate(chunks))
            parts.append(gap)
        audio = np.concatenate(parts[:-1]) if len(parts) > 1 else parts[0]
        return normalise_audio(audio), voice


def remote_main(conn: Any) -> None:
    """Mesin untuk TTS_BACKEND=openai-compatible: tanpa torch dan GPU, hanya permintaan HTTP ke backend."""
    from remote import RemoteSynth

    synth = RemoteSynth(load_styles())
    log("mesin jarak jauh mulai")
    while True:
        try:
            req = conn.recv()
        except EOFError:
            return
        if req is None:
            return
        started = time.monotonic()
        results: list[dict[str, Any]] = []
        for clip in req["clips"]:
            t0 = time.monotonic()
            try:
                audio, voice = synth.one(clip["style"], clip["segments"], int(clip.get("variant", 0)))
                results.append({"ok": True, "pcm": audio.astype("float32").tobytes(), "sr": SR, "ms": int((time.monotonic() - t0) * 1000), "voice": voice})
            except Exception as e:  # noqa: BLE001
                results.append({"ok": False, "error": "failed", "detail": str(e)[:300]})
        conn.send({"ok": True, "results": results, "device": "remote", "ms": int((time.monotonic() - started) * 1000)})


def engine_main(conn: Any) -> None:
    if os.environ.get("TTS_BACKEND", "kokoro") == "openai-compatible":
        remote_main(conn)
        return
    import torch
    # Beberapa proses mesin berjalan sejajar: batasi utas CPU tiap proses supaya tidak saling berebut.
    torch.set_num_threads(int(os.environ.get("TTS_TORCH_THREADS", "2")))

    styles = load_styles()
    synth: Synth | None = None
    loaded_device: str | None = None
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
            pref = req.get("device", "auto")
            if pref == "cpu" or not torch.cuda.is_available():
                if pref == "cuda":
                    conn.send({"ok": False, "error": "no_gpu", "detail": "GPU NVIDIA tidak terlihat oleh kontainer."})
                    return
                device = "cpu"
            else:
                device = "cuda:0"
            if synth is None or loaded_device != device:
                synth = None
                gc.collect()
                synth = Synth(styles, device)
                loaded_device = device
            results: list[dict[str, Any]] = []
            for clip in req["clips"]:
                t0 = time.monotonic()
                try:
                    audio, voice = synth.one(clip["style"], clip["segments"], int(clip.get("variant", 0)))
                    results.append({"ok": True, "pcm": audio.astype("float32").tobytes(), "sr": SR, "ms": int((time.monotonic() - t0) * 1000), "voice": voice})
                except Exception as e:  # noqa: BLE001 - satu klip gagal tidak membatalkan yang lain
                    if is_oom(e):
                        raise
                    results.append({"ok": False, "error": "failed", "detail": f"{type(e).__name__}: {e}"[:200]})
            conn.send({"ok": True, "results": results, "device": device, "ms": int((time.monotonic() - started) * 1000)})
        except Exception as e:  # noqa: BLE001
            if is_oom(e):
                conn.send({"ok": False, "error": "gpu_oom", "detail": str(e)[:300]})
                return
            log(f"gagal: {type(e).__name__}: {e}")
            conn.send({"ok": False, "error": "failed", "detail": f"{type(e).__name__}: {e}"[:300]})


if __name__ == "__main__":
    print("engine.py dijalankan lewat server.py", file=sys.stderr)
