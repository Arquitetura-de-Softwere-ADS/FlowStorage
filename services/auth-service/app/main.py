from fastapi import FastAPI

from app.database import Base, engine
from app.routes import router as auth_router


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Auth Service",
    description="Microserviço de autenticação",
    version="1.0.0"
)


@app.get("/")
def home():
    return {"message": "Auth Service rodando"}


app.include_router(auth_router)