import json
import subprocess
import sys
from pathlib import Path


def test_uvicorn_logs_unexpected_and_response_validation_errors_once(
    tmp_path: Path,
) -> None:
    # 별도 프로세스의 실제 Uvicorn HTTP 서버로 서버 경계의 원인 로그를 확인.
    script = """
import asyncio
import json
import socket
import sys

import httpx
import uvicorn

from app.core.config import Settings
from app.main import create_app
from app.schemas.health import HealthResponse


async def main():
    app = create_app(Settings(_env_file=None, database_url=sys.argv[1]))

    @app.get('/unexpected')
    async def unexpected():
        raise RuntimeError('private-runtime-input')

    @app.get('/invalid-response', response_model=HealthResponse)
    async def invalid_response():
        return {'status': 'private-response-input'}

    ready = asyncio.Event()

    class ReadyServer(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            ready.set()

    server = ReadyServer(uvicorn.Config(app, access_log=False, log_level='error'))
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
        async with asyncio.timeout(10):
            serving = asyncio.create_task(server.serve(sockets=[listener]))
            try:
                await ready.wait()
                assert server.started
                async with httpx.AsyncClient(base_url=f'http://127.0.0.1:{port}') as client:
                    for path in ('/unexpected', '/invalid-response'):
                        response = await client.get(path)
                        print(json.dumps({'status': response.status_code, 'body': response.json()}))
            finally:
                server.should_exit = True
                await serving


asyncio.run(main())
"""
    result = subprocess.run(
        [sys.executable, "-c", script, f"sqlite:///{tmp_path}/logging.sqlite3"],
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert result.returncode == 0, result.stderr
    responses = [json.loads(line) for line in result.stdout.splitlines()]
    assert len(responses) == 2
    for response in responses:
        assert response["status"] == response["body"]["status"] == 500
        assert response["body"]["code"] == "INTERNAL_SERVER_ERROR"
        assert response["body"]["errors"] == []
    assert "private-runtime-input" not in result.stdout
    assert "private-response-input" not in result.stdout
    assert result.stderr.count("Exception in ASGI application") == 2
    assert result.stderr.count("RuntimeError: private-runtime-input") == 1
    assert result.stderr.count("ResponseValidationError:") == 1
    assert "in unexpected" in result.stderr
    assert "in serialize_response" in result.stderr
