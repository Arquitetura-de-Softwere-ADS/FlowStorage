from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routes import router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sales Service")

# ✅ LIBERA CORS (ESSENCIAL)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # em produção troque pelo domínio do front
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)