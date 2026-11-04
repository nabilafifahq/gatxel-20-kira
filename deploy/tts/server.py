"""Layanan suara Kira (Kokoro-82M). API HTTP kecil di jaringan internal Docker, tanpa port ke host.

  GET  /health      status tanpa memuat model
  POST /synthesize  {"style": "teacher", "segments": [{"text": "...", "kind": "question"}], "format": "mp3"}
                    -> audio (audio/mpeg atau audio/wav). Header Authorization: Bearer KIRA_INTERNAL_TOKEN.
  POST /batch       {"clips": [{"style": "teacher", "segments": [...]}, ...]}  (sampai 64 klip)
                    -> JSON {"results": [{"ok": true, "mp3": "<base64>", "ms": 120} | {"ok": false, "error": "..."}]}
                    Klip dibagi ke beberapa proses mesin (TTS_WORKERS) dan dikerjakan sejajar.

Tiap peran punya satu suara tetap (styles.json); tidak ada rotasi atau benih. Model dimuat malas saat permintaan pertama,
di proses anak (engine.py). Setelah TTS_IDLE_SECONDS tanpa permintaan (default 600) proses anak dimatikan sehingga
memori GPU kembali penuh. Kode galat:
  503 gpu_oom   GPU tidak punya cukup memori kosong (misalnya dipakai program lain); klien mencoba lagi nanti
  503 no_gpu    TTS_DEVICE=cuda tetapi kontainer tidak melihat GPU
  500 failed    kegagalan lain
"""

from __future__ import annotations

import base64
import hmac
import io
import queue
from concurrent.futures import ThreadPoolExecutor
import json
import multiprocessing as mp
import os
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import engine
import gpu

PORT = int(os.environ.get("TTS_PORT", "8000"))
TOKEN = os.environ.get("KIRA_INTERNAL_TOKEN", "")
IDLE_SECONDS = int(os.environ.get("TTS_IDLE_SECONDS", "600"))
DEVICE = os.environ.get("TTS_DEVICE", "auto")  # auto | cuda | cpu
MIN_FREE_MIB = int(os.environ.get("TTS_MIN_FREE_MIB", "1500"))
WORKERS = max(1, int(os.environ.get("TTS_WORKERS", "3")))
BATCH_CHUNK = int(os.environ.get("TTS_BATCH_CHUNK", "8"))
MAX_BATCH = 64
OOM_FALLBACK = os.environ.get("TTS_OOM_FALLBACK", "none")  # none | cpu
CPU_DTYPE = os.environ.get("TTS_CPU_DTYPE", "float32")
REQUEST_TIMEOUT = int(os.environ.get("TTS_REQUEST_TIMEOUT", "900"))

MAX_SEGMENTS = 12
MAX_SEGMENT_CHARS = 400
MAX_TOTAL_CHARS = 1200
KINDS = {"praise", "question", "instruction", "statement"}

STYLES = engine.load_styles()


def log(msg: str) -> None:
    print(f"[tts] {msg}", flush=True)

class EngineHost:
    """Memegang satu proses mesin. Satu permintaan pada satu waktu per proses."""

    def __init__(self, n: int) -> None:
        self.n = n
        self.lock = threading.Lock()
        self.proc: Any = None
        self.conn: Any = None
        self.last_used = time.monotonic()
        self.cpu_until = 0.0
        self.last_device = "-"
        self.requests = 0

    def _start(self) -> None:
        ctx = mp.get_context("spawn")
        parent, child = ctx.Pipe()
        self.proc = ctx.Process(target=engine.engine_main, args=(child,), daemon=True)
        self.proc.start()
        child.close()
        self.conn = parent
        log(f"proses mesin {self.n} dimulai (pid {self.proc.pid})")

    def stop(self, why: str) -> None:
        if self.proc is None:
            return
        try:
            if self.proc.is_alive():
                try:
                    self.conn.send(None)
                except Exception:  # noqa: BLE001
                    pass
                self.proc.join(timeout=5)
            if self.proc.is_alive():
                self.proc.kill()
                self.proc.join(timeout=5)
        finally:
            log(f"proses mesin {self.n} dihentikan ({why})")
            self.proc = None
            self.conn = None

    def loaded(self) -> bool:
        return self.proc is not None and self.proc.is_alive()

    def _ask(self, req: dict[str, Any]) -> dict[str, Any]:
        if not self.loaded():
            self.proc = None
            self._start()
        self.conn.send(req)
        deadline = time.monotonic() + REQUEST_TIMEOUT
        while time.monotonic() < deadline:
            if self.conn.poll(1.0):
                return self.conn.recv()
            if not self.proc.is_alive():
                return {"ok": False, "error": "failed", "detail": "proses mesin berhenti tiba-tiba"}
        self.stop("waktu habis")
        return {"ok": False, "error": "failed", "detail": "waktu habis"}

    def synthesize(self, clips: list[dict[str, Any]]) -> dict[str, Any]:
        with self.lock:
            self.requests += 1
            device = "cpu" if time.monotonic() < self.cpu_until else DEVICE
            if device != "cpu" and not self.loaded():
                # GPU dipakai program lain? Jangan muat model dan jangan buat konteks CUDA (lihat gpu.py).
                free = gpu.gpu_free_mib()
                if free is not None and free < MIN_FREE_MIB:
                    res = {"ok": False, "error": "gpu_oom", "detail": f"GPU hanya punya {free} MiB kosong, butuh sekitar {MIN_FREE_MIB} MiB."}
                    if OOM_FALLBACK == "cpu":
                        log("GPU tidak cukup, memakai CPU untuk beberapa menit")
                        self.cpu_until = time.monotonic() + 600
                        device = "cpu"
                    else:
                        return res
            req = {"clips": clips, "device": device}
            res = self._ask(req)
            if not res.get("ok") and res.get("error") in ("gpu_oom", "no_gpu"):
                # Mesin keluar sendiri setelah OOM supaya memori kembali; pastikan prosesnya hilang.
                self.stop(res["error"])
                if OOM_FALLBACK == "cpu" and device != "cpu":
                    log("GPU tidak cukup, memakai CPU untuk beberapa menit")
                    self.cpu_until = time.monotonic() + 600
                    req["device"] = "cpu"
                    res = self._ask(req)
            self.last_used = time.monotonic()
            if res.get("ok"):
                self.last_device = res.get("device", "-")
            return res

    def idle_check(self) -> None:
        if not self.loaded() or time.monotonic() - self.last_used < IDLE_SECONDS:
            return
        if self.lock.acquire(blocking=False):
            try:
                if time.monotonic() - self.last_used >= IDLE_SECONDS:
                    self.stop(f"tidak dipakai {IDLE_SECONDS} detik")
            finally:
                self.lock.release()


class Pool:
    """Beberapa proses mesin. Klip dibagi per potongan kecil dan dikerjakan sejajar (model 82M kecil, GPU muat banyak)."""

    def __init__(self, n: int) -> None:
        self.hosts = [EngineHost(i) for i in range(n)]
        self.free: "queue.Queue[EngineHost]" = queue.Queue()
        for h in self.hosts:
            self.free.put(h)
        self.exec = ThreadPoolExecutor(max_workers=n)

    def _chunk(self, clips: list[dict[str, Any]]) -> dict[str, Any]:
        host = self.free.get()
        try:
            return host.synthesize(clips)
        finally:
            self.free.put(host)

    def run(self, clips: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Satu hasil per klip, urutan sama. Galat tingkat mesin (OOM dan sebagainya) diteruskan ke tiap klip di potongannya."""
        chunks = [clips[i : i + BATCH_CHUNK] for i in range(0, len(clips), BATCH_CHUNK)]
        out: list[dict[str, Any]] = []
        for chunk, res in zip(chunks, self.exec.map(self._chunk, chunks)):
            if res.get("ok"):
                out.extend(res["results"])
            else:
                out.extend({"ok": False, "error": res.get("error", "failed"), "detail": res.get("detail", "")} for _ in chunk)
        return out

    def any_loaded(self) -> bool:
        return any(h.loaded() for h in self.hosts)

    def stop_all(self, why: str) -> None:
        for h in self.hosts:
            with h.lock:
                h.stop(why)


POOL = Pool(WORKERS)


def idle_loop() -> None:
    while True:
        time.sleep(15)
        for h in POOL.hosts:
            try:
                h.idle_check()
            except Exception as e:  # noqa: BLE001
                log(f"pemeriksaan idle gagal: {e}")


def encode_mp3(pcm: bytes, sr: int) -> bytes:
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", str(sr), "-ac", "1", "-i", "pipe:0",
         "-codec:a", "libmp3lame", "-b:a", "64k", "-ar", "24000", "-f", "mp3", "pipe:1"],
        input=pcm, capture_output=True, check=False, timeout=60,
    )
    if p.returncode != 0:
        raise RuntimeError("ffmpeg gagal: " + p.stderr.decode("utf-8", "replace")[:200])
    return p.stdout


def encode_wav(pcm: bytes, sr: int) -> bytes:
    import numpy as np
    import soundfile as sf

    audio = np.frombuffer(pcm, dtype=np.float32)
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV", subtype="PCM_16")
    return buf.getvalue()


def clean_clip(c: Any) -> dict[str, Any] | str:
    if not isinstance(c, dict):
        return "klip harus objek"
    style = c.get("style")
    if style not in STYLES["styles"]:
        return "gaya tidak dikenal"
    segs = c.get("segments")
    if not isinstance(segs, list) or not 1 <= len(segs) <= MAX_SEGMENTS:
        return f"segments harus berisi 1 sampai {MAX_SEGMENTS} kalimat"
    clean: list[dict[str, str]] = []
    total = 0
    for s in segs:
        if not isinstance(s, dict) or not isinstance(s.get("text"), str):
            return "setiap segment butuh text"
        text = " ".join(s["text"].split())
        kind = s.get("kind", "statement")
        if not text or len(text) > MAX_SEGMENT_CHARS or kind not in KINDS:
            return "text kosong, terlalu panjang, atau kind salah"
        total += len(text)
        clean.append({"text": text, "kind": kind})
    if total > MAX_TOTAL_CHARS:
        return "teks terlalu panjang"
    return {"style": style, "segments": clean}


def validate(body: Any) -> tuple[dict[str, Any], str] | str:
    """Mengembalikan (klip, format) atau pesan galat."""
    if not isinstance(body, dict):
        return "badan harus objek JSON"
    clip = clean_clip(body)
    if isinstance(clip, str):
        return clip
    fmt = body.get("format", "mp3")
    if fmt not in ("mp3", "wav"):
        return "format harus mp3 atau wav"
    return clip, fmt


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "KiraTTS"

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: A003
        log(self.address_string() + " " + (fmt % args))

    def _json(self, status: int, obj: Any) -> None:
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorised(self) -> bool:
        if not TOKEN:
            return False
        sent = self.headers.get("Authorization", "")
        return sent.startswith("Bearer ") and hmac.compare_digest(sent[7:].encode(), TOKEN.encode())

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._json(404, {"error": "tidak ditemukan"})
            return
        last = max(POOL.hosts, key=lambda h: h.last_used)
        self._json(200, {
            "ok": True,
            "engine": "kokoro-82m",
            "voiceVersion": STYLES.get("voiceVersion"),
            "deviceSetting": DEVICE,
            "engineLoaded": POOL.any_loaded(),
            "workers": WORKERS,
            "lastDevice": last.last_device,
            "idleSeconds": IDLE_SECONDS,
            "idleFor": int(time.monotonic() - last.last_used),
            "requests": sum(h.requests for h in POOL.hosts),
            "styles": sorted(STYLES["styles"].keys()),
        })

    def _read_body(self, limit: int) -> Any:
        length = int(self.headers.get("Content-Length", "0"))
        if not 0 < length <= limit:
            raise ValueError("ukuran badan salah")
        return json.loads(self.rfile.read(length))

    def _fail(self, res: dict[str, Any]) -> None:
        code = res.get("error", "failed")
        self._json(503 if code in ("gpu_oom", "no_gpu") else 500, {"error": code, "detail": res.get("detail", "")})

    def do_POST(self) -> None:  # noqa: N802
        if self.path not in ("/synthesize", "/batch"):
            self._json(404, {"error": "tidak ditemukan"})
            return
        if not self._authorised():
            self._json(401, {"error": "tidak berwenang"})
            return
        try:
            body = self._read_body(20000 if self.path == "/synthesize" else 400000)
        except (ValueError, json.JSONDecodeError) as e:
            self._json(400, {"error": f"badan tidak terbaca: {e}"})
            return
        if self.path == "/batch":
            self._batch(body)
            return
        parsed = validate(body)
        if isinstance(parsed, str):
            self._json(400, {"error": parsed})
            return
        clip, fmt = parsed
        res = POOL.run([clip])[0]
        if not res.get("ok"):
            self._fail(res)
            return
        try:
            audio = encode_mp3(res["pcm"], res["sr"]) if fmt == "mp3" else encode_wav(res["pcm"], res["sr"])
        except Exception as e:  # noqa: BLE001
            self._json(500, {"error": "failed", "detail": str(e)[:200]})
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg" if fmt == "mp3" else "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.send_header("X-Kira-Device", POOL.hosts[0].last_device)
        self.send_header("X-Kira-Gen-Ms", str(res.get("ms", 0)))
        self.send_header("X-Kira-Voice", str(res.get("voice", "")))
        self.end_headers()
        self.wfile.write(audio)

    def _batch(self, body: Any) -> None:
        clips_in = body.get("clips") if isinstance(body, dict) else None
        if not isinstance(clips_in, list) or not 1 <= len(clips_in) <= MAX_BATCH:
            self._json(400, {"error": f"clips harus berisi 1 sampai {MAX_BATCH} klip"})
            return
        cleaned = [clean_clip(c) for c in clips_in]
        good = [c for c in cleaned if not isinstance(c, str)]
        results = POOL.run(good) if good else []
        it = iter(results)
        pending: list[tuple[str, Any, Any]] = []
        with ThreadPoolExecutor(max_workers=4) as enc:
            for c in cleaned:
                if isinstance(c, str):
                    pending.append(("bad", c, None))
                    continue
                r = next(it)
                pending.append(("ok", r, enc.submit(encode_mp3, r["pcm"], r["sr"]) if r.get("ok") else None))
            out: list[dict[str, Any]] = []
            for kind, r, fut in pending:
                if kind == "bad":
                    out.append({"ok": False, "error": "invalid", "detail": r})
                elif fut is None:
                    out.append({"ok": False, "error": r.get("error", "failed"), "detail": r.get("detail", "")})
                else:
                    try:
                        out.append({"ok": True, "mp3": base64.b64encode(fut.result()).decode(), "ms": r.get("ms", 0)})
                    except Exception as e:  # noqa: BLE001
                        out.append({"ok": False, "error": "failed", "detail": str(e)[:200]})
        self._json(200, {"results": out, "device": POOL.hosts[0].last_device})


def main() -> None:
    if not TOKEN or len(TOKEN) < 32:
        log("KIRA_INTERNAL_TOKEN harus diisi (minimal 32 karakter)")
        sys.exit(1)
    threading.Thread(target=idle_loop, daemon=True).start()
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    log(f"siap di port {PORT} (device={DEVICE}, workers={WORKERS}, idle={IDLE_SECONDS} detik, minFree={MIN_FREE_MIB} MiB)")
    try:
        srv.serve_forever()
    finally:
        POOL.stop_all("server berhenti")


if __name__ == "__main__":
    main()
