"""Unduh bobot model suara sekali ke volume model (HF_HOME). Dijalankan lewat:
    docker compose --profile tts-setup run --rm tts-fetch
Layanan tts sendiri berjalan tanpa internet (HF_HUB_OFFLINE=1) dan hanya membaca volume ini.
Argumen opsional: "design" atau "custom" untuk mengunduh satu model saja.
"""

import sys

from huggingface_hub import snapshot_download

import engine

styles = engine.load_styles()
wanted = sys.argv[1:] or sorted(styles["models"].keys())
for kind in wanted:
    repo = styles["models"][kind]
    print(f"mengunduh {repo} ...", flush=True)
    path = snapshot_download(repo_id=repo)
    print(f"selesai: {path}", flush=True)
print("semua model siap", flush=True)
