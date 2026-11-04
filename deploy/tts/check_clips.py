"""Gerbang mutu klip suara Kira.

Untuk tiap klip <dir>/<kunci>.mp3 (teks sumbernya di <dir>/manifest.jsonl, ditulis oleh `pnpm tts:generate`):

  durasi   detik terhadap panjang teks (karakter per detik) di luar batas peran -> terpotong atau melantur
  puncak   puncak dBFS dan bagian sampel yang terpotong (clipping); terlalu pelan = nyaris diam
  hening   hening di awal dan akhir yang terlalu panjang, jeda di tengah terlalu lama, dan bagian hening total
  nada     F0 (nada dasar, pYIN) per frasa: selisih antar frasa dalam satu klip (lompatan suara) dan simpangan
           median klip dari median seluruh klip pada suara yang sama (suara berganti antar klip)
  Whisper  faster-whisper di GPU mentranskripsi klip, dibandingkan dengan teks sumber (setelah angka diubah jadi kata);
           kecocokan rendah ditandai (audio tidak sesuai teks)

Hasil: CSV laporan (satu baris per klip, kolom flags berisi alasan). Klip yang gagal dibuat ulang SEKALI lewat layanan
(variant=1: kecepatan sedikit berbeda, karena Kokoro deterministik dan teks sama menghasilkan audio sama), diperiksa
lagi, dan yang masih gagal ditulis ke <laporan>.gagal.csv.

Bisa dilanjutkan: klip yang sudah ada di laporan (dan berkasnya tidak berubah) dilewati. Pakai --force untuk memeriksa ulang.

Contoh (di dalam image kira-tts):
  python check_clips.py --dir /data/tts --report /data/tts-report.csv --url http://tts:8000 --token $KIRA_INTERNAL_TOKEN
"""

from __future__ import annotations

import argparse
import base64
import csv
import difflib
import json
import math
import os
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from multiprocessing import Pool
from typing import Any

import numpy as np

from textprep import prepare_text

SR = 16000  # analisis dan Whisper memakai 16 kHz

# Batas wajar karakter per detik (termasuk jeda antar kalimat). Dikalibrasi pada klip Kokoro; di luar ini berarti rusak.
CPS_BOUNDS = {"teacher": (6.0, 26.0), "quizhost": (6.0, 28.0), "dictation": (3.0, 22.0), "second": (6.0, 26.0)}
MIN_SECONDS = 0.25
MAX_SECONDS = 45.0
PEAK_LOW_DB = -30.0
CLIP_FRACTION = 0.0005
EDGE_SILENCE_S = 1.2
INNER_SILENCE_S = {"teacher": 1.6, "quizhost": 1.6, "second": 1.6, "dictation": 2.4}
SILENT_RATIO = 0.6
SILENCE_DB = -45.0
PHRASE_JUMP_ST = 8.0  # semiton antar frasa dalam satu klip (laki-laki ke perempuan sekitar 10 sampai 12)
CLIP_DEVIATION_ST = 5.0  # simpangan median F0 klip dari median suara yang sama
ASR_MIN_SCORE = 0.8
ASR_MIN_SCORE_SHORT = 0.6  # klip 3 sampai 4 kata

FIELDS = [
    "key", "style", "mtime", "chars", "seconds", "cps", "peak_db", "clip_frac", "lead_sil", "trail_sil", "inner_sil", "silent_ratio",
    "f0_median", "phrase_jump_st", "f0_dev_st", "asr_score", "asr_text", "text", "flags", "pass",
]


def log(msg: str) -> None:
    print(f"[check] {msg}", flush=True)


# ---------------------------------------------------------------- teks

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else " " + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + number_words(n % 100))
    if n < 1_000_000:
        return number_words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + number_words(n % 1000))
    return " ".join(ONES[int(d)] for d in str(n))


def normalise(text: str) -> list[str]:
    """Teks jadi daftar kata huruf kecil: angka jadi kata, tanda baca dan singkatan umum diseragamkan."""
    t = text.lower().replace("’", "'")
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)
    t = re.sub(r"(\d+)\.(\d+)", lambda m: f"{number_words(int(m.group(1)))} point {' '.join(ONES[int(d)] for d in m.group(2))}", t)
    t = re.sub(r"\d+", lambda m: number_words(int(m.group(0))), t)
    t = re.sub(r"\bmr\b\.?", "mister", t)
    t = re.sub(r"\bmrs\b\.?", "missus", t)
    t = re.sub(r"\bdr\b\.?", "doctor", t)
    t = re.sub(r"\bst\b\.?", "saint", t)
    t = re.sub(r"\ba\.m\.?|\bam\b(?=\W|$)", lambda m: "am", t)
    t = re.sub(r"[^a-z' ]+", " ", t.replace("-", " "))
    t = t.replace("'s", "s").replace("'", "")
    return t.split()


def asr_score(reference: str, heard: str) -> float:
    """Kecocokan 0..1: yang terbaik dari kecocokan kata dan kecocokan huruf (nama Indonesia sering salah dengar tetapi mirip bunyinya)."""
    ref = normalise(prepare_text(reference))
    hyp = normalise(heard)
    if not ref:
        return 1.0
    if not hyp:
        return 0.0
    words = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False).ratio()
    chars = difflib.SequenceMatcher(a=" ".join(ref), b=" ".join(hyp), autojunk=False).ratio()
    return max(words, chars)


# ---------------------------------------------------------------- audio

def decode(path: str, sr: int) -> np.ndarray:
    p = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(sr), "pipe:1"],
        capture_output=True, check=False, timeout=60,
    )
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError("ffmpeg gagal: " + p.stderr.decode("utf-8", "replace")[:120])
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def frame_db(y: np.ndarray, hop: int = 160) -> np.ndarray:
    n = len(y) // hop
    if n == 0:
        return np.array([-120.0])
    frames = y[: n * hop].reshape(n, hop)
    rms = np.sqrt(np.mean(np.square(frames), axis=1) + 1e-12)
    return 20 * np.log10(rms + 1e-9)


def silence_stats(y: np.ndarray) -> tuple[float, float, float, float]:
    """(awal, akhir, jeda terpanjang di tengah, bagian hening) dalam detik dan rasio."""
    hop = 160
    db = frame_db(y, hop)
    quiet = db < SILENCE_DB
    if quiet.all():
        return len(y) / SR, len(y) / SR, 0.0, 1.0
    first = int(np.argmax(~quiet))
    last = len(quiet) - 1 - int(np.argmax(~quiet[::-1]))
    inner = 0
    run = 0
    for q in quiet[first : last + 1]:
        run = run + 1 if q else 0
        inner = max(inner, run)
    return first * hop / SR, (len(quiet) - 1 - last) * hop / SR, inner * hop / SR, float(quiet.mean())


def f0_phrases(y: np.ndarray) -> list[float]:
    """Median F0 (semiton terhadap 100 Hz) tiap frasa bersuara. Frasa dipisah oleh bagian tak bersuara lebih dari 200 md."""
    import librosa

    hop = 320  # 20 md
    f0, voiced, _ = librosa.pyin(y, fmin=65, fmax=450, sr=SR, frame_length=1024, hop_length=hop, resolution=0.25, n_thresholds=20, fill_na=np.nan)
    st = 12 * np.log2(np.where(voiced & np.isfinite(f0), f0, np.nan) / 100.0)
    phrases: list[list[float]] = []
    cur: list[float] = []
    gap = 0
    for v in st:
        if np.isfinite(v):
            cur.append(float(v))
            gap = 0
        else:
            gap += 1
            if gap > 10 and cur:  # 200 md
                phrases.append(cur)
                cur = []
    if cur:
        phrases.append(cur)
    return [float(np.median(p)) for p in phrases if len(p) >= 12]  # minimal 240 md bersuara


def analyse(args: tuple[str, str, str]) -> dict[str, Any]:
    """Metrik akustik satu klip. Dijalankan di proses pekerja."""
    key, style, path = args
    row: dict[str, Any] = {"key": key, "style": style, "flags": []}
    try:
        y = decode(path, SR)
    except Exception as e:  # noqa: BLE001
        row["flags"] = [f"decode:{e}"]
        return row
    secs = len(y) / SR
    row["seconds"] = round(secs, 2)
    peak = float(np.max(np.abs(y))) if len(y) else 0.0
    row["peak_db"] = round(20 * math.log10(peak + 1e-9), 1)
    row["clip_frac"] = round(float(np.mean(np.abs(y) >= 0.99)), 5) if len(y) else 0.0
    lead, trail, inner, ratio = silence_stats(y)
    row.update(lead_sil=round(lead, 2), trail_sil=round(trail, 2), inner_sil=round(inner, 2), silent_ratio=round(ratio, 2))
    try:
        meds = f0_phrases(y) if secs >= 0.3 and peak > 0.01 else []
    except Exception:  # noqa: BLE001
        meds = []
    if meds:
        row["f0_median"] = round(float(np.median(meds)), 2)
        row["phrase_jump_st"] = round(max(meds) - min(meds), 2) if len(meds) > 1 else 0.0
    row["audio16k"] = y.astype(np.float16)  # untuk Whisper; dibuang sebelum ditulis
    return row


# ---------------------------------------------------------------- Whisper

class Asr:
    def __init__(self, model: str, device: str) -> None:
        from faster_whisper import WhisperModel

        self.model = WhisperModel(model, device=device, compute_type="float16" if device == "cuda" else "int8")

    def one(self, audio: np.ndarray) -> str:
        segs, _ = self.model.transcribe(audio.astype(np.float32), language="en", beam_size=1, condition_on_previous_text=False, without_timestamps=True)
        return " ".join(s.text.strip() for s in segs).strip()

    def many(self, audios: list[np.ndarray], threads: int) -> list[str]:
        with ThreadPoolExecutor(threads) as ex:
            return list(ex.map(self.one, audios))


# ---------------------------------------------------------------- laporan

def judge(row: dict[str, Any], text: str) -> list[str]:
    """Bendera dari metrik satu klip (tanpa simpangan antar klip, itu di akhir)."""
    flags: list[str] = [f for f in row.get("flags", []) if isinstance(f, str)]
    style = row["style"]
    if "seconds" not in row:
        return flags or ["tidak terbaca"]
    secs = row["seconds"]
    chars = len(text)
    row["chars"] = chars
    row["cps"] = round(chars / secs, 1) if secs > 0 else 0
    lo, hi = CPS_BOUNDS.get(style, (6.0, 26.0))
    if secs < MIN_SECONDS:
        flags.append("terlalu pendek")
    if secs > MAX_SECONDS:
        flags.append("terlalu panjang")
    # Klip pendek punya jeda tetap di tepi, jadi batas bawah laju diberi pelonggaran tetap.
    if secs >= MIN_SECONDS and chars >= 8 and (secs > 1.2 + chars / lo or secs < chars / hi - 0.2):
        flags.append(f"durasi/teks {row['cps']} k/d")
    if row["peak_db"] < PEAK_LOW_DB:
        flags.append("terlalu pelan")
    if row["clip_frac"] > CLIP_FRACTION:
        flags.append("clipping")
    if row["lead_sil"] > EDGE_SILENCE_S or row["trail_sil"] > EDGE_SILENCE_S:
        flags.append("hening di tepi")
    if row["inner_sil"] > INNER_SILENCE_S.get(style, 1.6):
        flags.append("jeda terlalu lama")
    if row["silent_ratio"] > SILENT_RATIO:
        flags.append("terlalu banyak hening")
    if row.get("phrase_jump_st", 0) > PHRASE_JUMP_ST:
        flags.append(f"lompatan nada {row['phrase_jump_st']} st")
    score = row.get("asr_score")
    if score is not None:
        words = len(normalise(prepare_text(text)))
        if not row.get("asr_text"):
            flags.append("Whisper tidak mendengar apa pun")
        elif words > 2 and score < (ASR_MIN_SCORE_SHORT if words <= 4 else ASR_MIN_SCORE):
            # Satu atau dua kata (huruf, bunyi, kata ejaan) tidak diadili Whisper: transkripsi kata tunggal tidak andal.
            flags.append(f"Whisper cocok {score}")
    return flags


def voice_deviation(rows: list[dict[str, Any]], voice_of: dict[str, str]) -> None:
    """Simpangan median F0 tiap klip dari median suara yang sama. Mengubah rows di tempat."""
    by_voice: dict[str, list[float]] = {}
    for r in rows:
        if r.get("f0_median") not in (None, ""):
            by_voice.setdefault(voice_of.get(r["style"], r["style"]), []).append(float(r["f0_median"]))
    med = {v: float(np.median(x)) for v, x in by_voice.items() if len(x) >= 20}
    for r in rows:
        v = voice_of.get(r["style"], r["style"])
        if r.get("f0_median") in (None, "") or v not in med:
            continue
        dev = float(r["f0_median"]) - med[v]
        r["f0_dev_st"] = round(dev, 2)
        tag = f"suara beda {round(dev, 1)} st"
        flags = [f for f in str(r.get("flags", "")).split("; ") if f and not f.startswith("suara beda")]
        if abs(dev) > CLIP_DEVIATION_ST:
            flags.append(tag)
        r["flags"] = "; ".join(flags)
        r["pass"] = "" if flags else "ok"


def post_batch(url: str, token: str, clips: list[dict[str, Any]]) -> list[dict[str, Any]]:
    body = json.dumps({"clips": clips}).encode()
    req = urllib.request.Request(url.rstrip("/") + "/batch", data=body, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=1800) as r:
        return json.loads(r.read())["results"]


def read_report(path: str) -> dict[str, dict[str, Any]]:
    if not os.path.exists(path):
        return {}
    with open(path, newline="", encoding="utf-8") as f:
        return {r["key"]: r for r in csv.DictReader(f)}


def write_report(path: str, rows: list[dict[str, Any]]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    os.replace(tmp, path)


def evaluate(todo: list[dict[str, Any]], dir_: str, pool: Any, asr: Asr | None, threads: int) -> list[dict[str, Any]]:
    """Akustik (proses paralel) lalu Whisper (GPU) untuk daftar klip manifest."""
    jobs = [(m["key"], m["style"], os.path.join(dir_, m["key"] + ".mp3")) for m in todo]
    rows = pool.map(analyse, jobs, chunksize=8)
    if asr is not None:
        have = [i for i, r in enumerate(rows) if "audio16k" in r]
        heard = asr.many([rows[i]["audio16k"] for i in have], threads)
        for i, h in zip(have, heard):
            rows[i]["asr_text"] = h
            rows[i]["asr_score"] = round(asr_score(todo[i]["text"], h), 3)
    for m, r in zip(todo, rows):
        r.pop("audio16k", None)
        r["text"] = m["text"]
        try:
            r["mtime"] = int(os.path.getmtime(os.path.join(dir_, m["key"] + ".mp3")))
        except OSError:
            r["mtime"] = 0
        r["flags"] = judge(r, m["text"])
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", required=True, help="folder klip (berisi <kunci>.mp3 dan manifest.jsonl)")
    ap.add_argument("--report", required=True, help="CSV laporan")
    ap.add_argument("--url", help="layanan suara untuk membuat ulang klip yang gagal (tanpa ini tidak dibuat ulang)")
    ap.add_argument("--token", default=os.environ.get("KIRA_INTERNAL_TOKEN", ""))
    ap.add_argument("--whisper", default="small.en", help="model faster-whisper (small.en, medium.en, distil-large-v3)")
    ap.add_argument("--no-asr", action="store_true", help="lewati Whisper (hanya akustik)")
    ap.add_argument("--procs", type=int, default=6, help="proses analisis akustik")
    ap.add_argument("--threads", type=int, default=4, help="utas Whisper")
    ap.add_argument("--chunk", type=int, default=256)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--force", action="store_true", help="periksa ulang semua klip")
    args = ap.parse_args()

    manifest = [json.loads(line) for line in open(os.path.join(args.dir, "manifest.jsonl"), encoding="utf-8") if line.strip()]
    manifest = [m for m in manifest if os.path.exists(os.path.join(args.dir, m["key"] + ".mp3"))]
    if args.limit:
        manifest = manifest[: args.limit]
    by_key = {m["key"]: m for m in manifest}
    styles = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "styles.json"), encoding="utf-8"))
    voice_of = {k: v["voice"] for k, v in styles["styles"].items()}

    done = {} if args.force else read_report(args.report)
    # Klip yang berkasnya berubah sejak diperiksa harus diperiksa lagi.
    fresh = {k: r for k, r in done.items() if k in by_key and str(int(os.path.getmtime(os.path.join(args.dir, k + ".mp3")))) == r.get("mtime")}
    todo = [m for m in manifest if m["key"] not in fresh]
    log(f"{len(manifest)} klip, {len(fresh)} sudah diperiksa, {len(todo)} diperiksa sekarang")

    asr = None if args.no_asr else Asr(args.whisper, "cuda")
    rows_by_key: dict[str, dict[str, Any]] = dict(fresh)
    started = time.time()
    with Pool(args.procs) as pool:
        for at in range(0, len(todo), args.chunk):
            chunk = todo[at : at + args.chunk]
            for r in evaluate(chunk, args.dir, pool, asr, args.threads):
                r["flags"] = "; ".join(r["flags"])
                r["pass"] = "" if r["flags"] else "ok"
                rows_by_key[r["key"]] = r
            write_report(args.report, [rows_by_key[m["key"]] for m in manifest if m["key"] in rows_by_key])
            log(f"{min(at + args.chunk, len(todo))}/{len(todo)} diperiksa, {(time.time() - started):.0f} detik")

        all_rows = [rows_by_key[m["key"]] for m in manifest if m["key"] in rows_by_key]
        for r in all_rows:
            if isinstance(r.get("flags"), list):
                r["flags"] = "; ".join(r["flags"])
        voice_deviation(all_rows, voice_of)
        write_report(args.report, all_rows)

        failing = [r for r in all_rows if r.get("pass") != "ok"]
        log(f"lulus {len(all_rows) - len(failing)}/{len(all_rows)}, gagal {len(failing)}")

        # Buat ulang sekali (variant=1), periksa lagi.
        if failing and args.url and args.token:
            regen: list[dict[str, Any]] = []
            for r in failing:
                m = by_key[r["key"]]
                regen.append({"key": r["key"], "style": m["style"], "text": m["text"]})
            fixed = 0
            for at in range(0, len(regen), 32):
                group = regen[at : at + 32]
                clips = [{"style": g["style"], "variant": 1, "segments": [{"text": g["text"], "kind": "statement"}]} for g in group]
                try:
                    results = post_batch(args.url, args.token, clips)
                except Exception as e:  # noqa: BLE001
                    log(f"pembuatan ulang gagal: {e}")
                    break
                for g, res in zip(group, results):
                    if res.get("ok") and res.get("mp3"):
                        dest = os.path.join(args.dir, g["key"] + ".mp3")
                        with open(dest + ".tmp", "wb") as f:
                            f.write(base64.b64decode(res["mp3"]))
                        os.replace(dest + ".tmp", dest)
                        fixed += 1
            log(f"{fixed} klip dibuat ulang sekali, diperiksa lagi")
            again = evaluate([by_key[r["key"]] for r in failing], args.dir, pool, asr, args.threads)
            for r in again:
                r["flags"] = "; ".join(r["flags"])
                r["pass"] = "" if r["flags"] else "ok"
                rows_by_key[r["key"]] = r
            all_rows = [rows_by_key[m["key"]] for m in manifest if m["key"] in rows_by_key]
            voice_deviation(all_rows, voice_of)
            write_report(args.report, all_rows)

    failing = [r for r in all_rows if r.get("pass") != "ok"]
    with open(args.report.replace(".csv", "") + ".gagal.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        w.writerows(failing)
    rate = (len(all_rows) - len(failing)) / max(1, len(all_rows))
    log(f"SELESAI: {len(all_rows)} klip, lulus {len(all_rows) - len(failing)} ({rate:.2%}), gagal setelah satu kali dibuat ulang {len(failing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
