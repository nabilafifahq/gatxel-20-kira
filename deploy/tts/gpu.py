"""Memori GPU yang masih kosong, dibaca lewat NVML tanpa membuat konteks CUDA.

Konteks CUDA sendiri memakan beberapa ratus MiB. Di GPU yang hampir penuh (dipakai program lain) kita tidak
boleh membuatnya hanya untuk bertanya. NVML (paket nvidia-ml-py, atau perintah nvidia-smi) cukup untuk itu.
Mengembalikan None bila GPU atau NVML tidak terlihat (misalnya kontainer berjalan di CPU).
"""

from __future__ import annotations

import shutil
import subprocess


def gpu_free_mib(index: int = 0) -> int | None:
    try:
        import pynvml

        pynvml.nvmlInit()
        try:
            info = pynvml.nvmlDeviceGetMemoryInfo(pynvml.nvmlDeviceGetHandleByIndex(index))
            return int(info.free) // (1024 * 1024)
        finally:
            pynvml.nvmlShutdown()
    except Exception:  # noqa: BLE001 - tanpa NVML dicoba nvidia-smi
        pass
    smi = shutil.which("nvidia-smi")
    if not smi:
        return None
    try:
        out = subprocess.run(
            [smi, "--query-gpu=memory.free", "--format=csv,noheader,nounits", f"--id={index}"],
            capture_output=True, text=True, timeout=10, check=False,
        )
        return int(out.stdout.strip().splitlines()[0]) if out.returncode == 0 and out.stdout.strip() else None
    except Exception:  # noqa: BLE001
        return None
