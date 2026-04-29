from pydantic import BaseModel
from typing import List


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int
    price: float


class SaleCreate(BaseModel):
    items: List[SaleItemCreate]


class SaleResponse(BaseModel):
    id: int
    total: float

    class Config:
        from_attributes = True