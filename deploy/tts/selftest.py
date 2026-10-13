"""Uji cepat layanan suara: kirim satu kalimat pendek dan catat waktunya.
    python selftest.py http://127.0.0.1:8000 <KIRA_INTERNAL_TOKEN> [gaya]   (mp3 hasil: /tmp/selftest.mp3)
Kunjungan pertama memuat model, jadi waktunya mencakup waktu muat. Kunjungan kedua menunjukkan waktu sintesis saja.
"""

import json
import sys
import time
import urllib.error
import urllib.request

base, token = sys.argv[1], sys.argv[2]
style = sys.argv[3] if len(sys.argv) > 3 else "teacher"
body = json.dumps({"style": style, "segments": [{"text": "What can you see in the picture?", "kind": "question"}], "seed": 7, "format": "mp3"}).encode()
for n in (1, 2):
    req = urllib.request.Request(base + "/synthesize", data=body, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=1800) as r:
            data = r.read()
            print(f"percobaan {n}: {time.monotonic() - t0:.1f} detik, {len(data)} byte, device={r.headers.get('X-Kira-Device')}, sintesis={r.headers.get('X-Kira-Gen-Ms')} ms, suara={r.headers.get('X-Kira-Voice')}", flush=True)
            if n == 1:
                open("/tmp/selftest.mp3", "wb").write(data)
    except urllib.error.HTTPError as e:
        print(f"percobaan {n}: HTTP {e.code} {e.read().decode()[:300]}", flush=True)
        break
