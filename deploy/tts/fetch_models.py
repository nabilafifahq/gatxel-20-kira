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
wanted = sys.argv[1:] or sorted([*models.keys(), "piper"])
for kind in wanted:
    if kind == "piper":
        # Suara Inggris Piper (en_US-lessac-medium, sama dengan suara en di server Gatxel): dua berkas.
        from huggingface_hub import hf_hub_download

        for f in styles["piper"]["files"]:
            print(f"mengunduh {styles['piper']['repo']}/{f} ...", flush=True)
            print("selesai:", hf_hub_download(styles["piper"]["repo"], f), flush=True)
        continue
    repo = models[kind]
    print(f"mengunduh {repo} ...", flush=True)
    path = snapshot_download(repo_id=repo)
    print(f"selesai: {path}", flush=True)
print("semua model siap", flush=True)
