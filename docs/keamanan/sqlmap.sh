#!/bin/sh
# sqlmap terhadap instance LOKAL Kira (bukan kira.gatxel.com). Dijalankan di dalam container python:3.12-slim.
# Pakai dari host:
#   docker run --rm -v "$PWD/docs/keamanan:/out" -v "$PWD/docs/keamanan/sqlmap.sh:/run.sh:ro" \
#     -e TARGET=http://<IP-LAN-komputer-ini>:3136 -e TUTOR_TOKEN=... -e LEARNER_TOKEN=... python:3.12-slim sh /run.sh
# Token sesi dibuat di database lokal (lihat docs/keamanan/README bagian pemindaian). Tidak ada rahasia produksi.
set -u
pip install --quiet --no-cache-dir sqlmap >/dev/null 2>&1
: "${TARGET:?}" "${TUTOR_TOKEN:?}" "${LEARNER_TOKEN:?}"
OUT=/out/sqlmap-hasil.txt
: > "$OUT"
S="sqlmap --batch --level=3 --risk=2 --random-agent --flush-session --threads=1 --timeout=20 --retries=1 --time-sec=6 --output-dir=/tmp/sqlmap"
run() {
  name="$1"; shift
  echo "=== $name ===" | tee -a "$OUT"
  timeout 420 $S "$@" 2>&1 | grep -E "^\[.*\] \[(INFO|WARNING|CRITICAL)\]|is vulnerable|not injectable|injectable|Parameter:|all tested parameters" | grep -vE "testing '|checking if|heuristic \(basic\)" | tail -25 | tee -a "$OUT"
}
HOST_HDR="Cookie: __Host-kira.session=$LEARNER_TOKEN"
TUTOR_HDR="Cookie: __Host-kira.session=$TUTOR_TOKEN"
# Server Action masuk: [email, password, next]
run "passwordLoginAction (email, password)" -u "$TARGET/masuk" --method=POST \
  --data='["a@b.co*","salah-salah-1*",null]' --headers="Next-Action: 40654aa357b5489143990eff8be001685f057d13f7
Content-Type: text/plain;charset=UTF-8
Accept: text/x-component" --delay=0.55
run "requestResetAction (email)" -u "$TARGET/masuk" --method=POST --data='["a@b.co*"]' \
  --headers="Next-Action: 40be07c06d2bb223e3ca0eb59a035b7b4f8bdb1987
Content-Type: text/plain;charset=UTF-8
Accept: text/x-component" --delay=1.5
run "POST /api/sync (JSON, learner)" -u "$TARGET/api/sync" --method=POST --headers="$HOST_HDR
Content-Type: application/json" \
  --data='{"answers":[],"submits":[{"attemptId":"00000000-0000-4000-8000-000000000000*","clientId":"c1*"}]}' --delay=1
run "POST /api/tts/request (JSON, learner)" -u "$TARGET/api/tts/request" --method=POST --headers="$HOST_HDR
Content-Type: application/json" --data='{"clips":[{"text":"hello*","style":"normal"}]}' --delay=1
run "GET /api/media/{id} (learner)" -u "$TARGET/api/media/00000000-0000-4000-8000-000000000000*" --headers="$HOST_HDR" --delay=0.2
run "GET /tts/{file}" -u "$TARGET/tts/abc*.mp3" --headers="$HOST_HDR" --delay=0.2
run "GET /konsol/learner/{id} (tutor)" -u "$TARGET/konsol/learner/00000000-0000-4000-8000-000000000000*" --headers="$TUTOR_HDR" --delay=0.2
run "GET /masuk?next= (publik)" -u "$TARGET/masuk?next=a*" --delay=0.2
run "POST /api/internal/weekly-report (header Authorization)" -u "$TARGET/api/internal/weekly-report" --method=POST \
  --headers="Authorization: Bearer abcdefabcdefabcdefabcdefabcdefabcdefabcdef*
Content-Type: application/json" --data='{}' --delay=0.5
echo "SELESAI" | tee -a "$OUT"
