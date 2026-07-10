# Chefsprint engine — FastAPI + Playwright (Chromium) on Cloud Run.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PORT=8080

WORKDIR /app

# Install the package + its deps, the Chromium browser (with OS deps), and the
# NLTK data the ingredient parser needs — all baked into the image.
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip \
    && pip install . \
    && python -m playwright install --with-deps chromium \
    && python -c "import ssl, certifi, nltk; ssl._create_default_https_context=lambda *a,**k: ssl.create_default_context(cafile=certifi.where()); nltk.download('averaged_perceptron_tagger_eng'); nltk.download('punkt_tab')"

EXPOSE 8080
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
