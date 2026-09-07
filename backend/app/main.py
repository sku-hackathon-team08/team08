from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Team 08 API")


class HealthResponse(BaseModel):
    status: Literal["ok"]


@app.get("/health", response_model=HealthResponse, tags=["health"])
async def health() -> HealthResponse:
    """Return application liveness; external dependencies are not checked."""
    return HealthResponse(status="ok")
