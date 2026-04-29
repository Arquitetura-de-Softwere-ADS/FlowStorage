from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Sale, SaleItem
from app.schemas import SaleCreate, SaleResponse

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post("/", response_model=SaleResponse)
def create_sale(data: SaleCreate, db: Session = Depends(get_db)):

    total = 0

    for item in data.items:
        total += item.quantity * item.price

    sale = Sale(total=total)

    db.add(sale)
    db.commit()
    db.refresh(sale)

    for item in data.items:
        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item.product_id,
            quantity=item.quantity,
            price=item.price
        )

        db.add(sale_item)

    db.commit()

    return sale