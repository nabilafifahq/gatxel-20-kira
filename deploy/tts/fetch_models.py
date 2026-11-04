"""Unduh bobot model suara sekali ke volume model (HF_HOME). Dijalankan lewat:
    docker compose --profile tts-setup run --rm tts-fetch
Layanan tts sendiri berjalan tanpa internet (HF_HUB_OFFLINE=1) dan hanya membaca volume ini.
Argumen opsional: "kokoro" atau "whisper" untuk mengunduh satu model saja.
"""

import sys

from huggingface_hub import snapshot_download

import engine

styles = engine.load_styles()
models = {**styles["models"], **styles.get("checker", {})}  # checker: Whisper untuk check_clips.py
wanted = sys.argv[1:] or sorted(models.keys())
for kind in wanted:
    repo = models[kind]
    print(f"mengunduh {repo} ...", flush=True)
    path = snapshot_download(repo_id=repo)
    print(f"selesai: {path}", flush=True)
print("semua model siap", flush=True)
