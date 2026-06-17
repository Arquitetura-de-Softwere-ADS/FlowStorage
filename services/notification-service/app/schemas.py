from datetime import datetime

from pydantic import BaseModel, Field


class SubscriptionCreate(BaseModel):
    user_id: int = Field(..., gt=0)
    product_id: int = Field(..., gt=0)


class SubscriptionResponse(SubscriptionCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    title: str
    message: str
    event_type: str
    read: bool
    created_at: datetime

    class Config:
        from_attributes = True
