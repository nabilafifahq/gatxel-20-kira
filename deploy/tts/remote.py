"""Mesin suara jarak jauh yang kompatibel dengan OpenAI (`POST <base>/audio/speech`), misalnya Open WebUI.

Dipilih dengan TTS_BACKEND=openai-compatible. Tanpa torch dan tanpa GPU di kontainer ini.

  TTS_BASE_URL   alamat sampai awalan API, mis. http://host.docker.internal:3000/api/v1   (dari kontainer, 127.0.0.1 host
                 TIDAK terlihat: pakai host.docker.internal)
  TTS_API_KEY    token Bearer (tidak pernah dicatat di log)
  TTS_MODEL      nama model (bawaan: tts-1)
  TTS_VOICE      nama suara utama
  TTS_VOICE_SECOND  suara kedua untuk dialog dua pembicara (opsional; kosong = pakai suara utama)
  TTS_VOICE_VERSION versi suara untuk kunci klip (bawaan diturunkan dari backend dan nama suara)

Satu klip = satu suara dari awal sampai akhir: tiap kalimat memakai nama suara yang sama.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import urllib.error
import urllib.request
from typing import Any

SR = 24000


def backend() -> str:
    b = os.environ.get("TTS_BACKEND", "kokoro").strip().lower()
    if b not in ("kokoro", "openai-compatible", "piper"):
        raise SystemExit(f"TTS_BACKEND tidak dikenal: {b} (kokoro, openai-compatible, atau piper)")
    return b


def sanitize(v: str) -> str:
    return re.sub(r"[^a-z0-9._-]+", "-", v.lower()).strip("-")[:28] or "x"


def voice_version(styles: dict[str, Any]) -> str:
    """Versi suara yang masuk ke kunci klip. Kokoro: dari styles.json. Jarak jauh: TTS_VOICE_VERSION atau oa-<suara>."""
    explicit = os.environ.get("TTS_VOICE_VERSION", "").strip()
    if explicit:
        return sanitize(explicit)
    if backend() == "kokoro":
        return str(styles.get("voiceVersion", "k1"))
    if backend() == "piper":
        return "piper-" + sanitize(os.environ.get("TTS_VOICE_NAME", "lessac-medium"))
    return "oa-" + sanitize(os.environ.get("TTS_VOICE", "default"))


class RemoteSynth:
    def __init__(self, styles: dict[str, Any]) -> None:
        self.styles = styles["styles"]
        self.base = os.environ.get("TTS_BASE_URL", "").rstrip("/")
        self.key = os.environ.get("TTS_API_KEY", "")
        self.model = os.environ.get("TTS_MODEL", "tts-1")
        self.voice = os.environ.get("TTS_VOICE", "")
        self.voice2 = os.environ.get("TTS_VOICE_SECOND", "") or self.voice
        if not self.base or not self.voice:
            raise RuntimeError("TTS_BASE_URL dan TTS_VOICE wajib diisi untuk TTS_BACKEND=openai-compatible")
        self.pause = float(os.environ.get("TTS_REQUEST_PAUSE", "0"))  # jeda antar permintaan, supaya layanan bersama tidak jenuh

    def _speak(self, text: str, voice: str, speed: float) -> Any:
        import numpy as np
        import time

        if self.pause:
            time.sleep(self.pause)

        body = json.dumps({"model": self.model, "input": text, "voice": voice, "speed": speed, "response_format": "mp3"}).encode()
        headers = {"Content-Type": "application/json"}
        if self.key:
            headers["Authorization"] = "Bearer " + self.key
        req = urllib.request.Request(self.base + "/audio/speech", data=body, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"backend suara menjawab {e.code}") from None
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            raise RuntimeError(
                f"backend suara tidak terjangkau di {self.base} ({getattr(e, 'reason', e)}). "
                "Dari kontainer, alamat host adalah host.docker.internal, bukan 127.0.0.1."
            ) from None
        p = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
            input=data, capture_output=True, check=False, timeout=60,
        )
        if p.returncode != 0 or not p.stdout:
            raise RuntimeError("audio dari backend tidak terbaca")
        return np.frombuffer(p.stdout, dtype=np.float32).copy()

    def one(self, style_id: str, segments: list[dict[str, str]], variant: int = 0) -> tuple[Any, str]:
        import numpy as np

        from engine import normalise_audio
        from textprep import prepare_text

        style = self.styles[style_id]
        # Bahasa menentukan suara, bukan dugaan: peran "indonesian" memakai suara Indonesia (TTS_VOICE_ID); semua peran lain,
        # termasuk dialog, memakai suara Inggris. Teks Inggris TIDAK PERNAH dibacakan suara Indonesia (tak terbaca).
        if style_id == "indonesian":
            voice = os.environ.get("TTS_VOICE_ID", "") or "id"
        else:
            voice = self.voice2 if style_id == "second" else self.voice
        speed = float(style.get("piperSpeed", style.get("speed", 1.0))) * (1.0, 0.95, 1.05)[variant]
        gap = np.zeros(int(SR * int(style.get("gapMs", 300)) / 1000), dtype=np.float32)
        parts: list[Any] = []
        for seg in segments:
            parts.append(self._speak(prepare_text(seg["text"]), voice, speed))
            parts.append(gap)
        audio = np.concatenate(parts[:-1]) if len(parts) > 1 else parts[0]
        return normalise_audio(audio), voice


class PiperSynth:
    """Piper lokal (CPU, ONNX): model publik yang sama dengan server suara Gatxel (en_US-lessac-medium) dan parameter yang sama.

    Satu utas per proses; kecepatan datang dari banyak proses (TTS_WORKERS). Peran "indonesian" tidak dibuat di sini
    (model Indonesia hanya lewat API Gatxel): bila TTS_BASE_URL diisi, diteruskan ke sana, kalau tidak galat jelas.
    """

    def __init__(self, styles: dict[str, Any]) -> None:
        import glob

        from pathlib import Path

        import onnxruntime
        from piper import PiperVoice
        from piper.config import PiperConfig
        from piper.voice import ESPEAK_DATA_DIR

        self.styles = styles["styles"]
        model = os.environ.get("TTS_PIPER_MODEL", "")
        if not model:
            hits = glob.glob("/models/hub/models--rhasspy--piper-voices/snapshots/*/en/en_US/lessac/medium/en_US-lessac-medium.onnx")
            model = hits[0] if hits else ""
        if not model or not os.path.exists(model):
            raise RuntimeError("Model Piper belum diunduh. Jalankan: python fetch_models.py piper")
        with open(model + ".json", encoding="utf-8") as f:
            config = PiperConfig.from_dict(json.load(f))
        opts = onnxruntime.SessionOptions()
        opts.intra_op_num_threads = int(os.environ.get("TTS_ORT_THREADS", "1"))
        opts.inter_op_num_threads = 1
        session = onnxruntime.InferenceSession(model, sess_options=opts, providers=["CPUExecutionProvider"])
        self.voice = PiperVoice(config=config, session=session, espeak_data_dir=Path(ESPEAK_DATA_DIR), download_dir=Path("/tmp"))
        self.sr = config.sample_rate
        self.remote: RemoteSynth | None = RemoteSynth(styles) if os.environ.get("TTS_BASE_URL") and os.environ.get("TTS_VOICE") else None

    def one(self, style_id: str, segments: list[dict[str, str]], variant: int = 0) -> tuple[Any, str]:
        import numpy as np
        from piper import SynthesisConfig
        from scipy.signal import resample_poly

        from engine import normalise_audio
        from textprep import prepare_text

        if style_id == "indonesian":
            if self.remote is None:
                raise RuntimeError("Suara Indonesia hanya lewat API Gatxel: isi TTS_BASE_URL, TTS_API_KEY, TTS_VOICE_ID")
            return self.remote.one(style_id, segments, variant)
        style = self.styles[style_id]
        speed = float(style.get("piperSpeed", style.get("speed", 1.0))) * (1.0, 0.95, 1.05)[variant]
        cfg = SynthesisConfig(length_scale=1.0 / speed)
        gap = np.zeros(int(SR * int(style.get("gapMs", 300)) / 1000), dtype=np.float32)
        parts: list[Any] = []
        for seg in segments:
            chunks = [c.audio_float_array for c in self.voice.synthesize(prepare_text(seg["text"]), syn_config=cfg)]
            if not chunks:
                raise RuntimeError("tidak ada audio untuk: " + seg["text"][:40])
            a = np.concatenate(chunks).astype(np.float32)
            parts.append(resample_poly(a, 160, 147).astype(np.float32) if self.sr == 22050 else a)
            parts.append(gap)
        audio = np.concatenate(parts[:-1]) if len(parts) > 1 else parts[0]
        return normalise_audio(audio), "lessac-medium"
