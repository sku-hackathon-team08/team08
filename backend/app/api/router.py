from fastapi import APIRouter

from app.api.routes.activity import router as activity_router
from app.api.routes.analyses import router as analyses_router
from app.api.routes.demo_maps import router as demo_maps_router
from app.api.routes.entry import router as entry_router
from app.api.routes.health import router as health_router
from app.api.routes.reports import router as reports_router

api_router = APIRouter()
api_router.include_router(health_router)

api_router.include_router(demo_maps_router)

api_router.include_router(entry_router)

api_router.include_router(analyses_router)

api_router.include_router(reports_router)

api_router.include_router(activity_router)
