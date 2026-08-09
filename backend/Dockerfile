FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/server/ /app/server/
COPY contracts/ /app/contracts/
COPY frontend/ /app/frontend/

EXPOSE 8000
CMD ["python", "server/app.py"]
