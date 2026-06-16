from threading import Thread

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import engine, get_db
from app.messaging import start_consumer


models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Notification Service",
    description="Microserviço assinante de eventos de estoque",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    consumer_thread = Thread(target=start_consumer, daemon=True)
    consumer_thread.start()


@app.get("/")
def home():
    return {"message": "Notification Service rodando"}


@app.post("/subscriptions", response_model=schemas.SubscriptionResponse)
def create_subscription(
    subscription: schemas.SubscriptionCreate,
    db: Session = Depends(get_db),
):
    existing_subscription = (
        db.query(models.Subscription)
        .filter(
            models.Subscription.user_id == subscription.user_id,
            models.Subscription.product_id == subscription.product_id,
        )
        .first()
    )

    if existing_subscription:
        raise HTTPException(
            status_code=400,
            detail="Usuário já monitora este produto",
        )

    new_subscription = models.Subscription(**subscription.model_dump())
    db.add(new_subscription)
    db.commit()
    db.refresh(new_subscription)
    return new_subscription


@app.get("/subscriptions/{user_id}", response_model=list[schemas.SubscriptionResponse])
def list_subscriptions(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Subscription)
        .filter(models.Subscription.user_id == user_id)
        .order_by(models.Subscription.created_at.desc())
        .all()
    )


@app.delete("/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int, db: Session = Depends(get_db)):
    subscription = (
        db.query(models.Subscription)
        .filter(models.Subscription.id == subscription_id)
        .first()
    )

    if not subscription:
        raise HTTPException(status_code=404, detail="Inscrição não encontrada")

    db.delete(subscription)
    db.commit()
    return {"mensagem": "Inscrição removida com sucesso"}


@app.get("/notifications/{user_id}", response_model=list[schemas.NotificationResponse])
def list_notifications(user_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == user_id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )


@app.patch(
    "/notifications/{notification_id}/read",
    response_model=schemas.NotificationResponse,
)
def mark_notification_as_read(notification_id: int, db: Session = Depends(get_db)):
    notification = (
        db.query(models.Notification)
        .filter(models.Notification.id == notification_id)
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")

    notification.read = True
    db.commit()
    db.refresh(notification)
    return notification
