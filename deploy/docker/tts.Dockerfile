# syntax=docker/dockerfile:1.7
# Layanan suara Kira: Qwen3-TTS 1.7B (VoiceDesign dan CustomVoice) di Python 3.12. Dibangun dari root repo:
#   docker compose --profile tts build tts
# Satu image untuk GPU NVIDIA dan CPU. Roda torch memakai indeks CUDA 12.8 (cocok untuk RTX 50xx, Blackwell)
# secara default; di mesin tanpa GPU image yang sama berjalan di CPU. Untuk image CPU yang lebih kecil:
#   TTS_TORCH_INDEX=https://download.pytorch.org/whl/cpu
FROM python:3.12-slim-bookworm

ARG TORCH_INDEX=https://download.pytorch.org/whl/cu128
ENV PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 PYTHONUNBUFFERED=1 HF_HOME=/models TOKENIZERS_PARALLELISM=false

# ffmpeg: penyandi mp3. sox dan libsndfile: dibutuhkan paket audio qwen-tts.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg sox libsndfile1 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN pip install torch torchaudio --index-url "${TORCH_INDEX}"
COPY deploy/tts/requirements.txt /tmp/requirements.txt
RUN pip install -U -r /tmp/requirements.txt

# Bobot model (sekitar 9 GB untuk dua model) ada di volume /models, bukan di image.
RUN useradd --system --uid 10001 --create-home kira \
 && mkdir -p /models \
 && chown kira:kira /models
WORKDIR /app/tts
COPY --chown=kira:kira deploy/tts/ ./
USER kira
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)"
CMD ["python", "server.py"]
