FROM python:3.12-slim

WORKDIR /workspace
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    QWENPAW_WORKFLOW_EXECUTOR=fixture \
    QWENPAW_HOST=0.0.0.0 \
    QWENPAW_PORT=8000 \
    HERITAGE_WORKFLOW_CONTRACT=/workspace/packages/contracts/heritage-workflow.openapi.yaml

COPY services/api/server/ /workspace/services/api/server/
COPY packages/contracts/ /workspace/packages/contracts/
COPY fixtures/ /workspace/fixtures/

EXPOSE 8000
CMD ["python", "/workspace/services/api/server/app.py"]
