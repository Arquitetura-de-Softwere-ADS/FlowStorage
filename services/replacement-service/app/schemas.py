from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

class PedidoBase(BaseModel):
    produto_id: int = Field(..., gt=0, description="ID do produto vindo do Inventário")
    fornecedor: str = Field(..., min_length=2, max_length=100)
    quantidade: int = Field(..., gt=0, le=1000, description="Quantidade entre 1 e 1000")

class PedidoCreate(PedidoBase):
    pass

class PedidoResponse(PedidoBase):
    id: int
    produto_nome: str
    status: str
    data: datetime

    class Config:
        from_attributes = True
