import json
import os
import time
from typing import Any

import pika
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Notification, ProcessedEvent, Subscription


RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "flowstorage.events")
RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "notification-service.stock")
RABBITMQ_ROUTING_KEYS = os.getenv(
    "RABBITMQ_ROUTING_KEYS",
    "sales.created,stock.updated,stock.increased,stock.decreased,replacement.received,stock.low,stock.critical",
)
GLOBAL_NOTIFICATION_USER_ID = int(os.getenv("GLOBAL_NOTIFICATION_USER_ID", "1"))
CRITICAL_EVENTS = {"stock.low", "stock.critical"}


def log(message: str):
    print(f"[notification-service] {message}", flush=True)


def get_connection_parameters():
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
    return pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        credentials=credentials,
        connection_attempts=3,
        retry_delay=2,
        socket_timeout=5,
        heartbeat=600,
        blocked_connection_timeout=300,
    )


def get_routing_keys() -> list[str]:
    return [
        routing_key.strip()
        for routing_key in RABBITMQ_ROUTING_KEYS.split(",")
        if routing_key.strip()
    ]


def get_first_value(event: dict[str, Any], *keys: str):
    for key in keys:
        value = event.get(key)
        if value is not None:
            return value
    return None


def get_product_name(event: dict[str, Any]) -> str:
    product_id = event.get("product_id")
    return event.get("product_name") or f"Produto {product_id}"


def build_notification_text(event: dict[str, Any], event_type: str) -> tuple[str, str]:
    product_name = get_product_name(event)
    current_stock = get_first_value(event, "current_stock", "current_quantity")
    previous_stock = get_first_value(event, "previous_stock", "previous_quantity")
    minimum_stock = event.get("minimum_stock")
    quantity_delta = event.get("quantity_delta")
    quantity_sold = event.get("quantity_sold")
    quantity_received = event.get("quantity_received")

    if event_type == "sales.created":
        title = "Venda realizada"
        message = (
            f"Foram vendidas {quantity_sold} unidades do produto {product_name}. "
            f"Estoque atual: {current_stock}."
        )
        return title, message

    if event_type == "replacement.received":
        title = "Reposição recebida"
        message = (
            f"O pedido de reposição do produto {product_name} foi recebido. "
            f"Foram adicionadas {quantity_received} unidades. "
            f"Estoque atual: {current_stock}."
        )
        return title, message

    if event_type in CRITICAL_EVENTS:
        title = "Estoque crítico"
        message = (
            f"O produto {product_name} está em estado crítico. "
            f"Quantidade atual: {current_stock}. "
            f"Mínimo recomendado: {minimum_stock}."
        )
        return title, message

    if event_type == "stock.updated":
        title = "Estoque atualizado"
        message = (
            f"O estoque do produto {product_name} foi atualizado. "
            f"Quantidade atual: {current_stock}."
        )
        return title, message

    details = []
    if previous_stock is not None:
        details.append(f"Estoque anterior: {previous_stock}.")
    if current_stock is not None:
        details.append(f"Quantidade atual: {current_stock}.")

    if event_type == "stock.increased":
        title = "Estoque aumentado"
        if isinstance(quantity_delta, int) and quantity_delta > 0:
            base_message = (
                f"Foram adicionadas {quantity_delta} unidades ao produto {product_name}."
            )
        else:
            base_message = f"O estoque do produto {product_name} aumentou."
    elif event_type == "stock.decreased":
        title = "Estoque diminuído"
        if isinstance(quantity_delta, int) and quantity_delta < 0:
            base_message = (
                f"Foram removidas {abs(quantity_delta)} unidades do produto {product_name}."
            )
        else:
            base_message = f"O estoque do produto {product_name} diminuiu."
    else:
        title = "Alteração de estoque"
        base_message = f"O produto {product_name} recebeu uma alteração de estoque."

    return title, " ".join([base_message, *details])


def get_notification_user_ids(db: Session, product_id: int, event_type: str) -> set[int]:
    if event_type in CRITICAL_EVENTS:
        return {GLOBAL_NOTIFICATION_USER_ID}

    subscriptions = (
        db.query(Subscription)
        .filter(
            Subscription.product_id == product_id,
            Subscription.user_id == GLOBAL_NOTIFICATION_USER_ID,
        )
        .all()
    )
    return {subscription.user_id for subscription in subscriptions}


def mark_event_processed(db: Session, event_id: str | None, event_type: str):
    if event_id:
        db.add(ProcessedEvent(event_id=event_id, event_type=event_type))


def process_event(event: dict[str, Any], event_type: str):
    product_id = event.get("product_id")
    event_id = event.get("event_id")

    db = SessionLocal()
    try:
        if event_id:
            processed_event = (
                db.query(ProcessedEvent)
                .filter(ProcessedEvent.event_id == event_id)
                .first()
            )
            if processed_event:
                log(f"Evento duplicado ignorado: {event_id}")
                return

        if product_id is None:
            log("Evento ignorado: product_id não informado")
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        user_ids = get_notification_user_ids(db, int(product_id), event_type)

        if not user_ids:
            if event_type in CRITICAL_EVENTS:
                log(f"Evento crítico sem usuário global configurado para produto {product_id}")
            else:
                log(
                    f"Evento {event_type} ignorado para produto {product_id}: "
                    "sininho desativado"
                )
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        log(
            f"Evento {event_type} para produto {product_id}: "
            f"{len(user_ids)} usuário(s) notificado(s)"
        )

        title, message = build_notification_text(event, event_type)

        for user_id in sorted(user_ids):
            notification = Notification(
                user_id=user_id,
                product_id=int(product_id),
                title=title,
                message=message,
                event_type=event_type,
                read=False,
            )
            db.add(notification)
            log(f"Notificação criada para o usuário {user_id}")

        mark_event_processed(db, event_id, event_type)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def handle_stock_event(channel, method, properties, body):
    try:
        event = json.loads(body.decode("utf-8"))
        event_type = event.get("event") or method.routing_key
        log(f"Evento recebido: {event_type}")
        process_event(event, event_type)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as exc:
        log(f"Erro ao processar evento: {exc}")
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)


def start_consumer():
    while True:
        try:
            connection = pika.BlockingConnection(get_connection_parameters())
            channel = connection.channel()
            channel.exchange_declare(
                exchange=RABBITMQ_EXCHANGE,
                exchange_type="topic",
                durable=True,
            )
            channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)

            for routing_key in get_routing_keys():
                channel.queue_bind(
                    exchange=RABBITMQ_EXCHANGE,
                    queue=RABBITMQ_QUEUE,
                    routing_key=routing_key,
                )

            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(
                queue=RABBITMQ_QUEUE,
                on_message_callback=handle_stock_event,
            )

            log("Conectado ao RabbitMQ")
            log("Aguardando eventos de estoque")
            channel.start_consuming()
        except Exception as exc:
            log(f"RabbitMQ indisponível ou conexão perdida: {exc}")
            time.sleep(5)
