"""Bandingkan klip yang dibuat ulang dengan klip lamanya: bunyi s di awal dan nada per klip.

Klip yang terdengar seperti pembicara lain ditandai: median nadanya jauh dari median peran (10 semiton untuk satu kata, 8 untuk kalimat, batas yang sama
dengan catatan gerbang di check_clips.py) dan juga bergeser dari klip lamanya lebih dari 4 semiton. Hasilnya daftar untuk dibuat ulang atau ditahan.

  python check_regen.py --old-dir /old --new-dir /out/tts --old-manifest /old/manifest-A.jsonl --new-manifest /out/tts/manifest-B.jsonl --out /out/regen.json
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
from typing import Any

import numpy as np

from check_clips import S_CLUSTER, LEAD_HISS_MIN_MS, SR, decode, f0_track, lead_hiss_ms

AFFECTED = re.compile(r"""(?:^|[.!?]["'”)]*\s+)["'“(]*s(?:p|t|k|w|c|q)""", re.I)
WORD_LIMIT_ST, SENTENCE_LIMIT_ST, MOVED_ST = 10.0, 8.0, 4.0


def semitones(y: np.ndarray) -> float | None:
    t = f0_track(y)
    t = t[np.isfinite(t)]
    if len(t) < 10:
        return None
    return float(12 * np.log2(np.median(t) / 100.0))


def octave_free(a: float, b: float) -> float:
    """Selisih setelah mengabaikan salah oktaf pelacak: 12 semiton dianggap sama."""
    d = abs(a - b) % 12.0
    return min(d, 12.0 - d)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--old-dir", required=True)
    ap.add_argument("--new-dir", required=True)
    ap.add_argument("--old-manifest", required=True)
    ap.add_argument("--new-manifest", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    old = {(m["style"], m["text"]): m["key"] for m in (json.loads(line) for line in open(args.old_manifest, encoding="utf-8") if line.strip())}
    rows = [m for m in (json.loads(line) for line in open(args.new_manifest, encoding="utf-8") if line.strip()) if (m["style"], m["text"]) in old and AFFECTED.search(m["text"])]
    out: list[dict[str, Any]] = []
    for m in rows:
        o = decode(f"{args.old_dir}/{old[(m['style'], m['text'])]}.mp3", SR)
        try:
            n = decode(f"{args.new_dir}/{m['key']}.mp3", SR)
        except Exception:  # noqa: BLE001
            continue
        out.append(
            {
                "key": m["key"], "style": m["style"], "text": m["text"], "cluster": bool(S_CLUSTER.match(m["text"])), "word": " " not in m["text"].strip(),
                "old_hiss": lead_hiss_ms(o), "new_hiss": lead_hiss_ms(n), "old_st": semitones(o), "new_st": semitones(n),
                "old_secs": round(len(o) / SR, 2), "new_secs": round(len(n) / SR, 2),
            }
        )
    centres = {s: statistics.median([r["old_st"] for r in out if r["style"] == s and r["old_st"] is not None]) for s in {r["style"] for r in out}}
    flagged = []
    moved = []
    for r in out:
        if r["new_st"] is None or r["old_st"] is None:
            continue
        r["moved_st"] = round(abs(r["new_st"] - r["old_st"]), 2)
        moved.append(r["moved_st"])
        limit = WORD_LIMIT_ST if r["word"] else SENTENCE_LIMIT_ST
        r["from_centre_st"] = round(abs(r["new_st"] - centres[r["style"]]), 2)
        if r["from_centre_st"] > limit and r["moved_st"] > MOVED_ST:
            r["octave_free_moved_st"] = round(octave_free(r["new_st"], r["old_st"]), 2)
            flagged.append(r)
    cl = [r for r in out if r["cluster"]]
    q = lambda a, p: float(np.percentile(a, p)) if len(a) else 0.0  # noqa: E731
    summary = {
        "clips": len(out),
        "at_clip_start": len(cl),
        "centre_hz": {s: round(100 * 2 ** (c / 12), 1) for s, c in centres.items()},
        "hiss_old": {"p5": q([r["old_hiss"] for r in cl], 5), "median": q([r["old_hiss"] for r in cl], 50), "below_limit": sum(r["old_hiss"] < LEAD_HISS_MIN_MS for r in cl)},
        "hiss_new": {"p5": q([r["new_hiss"] for r in cl], 5), "median": q([r["new_hiss"] for r in cl], 50), "below_limit": sum(r["new_hiss"] < LEAD_HISS_MIN_MS for r in cl)},
        "moved_st": {"median": q(moved, 50), "p95": q(moved, 95), "max": q(moved, 100)},
        "flagged": len(flagged),
        "flagged_words": sum(r["word"] for r in flagged),
        "flagged_list": [{k: r.get(k) for k in ("key", "style", "text", "old_st", "new_st", "moved_st", "from_centre_st", "octave_free_moved_st")} for r in flagged][:60],
        "new_below_limit": [r["text"][:50] for r in cl if r["new_hiss"] < LEAD_HISS_MIN_MS][:30],
    }
    json.dump({"summary": summary, "rows": out}, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(json.dumps(summary, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
