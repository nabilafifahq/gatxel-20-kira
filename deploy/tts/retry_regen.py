"""Klip kata yang nadanya bergeser jauh atau bunyi s-nya masih hilang: ukur ulang, buat ulang, atau tahan.

Pelacak nada gerbang bisa salah satu oktaf pada kata pendek, jadi klip dari check_regen.py diukur lagi dengan kepstrum. Yang tetap bergeser 6 semiton atau lebih
(atau desisnya di bawah batas) dibuat ulang sampai 3 kali. Bila tetap tidak lolos, klip ditahan: isi klip lama dipakai untuk kunci baru, dan masuk daftar.

  python retry_regen.py --regen /out/regen.json --old-dir /old --old-manifest /old/manifest-A.jsonl --new-dir /out/tts --url http://host:port --out /out/retry.json
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import urllib.request
from typing import Any

import numpy as np

from check_clips import LEAD_HISS_MIN_MS, S_CLUSTER, SR, decode, lead_hiss_ms

MOVED_LIMIT_ST = 6.0
TRIES = 3


def cepstral_st(y: np.ndarray) -> float | None:
    win, hop = int(SR * 0.04), int(SR * 0.01)
    lo, hi = SR // 450, SR // 65
    out: list[float] = []
    for i in range(0, len(y) - win, hop):
        fr = y[i : i + win].astype(np.float64)
        if np.sqrt(np.mean(fr**2)) < 0.01:
            continue
        spec = np.log(np.abs(np.fft.rfft(fr * np.hanning(win), 2 * win)) + 1e-6)
        cep = np.fft.irfft(spec)
        q = lo + int(np.argmax(cep[lo:hi]))
        if cep[q] > 0.08:
            out.append(12 * float(np.log2((SR / q) / 100.0)))
    return float(np.median(out)) if len(out) >= 8 else None


def render(url: str, token: str, style: str, text: str) -> bytes:
    body = json.dumps({"style": style, "segments": [{"text": text, "kind": "statement"}], "format": "mp3"}).encode()
    req = urllib.request.Request(f"{url}/synthesize", data=body, headers={"authorization": f"Bearer {token}", "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def measure(path: str, old_st: float | None, needs_hiss: bool) -> tuple[bool, float | None, int]:
    y = decode(path, SR)
    st = cepstral_st(y)
    hiss = lead_hiss_ms(y)
    moved = abs(st - old_st) if st is not None and old_st is not None else None
    good = (moved is None or moved < MOVED_LIMIT_ST) and (not needs_hiss or hiss >= LEAD_HISS_MIN_MS)
    return good, moved, hiss


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--regen", required=True)
    ap.add_argument("--old-dir", required=True)
    ap.add_argument("--old-manifest", required=True)
    ap.add_argument("--new-dir", required=True)
    ap.add_argument("--url", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    token = os.environ["KIRA_INTERNAL_TOKEN"]
    rows = json.load(open(args.regen, encoding="utf-8"))["rows"]
    old = {(m["style"], m["text"]): m["key"] for m in (json.loads(line) for line in open(args.old_manifest, encoding="utf-8") if line.strip())}
    todo = [r for r in rows if (r.get("moved_st") or 0) >= MOVED_LIMIT_ST or (r["cluster"] and r["new_hiss"] < LEAD_HISS_MIN_MS)]
    done: list[dict[str, Any]] = []
    for r in todo:
        old_path = f"{args.old_dir}/{old[(r['style'], r['text'])]}.mp3"
        new_path = f"{args.new_dir}/{r['key']}.mp3"
        old_st = cepstral_st(decode(old_path, SR))
        needs_hiss = bool(S_CLUSTER.match(r["text"]))
        good, moved, hiss = measure(new_path, old_st, needs_hiss)
        row: dict[str, Any] = {"text": r["text"], "style": r["style"], "word": r["word"], "tracker_moved": r.get("moved_st"), "cep_moved": None if moved is None else round(moved, 2), "hiss": hiss, "tries": 0}
        if good:
            row["outcome"] = "tetap: salah oktaf pelacak"
            done.append(row)
            continue
        for attempt in range(1, TRIES + 1):
            audio = render(args.url, token, r["style"], r["text"])
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                f.write(audio)
            good, moved, hiss = measure(f.name, old_st, needs_hiss)
            row.update(tries=attempt, cep_moved=None if moved is None else round(moved, 2), hiss=hiss)
            if good:
                tmp = f"{new_path}.retry.tmp"
                shutil.copyfile(f.name, tmp)
                os.replace(tmp, new_path)
                row["outcome"] = "dibuat ulang"
                os.unlink(f.name)
                break
            os.unlink(f.name)
        else:
            tmp = f"{new_path}.retry.tmp"
            shutil.copyfile(old_path, tmp)
            os.replace(tmp, new_path)
            row["outcome"] = "ditahan: isi klip lama"
        done.append(row)
    summary: dict[str, int] = {}
    for d in done:
        summary[d["outcome"]] = summary.get(d["outcome"], 0) + 1
    json.dump({"summary": summary, "rows": done}, open(args.out, "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(json.dumps({"candidates": len(todo), **summary}, ensure_ascii=False))
    print(json.dumps([d for d in done if d["outcome"] != "tetap: salah oktaf pelacak"], ensure_ascii=False)[:1800])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
