import datetime
import enum

from sqlalchemy import Column, DateTime, Integer, String, Enum
from app.database import Base


class StatusPedido(enum.Enum):
    RECEBIDO = "Recebido"
    PENDENTE = "Pendente"
    CANCELADO = "Cancelado"


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, nullable=False)
    produto_nome = Column(String)
    fornecedor = Column(String, nullable=False)
    quantidade = Column(Integer, nullable=False)
    status = Column(Enum(StatusPedido), default=StatusPedido.PENDENTE, nullable=False)
    data = Column(DateTime, default=datetime.datetime.utcnow)