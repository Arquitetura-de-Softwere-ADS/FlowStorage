from fastapi import FastAPI

from app.database import Base, engine
from app.routes import router as auth_router
from fastapi.middleware.cors import CORSMiddleware


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Auth Service",
    description="Microserviço de autenticação",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 🔥 pode liberar tudo (dev)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "Auth Service rodando"}


app.include_router(auth_router)