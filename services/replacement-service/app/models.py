import datetime
import enum

from sqlalchemy import Column, DateTime, Integer, String, Enum
from app.database import Base


class StatusPedido(enum.Enum):
    RECEBIDO = "Recebido"
    PENDENTE = "Pendente"
    CANCELADO = "Cancelado"


ORDER_ORIGIN_MANUAL = "MANUAL"
ORDER_ORIGIN_AUTOMATIC = "AUTOMATIC"


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    produto_id = Column(Integer, nullable=False)
    produto_nome = Column(String)
    fornecedor = Column(String, nullable=False)
    quantidade = Column(Integer, nullable=False)
    status = Column(Enum(StatusPedido), default=StatusPedido.PENDENTE, nullable=False)
    data = Column(DateTime, default=datetime.datetime.utcnow)
    origin = Column(
        String,
        default=ORDER_ORIGIN_MANUAL,
        server_default=ORDER_ORIGIN_MANUAL,
        nullable=False,
    )
    source_event_id = Column(String, unique=True, nullable=True, index=True)


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, nullable=False, index=True)
    event_type = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
