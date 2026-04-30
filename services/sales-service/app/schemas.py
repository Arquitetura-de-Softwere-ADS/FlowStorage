from pydantic import BaseModel
from typing import List


class SaleItemResponse(BaseModel):
    product_id: int
    quantity: int
    price: float

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    total: float
    created_at: str
    items: List[SaleItemResponse]

    class Config:
        from_attributes = True