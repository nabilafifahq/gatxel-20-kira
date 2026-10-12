#!/bin/sh
# Sertifikat TLS lokal untuk Postgres (sslmode verify-full di dalam jaringan Docker).
# Dijalankan layanan "certs" sebelum db. Membuat CA baru dan sertifikat server untuk nama host "db"
# bila belum ada atau tinggal kurang dari 30 hari. Kunci CA tidak disimpan setelah menandatangani.
#   /tls/server.crt, /tls/server.key  dipakai db (pemilik uid 999 = postgres di image resmi)
#   /ca/ca.crt                         dipakai web, worker, backup untuk memverifikasi server
set -eu

# Folder data dipakai web dan worker sebagai user node (uid 1000). Di Linux, folder bind mount baru
# milik root; di Windows (Docker Desktop) chown tidak berpengaruh dan diabaikan.
if [ -d /data ]; then
  mkdir -p /data/media /data/apk
  chown 1000:1000 /data /data/media /data/apk 2>/dev/null || true
fi

apk add --no-cache openssl >/dev/null

if [ -f /tls/server.crt ] && openssl x509 -checkend 2592000 -noout -in /tls/server.crt >/dev/null 2>&1 && [ -f /ca/ca.crt ]; then
  echo "Sertifikat database masih berlaku."
  exit 0
fi

work=$(mktemp -d)
cd "$work"
openssl req -x509 -newkey rsa:3072 -nodes -days 3650 -subj "/CN=Kira Local CA" -keyout ca.key -out ca.crt >/dev/null 2>&1
openssl req -newkey rsa:3072 -nodes -subj "/CN=db" -keyout server.key -out server.csr >/dev/null 2>&1
printf 'subjectAltName=DNS:db,DNS:localhost\nextendedKeyUsage=serverAuth\n' > ext.cnf
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 -extfile ext.cnf -out server.crt >/dev/null 2>&1

cp server.crt /tls/server.crt
cp server.key /tls/server.key
chown 999:999 /tls/server.crt /tls/server.key
chmod 600 /tls/server.key
chmod 644 /tls/server.crt
cp ca.crt /ca/ca.crt
chmod 644 /ca/ca.crt
rm -rf "$work"
echo "Sertifikat database baru dibuat (berlaku 825 hari). Mulai ulang web, worker, dan backup bila sudah berjalan."
