FROM python:3.13-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY server/ /app/server/
COPY admin.html app.js index.html demo.js styles.css /app/
COPY assets/ /app/assets/
COPY vendor/ /app/vendor/

EXPOSE 8000
CMD ["python", "server/app.py"]
