"""Gerbang klip suara Indonesia: hanya kekerasan suara dan clipping, ditambah Whisper bahasa Indonesia pada sampel.

Ambang puncak dan clipping sama dengan check_clips.py. Laju bicara dan nada tidak diperiksa: batas itu dikalibrasi pada suara Inggris.
Whisper hanya pada sampel (--sample), hasilnya melaporkan kecocokan rata-rata dan kalimat terburuk untuk didengar manusia.

Contoh (di dalam image kira-tts, folder ini dipasang di /tools):
  python /tools/check_id_clips.py --dir /data/tts --report /data/tts-id-report.csv --sample 60 --whisper small --device cpu

Bisa dilanjutkan: klip yang sudah ada di laporan dilewati. Kode keluar 1 bila ada klip yang gagal.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import json
import math
import os
import random
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from typing import Any

import numpy as np

from check_clips import CLIP_FRACTION, PEAK_LOW_DB, SR, decode

RMS_LOW_DB = -42.0
FIELDS = ["key", "seconds", "peak_db", "rms_db", "clip_frac", "flags"]


def levels(path: str) -> dict[str, Any]:
    key = os.path.basename(path)[:-4]
    row: dict[str, Any] = {"key": key, "seconds": 0, "peak_db": "", "rms_db": "", "clip_frac": "", "flags": ""}
    try:
        y = decode(path, SR)
    except Exception as e:  # noqa: BLE001
        row["flags"] = f"decode:{e}"
        return row
    if len(y) == 0:
        row["flags"] = "kosong"
        return row
    peak = float(np.max(np.abs(y)))
    rms = float(np.sqrt(np.mean(np.square(y))))
    row["seconds"] = round(len(y) / SR, 2)
    row["peak_db"] = round(20 * math.log10(peak + 1e-9), 1)
    row["rms_db"] = round(20 * math.log10(rms + 1e-9), 1)
    row["clip_frac"] = round(float(np.mean(np.abs(y) >= 0.99)), 5)
    flags = []
    if row["peak_db"] < PEAK_LOW_DB or row["rms_db"] < RMS_LOW_DB:
        flags.append("terlalu pelan")
    if row["clip_frac"] > CLIP_FRACTION:
        flags.append("clipping")
    row["flags"] = "; ".join(flags)
    return row


def words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--procs", type=int, default=4)
    ap.add_argument("--sample", type=int, default=0, help="jumlah klip acak (benih tetap) untuk Whisper bahasa Indonesia")
    ap.add_argument("--whisper", default="small")
    ap.add_argument("--device", default="cpu")
    args = ap.parse_args()

    manifest = [json.loads(line) for line in open(os.path.join(args.dir, "manifest.jsonl"), encoding="utf-8") if line.strip()]
    if any(m.get("style") != "indonesian" for m in manifest):
        print("Manifest memuat klip yang bukan peran indonesian", file=sys.stderr)
        return 2
    present = [m for m in manifest if os.path.exists(os.path.join(args.dir, m["key"] + ".mp3"))]

    done: dict[str, dict[str, Any]] = {}
    if os.path.exists(args.report):
        with open(args.report, newline="", encoding="utf-8") as f:
            done = {r["key"]: r for r in csv.DictReader(f)}
    todo = [os.path.join(args.dir, m["key"] + ".mp3") for m in present if m["key"] not in done]
    print(f"{len(manifest)} di manifest, {len(present)} ada, {len(done)} sudah diperiksa, {len(todo)} diperiksa sekarang", flush=True)
    with ProcessPoolExecutor(args.procs) as ex:
        for i, row in enumerate(ex.map(levels, todo, chunksize=32)):
            done[row["key"]] = row
            if (i + 1) % 2000 == 0:
                print(f"{i + 1}/{len(todo)}", flush=True)
    with open(args.report, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for m in present:
            if m["key"] in done:
                w.writerow(done[m["key"]])

    rows = [done[m["key"]] for m in present if m["key"] in done]
    bad = [r for r in rows if r["flags"]]
    print(f"Tingkat suara: {len(rows)} diperiksa, {len(rows) - len(bad)} lulus, {len(bad)} gagal")
    for r in bad[:20]:
        print(f"  {r['key'][:12]} {r['flags']} puncak {r['peak_db']} rms {r['rms_db']}")

    if args.sample > 0:
        from faster_whisper import WhisperModel

        model = WhisperModel(args.whisper, device=args.device, compute_type="float16" if args.device == "cuda" else "int8")
        picks = list(present)
        random.Random(7).shuffle(picks)
        scores: list[tuple[float, dict[str, Any], str]] = []
        for m in picks[: args.sample]:
            y = decode(os.path.join(args.dir, m["key"] + ".mp3"), SR)
            segs, info = model.transcribe(y.astype(np.float32), language="id", beam_size=1, condition_on_previous_text=False, without_timestamps=True)
            heard = " ".join(s.text.strip() for s in segs).strip()
            score = difflib.SequenceMatcher(None, words(m["text"]), words(heard)).ratio()
            scores.append((score, m, heard))
        scores.sort(key=lambda x: x[0])
        print(f"Whisper id: {len(scores)} sampel, kecocokan rata-rata {sum(s for s, _, _ in scores) / max(1, len(scores)):.2f}, terendah {scores[0][0]:.2f}")
        for score, m, heard in scores[:8]:
            print(f"  {score:.2f} | {m['text'][:90]} | {heard[:90]}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
