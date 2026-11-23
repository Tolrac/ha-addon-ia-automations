FROM python:3.13-alpine

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir aiohttp pyyaml

WORKDIR /app
COPY app /app

CMD ["python3", "-u", "/app/server.py"]
