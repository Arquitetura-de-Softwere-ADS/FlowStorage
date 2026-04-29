from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError


SECRET_KEY = "troque-essa-chave-depois"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)


def gerar_hash_senha(password: str):
    return pwd_context.hash(password)


def verificar_senha(password: str, password_hash: str):
    return pwd_context.verify(password, password_hash)


def criar_token_acesso(data: dict):
    dados = data.copy()

    expiracao = datetime.now(timezone.utc) + timedelta(
        minutes=ACCESS_TOKEN_EXPIRE_MINUTES
    )

    dados.update({"exp": expiracao})

    token = jwt.encode(dados, SECRET_KEY, algorithm=ALGORITHM)

    return token


def verificar_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload

    except JWTError:
        return None