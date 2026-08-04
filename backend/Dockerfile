FROM python:3.13-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/server/ /app/server/
COPY frontend/ /app/frontend/

EXPOSE 8000
CMD ["python", "server/app.py"]
