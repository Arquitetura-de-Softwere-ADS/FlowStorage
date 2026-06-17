from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Sale, SaleItem
from app.schemas import SaleCreate, SaleResponse
from app.grpc.client import get_product, decrease_stock
from app.messaging import publish_sale_created


router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("/", response_model=list[SaleResponse])
def list_sales(db: Session = Depends(get_db)):
    return db.query(Sale).all()


@router.post("/", response_model=SaleResponse)
def create_sale(data: SaleCreate, db: Session = Depends(get_db)):

    total = 0
    items_to_save = []

    for item in data.items:
        product = get_product(item.product_id)

        if not product.found:
            raise HTTPException(
                status_code=404,
                detail=f"Produto {item.product_id} não encontrado"
            )

        if product.estoque < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente para o produto {product.nome}"
            )

        subtotal = product.preco * item.quantity
        total += subtotal

        items_to_save.append({
            "product_id": product.id,
            "product_name": product.nome,
            "quantity": item.quantity,
            "price": product.preco
        })

    sale = Sale(total=total)

    db.add(sale)
    db.commit()
    db.refresh(sale)

    sale_events = []

    for item in items_to_save:
        stock_response = decrease_stock(
            item["product_id"],
            item["quantity"]
        )

        if not stock_response.success:
            raise HTTPException(
                status_code=400,
                detail=stock_response.message
            )

        sale_events.append({
            "sale_id": sale.id,
            "product_id": item["product_id"],
            "product_name": item["product_name"],
            "quantity_sold": item["quantity"],
            "current_stock": stock_response.current_stock,
            "created_at": sale.created_at,
        })

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=item["product_id"],
            quantity=item["quantity"],
            price=item["price"]
        )

        db.add(sale_item)

    db.commit()

    for event in sale_events:
        publish_sale_created(**event)

    return sale
