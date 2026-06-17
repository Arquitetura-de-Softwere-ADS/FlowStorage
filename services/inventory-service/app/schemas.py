from pydantic import BaseModel, Field, StrictBool
from typing import Optional
from app.models import CategoriaEnum


# O que o usuário envia para cadastrar
class ProdutoCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=100)
    sku: str = Field(..., min_length=3)
    categoria: CategoriaEnum
    preco: float = Field(..., gt=0) # Deve ser maior que 0
    estoque: int = Field(default=0, ge=0) # Deve ser maior ou igual a 0
    minimo: int = Field(default=5, ge=0)
    fornecedor: Optional[str] = Field(default=None, max_length=100)

class ProdutoResponse(ProdutoCreate):
    id: int
    auto_reorder_enabled: bool = False

    class Config:
        from_attributes = True # Permite que o Pydantic leia dados do SQLAlchemy


class AutoReorderUpdate(BaseModel):
    enabled: StrictBool


class AutoReorderResponse(BaseModel):
    product_id: int
    auto_reorder_enabled: bool
