"""Uji kecepatan backend suara: 50 kalimat beragam, lalu cetak klip per detik dan perkiraan waktu seluruh set.

Dua cara:

  Lewat layanan tts (backend apa pun yang dipasang di sana, termasuk jumlah proses TTS_WORKERS):
    python speedtest.py --url http://127.0.0.1:8000 --token <KIRA_INTERNAL_TOKEN>

  Langsung ke backend yang kompatibel dengan OpenAI (tanpa layanan tts), mis. Open WebUI. Dari kontainer, alamat host
  adalah host.docker.internal, bukan 127.0.0.1:
    python speedtest.py --backend openai-compatible --base-url http://host.docker.internal:3000/api/v1 \\
        --api-key $KEY --voice <nama suara> [--model tts-1] --concurrency 4

Opsi umum: --n 50, --concurrency 4, --total 21460 (jumlah klip seluruh set), --deadline 06:00 (WIB, untuk perkiraan selesai).
Kunci API tidak pernah dicetak.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

SENTENCES = [
    "What can you see in the picture?",
    "Look at the cat. The cat is on the mat.",
    "Option A.",
    "There are 12 apples and 7 oranges. How many fruits are there in all?",
    "It costs Rp 8,000 for one kilo of rice.",
    "Shade 3/4 of the shape.",
    "Spell the word: necessary.",
    "Photosynthesis is the way plants make food from sunlight, water and carbon dioxide.",
    "What is 3 x 4 + 12?",
    "Mr. Brown walked to St. James's school at 7:30 a.m. on the 5th of May.",
    "Choose the sentence that uses the passive voice.",
    "Once upon a time, a little rabbit lived at the edge of a big green forest.",
    "Which word rhymes with cat?",
    "The water cycle has four stages: evaporation, condensation, precipitation and collection.",
    "Complete the sentence with so or because.",
    "A rectangle is 12 cm long and 5 cm wide. What is its perimeter?",
    "Well done!",
    "Here we go!",
    "Write the missing number: 25, 50, blank, 100.",
    "Listen carefully and tick the correct box.",
]


def sentences(n: int) -> list[str]:
    return [SENTENCES[i % len(SENTENCES)] + ("" if i < len(SENTENCES) else f" ({i // len(SENTENCES) + 1})") for i in range(n)]


def via_service(url: str, token: str, texts: list[str], conc: int, batch: int) -> int:
    def post(chunk: list[str]) -> int:
        body = json.dumps({"clips": [{"style": "teacher", "segments": [{"text": t, "kind": "statement"}]} for t in chunk]}).encode()
        req = urllib.request.Request(url.rstrip("/") + "/batch", data=body, headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=1800) as r:
            res = json.loads(r.read())["results"]
        bad = [x for x in res if not x.get("ok")]
        if bad:
            print("gagal:", bad[0].get("detail", bad[0].get("error", "?"))[:200], file=sys.stderr)
        return len(res) - len(bad)

    chunks = [texts[i : i + batch] for i in range(0, len(texts), batch)]
    with ThreadPoolExecutor(conc) as ex:
        return sum(ex.map(post, chunks))


def direct(args: argparse.Namespace, texts: list[str]) -> int:
    os.environ.update(TTS_BASE_URL=args.base_url, TTS_API_KEY=args.api_key or "", TTS_MODEL=args.model, TTS_VOICE=args.voice)
    from remote import RemoteSynth
    import engine

    synth = RemoteSynth(engine.load_styles())

    def one(t: str) -> int:
        try:
            synth.one("teacher", [{"text": t, "kind": "statement"}])
            return 1
        except Exception as e:  # noqa: BLE001
            print("gagal:", str(e)[:200], file=sys.stderr)
            return 0

    with ThreadPoolExecutor(args.concurrency) as ex:
        return sum(ex.map(one, texts))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url")
    ap.add_argument("--token", default=os.environ.get("KIRA_INTERNAL_TOKEN", ""))
    ap.add_argument("--backend", choices=["service", "openai-compatible"], default="service")
    ap.add_argument("--base-url", default=os.environ.get("TTS_BASE_URL", ""))
    ap.add_argument("--api-key", default=os.environ.get("TTS_API_KEY", ""))
    ap.add_argument("--model", default=os.environ.get("TTS_MODEL", "tts-1"))
    ap.add_argument("--voice", default=os.environ.get("TTS_VOICE", ""))
    ap.add_argument("--n", type=int, default=50)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--batch", type=int, default=10)
    ap.add_argument("--total", type=int, default=21460)
    ap.add_argument("--deadline", default="06:00")
    args = ap.parse_args()

    texts = sentences(args.n)
    # Pemanasan: satu klip, supaya waktu muat model tidak dihitung.
    if args.backend == "service":
        if not args.url:
            ap.error("--url wajib untuk mode layanan")
        via_service(args.url, args.token, texts[:1], 1, 1)
    else:
        if not args.base_url or not args.voice:
            ap.error("--base-url dan --voice wajib untuk backend openai-compatible")
        direct(args, texts[:1])
    t0 = time.time()
    ok = via_service(args.url, args.token, texts, args.concurrency, args.batch) if args.backend == "service" else direct(args, texts)
    dt = max(1e-6, time.time() - t0)
    rate = ok / dt
    print(f"{ok}/{len(texts)} klip dalam {dt:.1f} detik = {rate:.2f} klip/detik (konkurensi {args.concurrency})")
    if rate <= 0:
        print("tidak ada klip berhasil; tidak ada perkiraan")
        return 1
    secs = args.total / rate
    wib = timezone(timedelta(hours=7))
    now = datetime.now(wib)
    done = now + timedelta(seconds=secs)
    hh, mm = (int(x) for x in args.deadline.split(":"))
    deadline = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if deadline <= now:
        deadline += timedelta(days=1)
    print(f"perkiraan {args.total} klip: {secs / 3600:.1f} jam, selesai {done:%H:%M} WIB; batas {args.deadline} WIB: {'CUKUP' if done <= deadline else 'TIDAK CUKUP'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
