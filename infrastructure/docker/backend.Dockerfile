FROM python:3.12-slim@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1
WORKDIR /app
COPY pyproject.toml ./
COPY services ./services
COPY alembic.ini ./
COPY apps/desktop ./apps/desktop
RUN pip install --no-cache-dir '.[cloud]'
RUN useradd --create-home flowdrop
USER flowdrop
EXPOSE 8000
CMD ["uvicorn","services.signaling.app:app","--host","0.0.0.0","--port","8000","--no-access-log","--ws-max-size","131072","--limit-concurrency","256","--no-proxy-headers"]
