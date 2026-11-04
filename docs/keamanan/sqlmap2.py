#!/usr/bin/env python3
"""sqlmap terhadap stack LOKAL kirasec lewat proxy (bukan kira.gatxel.com).

Daftar target ada di /out/targets.json (dibuat dari manifest Server Action build yang sedang jalan, berisi token sesi
uji sekali pakai, tidak masuk git). Setiap target dibatasi waktunya supaya PC bersama tidak terbebani.

Pakai:
  docker run --rm --network kirasec_egress -v <folder-hasil>:/out -v "$PWD/docs/keamanan/sqlmap2.py:/run.py:ro" \
    -e PER_TARGET=90 -e WORKERS=3 python:3.12-slim sh -c "pip install --quiet sqlmap && python /run.py"
"""
import concurrent.futures
import json
import os
import re
import subprocess
import threading

PER_TARGET = int(os.environ.get("PER_TARGET", "90"))
WORKERS = int(os.environ.get("WORKERS", "3"))
targets = json.load(open("/out/targets.json", encoding="utf8"))
lock = threading.Lock()
out = open("/out/sqlmap-hasil2.txt", "a", encoding="utf8")
KEEP = re.compile(r"is vulnerable|not injectable|injectable|Parameter:|all tested parameters|might be|CRITICAL|does not seem", re.I)


def run(t):
    cmd = ["timeout", str(PER_TARGET), "sqlmap", "--batch", "--level=2", "--risk=1", "--technique=BT", "--time-sec=3", "--timeout=15", "--retries=1", "--threads=1", "--delay=0.05", "--flush-session", "--random-agent", "--output-dir=/tmp/sqlmap", "-u", t["url"]]
    headers = list(t.get("headers", []))
    headers.append("CF-Connecting-IP: 10.201.0.%d" % (hash(t["name"]) % 250 + 1))
    if t.get("data") is not None:
        cmd += ["--method=POST", "--data=" + t["data"]]
    cmd += ["--headers=" + "\n".join(headers)]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=PER_TARGET + 20)
        text = p.stdout
        code = p.returncode
    except subprocess.TimeoutExpired as e:
        text = (e.stdout or b"").decode("utf8", "replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
        code = 124
    lines = [re.sub(r"[0-9a-f]{64}", "<token>", l) for l in text.splitlines() if KEEP.search(l)]
    hit = any("is vulnerable" in l or re.search(r"parameter '.*' is '.*' injectable", l) for l in lines)
    verdict = "TEMUAN" if hit else ("batas waktu tercapai, tanpa temuan" if code == 124 else "tanpa temuan")
    with lock:
        out.write(f"=== {t['name']} [{verdict}] exit {code}\n")
        for l in lines[-6:]:
            out.write("  " + l[:220] + "\n")
        out.flush()
        print(t["name"], verdict, flush=True)


with concurrent.futures.ThreadPoolExecutor(WORKERS) as ex:
    list(ex.map(run, targets))
with lock:
    out.write("SELESAI\n")
    out.flush()
print("SQLMAPDONE", flush=True)
