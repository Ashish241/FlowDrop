FROM python:3.12-slim
WORKDIR /app
COPY pyproject.toml ./
COPY services ./services
COPY alembic.ini ./
COPY apps/desktop ./apps/desktop
RUN pip install --no-cache-dir '.[cloud]'
RUN useradd --create-home flowdrop
USER flowdrop
EXPOSE 8000
CMD ["uvicorn","services.signaling.app:app","--host","0.0.0.0","--port","8000","--no-access-log"]
