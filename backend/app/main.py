"""
FastAPI app for the מלש"ביה dashboard. Every route is mounted under /api, matching the
frontend's VITE_API_BASE_URL. Interactive docs: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .db import Base, engine
from .routers import dashboard, reports, users

app = FastAPI(title='מלש"ביה API', version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (dashboard.router, reports.router, users.router):
    app.include_router(router, prefix="/api")

# Creates missing tables on start (handy for SQLite). With a real database, prefer migrations (e.g. Alembic).
Base.metadata.create_all(engine)


@app.get("/api/health")
def health():
    return {"ok": True}
