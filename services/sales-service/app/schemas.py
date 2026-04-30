from pydantic import BaseModel, Field
from typing import List
from datetime import datetime


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)


class SaleCreate(BaseModel):
    items: List[SaleItemCreate]


class SaleItemResponse(BaseModel):
    product_id: int
    quantity: int
    price: float

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    total: float
    created_at: datetime
    items: List[SaleItemResponse]

    class Config:
        from_attributes = True