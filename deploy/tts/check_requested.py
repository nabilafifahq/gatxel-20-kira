"""Periksa klip yang benar-benar diminta layar: Whisper, nada per suara, dan clipping lewat ffmpeg.

Masukan: --pairs JSON daftar {key, text, spoken, style, version}. Klip dibaca dari --dir. Hasil: --out JSON.
Dijalankan di dalam image kira-tts, folder ini dipasang di /tools.
  python /tools/check_requested.py --dir /tts --pairs /work/pairs.json --out /work/requested.json --device cuda
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import statistics
import subprocess
from typing import Any

import numpy as np

from check_clips import CLIP_DEVIATION_ST, DEVIATION_MIN_SECONDS, PHRASE_JUMP_ST, SR, asr_score, decode, f0_phrases

ID_ONES = "nol satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas".split()


def id_number(n: int) -> str:
    if n < 12:
        return ID_ONES[n]
    if n < 20:
        return f"{ID_ONES[n - 10]} belas"
    if n < 100:
        return f"{ID_ONES[n // 10]} puluh" + ("" if n % 10 == 0 else f" {ID_ONES[n % 10]}")
    if n < 200:
        return "seratus" + ("" if n == 100 else f" {id_number(n - 100)}")
    if n < 1000:
        return f"{ID_ONES[n // 100]} ratus" + ("" if n % 100 == 0 else f" {id_number(n % 100)}")
    if n < 2000:
        return "seribu" + ("" if n == 1000 else f" {id_number(n - 1000)}")
    if n < 1_000_000:
        return f"{id_number(n // 1000)} ribu" + ("" if n % 1000 == 0 else f" {id_number(n % 1000)}")
    return " ".join(ID_ONES[int(d)] for d in str(n))


def id_words(text: str) -> list[str]:
    t = text.lower()
    t = re.sub(r"(?<=\d)[.,](?=\d{3}\b)", "", t)
    t = re.sub(r"(\d+),(\d+)", lambda m: f"{id_number(int(m.group(1)))} koma {' '.join(ID_ONES[int(d)] for d in m.group(2))}", t)
    t = re.sub(r"\d+", lambda m: id_number(int(m.group(0))), t)
    t = t.replace("×", " kali ").replace("+", " tambah ").replace("=", " sama dengan ").replace("÷", " bagi ").replace("−", " kurang ")
    t = re.sub(r"[^a-z ]+", " ", t)
    return t.split()


def id_score(reference: str, heard: str) -> float:
    ref, hyp = id_words(reference), id_words(heard)
    if not ref:
        return 1.0
    if not hyp:
        return 0.0
    words = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False).ratio()
    chars = difflib.SequenceMatcher(a=" ".join(ref), b=" ".join(hyp), autojunk=False).ratio()
    return max(words, chars)


def ffmpeg_levels(path: str) -> dict[str, Any]:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "astats=measure_overall=Peak_level+RMS_level+Peak_count+Flat_factor+Number_of_samples:measure_perchannel=0,volumedetect", "-f", "null", "-"], capture_output=True, text=True)
    err = p.stderr
    out: dict[str, Any] = {}
    for pat, name in ((r"max_volume: (-?[\d.]+) dB", "max_db"), (r"mean_volume: (-?[\d.]+) dB", "mean_db"), (r"Number of samples: (\d+)", "samples"), (r"histogram_0db: (\d+)", "hist0db"), (r"Flat factor: (-?[\d.]+)", "flat_factor"), (r"Peak count: (\d+)", "peak_count")):
        m = re.search(pat, err)
        if m:
            out[name] = float(m.group(1))
    # Puncak rata (clipping sungguhan): deret sampel berurutan di skala penuh, pada laju asli berkas.
    raw = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "error", "-i", path, "-f", "f32le", "-ac", "1", "-"], capture_output=True).stdout
    y = np.frombuffer(raw, dtype=np.float32)
    hot = np.abs(y) >= 0.999
    run = best = 0
    for v in hot:
        run = run + 1 if v else 0
        best = max(best, run)
    out["full_scale_samples"] = int(hot.sum())
    out["longest_flat_run"] = int(best)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True)
    ap.add_argument("--pairs", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--device", default="cuda")
    args = ap.parse_args()
    from faster_whisper import WhisperModel

    pairs = json.load(open(args.pairs, encoding="utf-8"))
    compute = "float16" if args.device == "cuda" else "int8"
    en_model = WhisperModel("small.en", device=args.device, compute_type=compute)
    id_model = WhisperModel("small", device=args.device, compute_type=compute)
    rows: list[dict[str, Any]] = []
    for i, m in enumerate(pairs):
        path = os.path.join(args.dir, m["key"] + ".mp3")
        row: dict[str, Any] = {"key": m["key"], "text": m["text"], "style": m["style"], "version": m["version"], "extra": bool(m.get("extra"))}
        try:
            y = decode(path, SR)
        except Exception as e:  # noqa: BLE001
            row["error"] = str(e)
            rows.append(row)
            continue
        row["seconds"] = round(len(y) / SR, 2)
        is_id = m["version"].startswith("id-")
        model = id_model if is_id else en_model
        segs, _ = model.transcribe(y.astype(np.float32), language="id" if is_id else "en", beam_size=1, condition_on_previous_text=False, without_timestamps=True)
        heard = " ".join(s.text.strip() for s in segs).strip()
        row["heard"] = heard
        if is_id:
            row["score"] = round(max(id_score(m["text"], heard), id_score(m.get("spoken") or m["text"], heard)), 3)
        else:
            row["score"] = round(asr_score(m["text"], heard), 3)
        meds = f0_phrases(y) if len(y) / SR >= 0.3 else []
        row["f0_st"] = round(float(np.median(meds)), 2) if meds else None
        row["jump_st"] = round(max(meds) - min(meds), 2) if len(meds) > 1 else 0.0
        row.update(ffmpeg_levels(path))
        row["clip_frac"] = round(float(np.mean(np.abs(y) >= 0.99)), 5)
        rows.append(row)
        if (i + 1) % 25 == 0:
            print(f"{i + 1}/{len(pairs)}", flush=True)

    summary: dict[str, Any] = {}
    for version in sorted({r["version"] for r in rows}):
        every = [r for r in rows if r["version"] == version and "score" in r]
        rs = [r for r in every if not r["extra"]]  # tambahan per suara hanya untuk nada dan tingkat suara
        scores = sorted(r["score"] for r in rs)
        voices: dict[str, Any] = {}
        for style in sorted({r["style"] for r in every}):
            f0s = [r["f0_st"] for r in every if r["style"] == style and r["f0_st"] is not None and r["seconds"] >= DEVIATION_MIN_SECONDS]
            if not f0s:
                continue
            med = statistics.median(f0s)
            devs = [abs(x - med) for x in f0s]
            voices[style] = {
                "clips": len(f0s),
                "median_hz": round(100 * 2 ** (med / 12), 1),
                "stdev_st": round(statistics.pstdev(f0s), 2),
                "max_dev_st": round(max(devs), 2),
                "over_limit": sum(1 for d in devs if d > CLIP_DEVIATION_ST),
            }
        summary[version] = {
            "pairs": len(rs),
            "mean": round(sum(scores) / max(1, len(scores)), 3),
            "median": scores[len(scores) // 2] if scores else None,
            "ge_0_8": sum(1 for s in scores if s >= 0.8),
            "ge_0_6": sum(1 for s in scores if s >= 0.6),
            "voices": voices,
            "phrase_jumps_over_limit": sum(1 for r in rs if r["jump_st"] > PHRASE_JUMP_ST),
            "max_db": max((r.get("max_db", -99) for r in rs), default=None),
            "clipped_clips_over_0_05pct": sum(1 for r in rs if r["clip_frac"] > 0.0005),
            "any_at_0db": sum(1 for r in rs if r.get("hist0db")),
            "full_scale_samples_max": max((r.get("full_scale_samples", 0) for r in rs), default=0),
            "longest_flat_run": max((r.get("longest_flat_run", 0) for r in rs), default=0),
            "flat_runs_ge_4": sum(1 for r in rs if r.get("longest_flat_run", 0) >= 4),
            "mean_db_range": [min(r.get("mean_db", 0) for r in rs), max(r.get("mean_db", -99) for r in rs)] if rs else None,
            "worst": sorted(({"score": r["score"], "text": r["text"], "heard": r["heard"], "key": r["key"]} for r in rs), key=lambda x: x["score"])[:10],
        }
    json.dump({"summary": summary, "rows": rows}, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
