import json
import os
import time
import uuid
from datetime import datetime
from typing import Any

import pika
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import (
    ORDER_ORIGIN_AUTOMATIC,
    Pedido,
    ProcessedEvent,
    StatusPedido,
)


RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "flowstorage.events")
RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "replacement-service.stock-low")
RABBITMQ_ROUTING_KEYS = os.getenv("RABBITMQ_ROUTING_KEYS", "stock.low")

OPEN_ORDER_STATUSES = [StatusPedido.PENDENTE]
ADVISORY_LOCK_NAMESPACE = 42041


def log(message: str):
    print(f"[replacement-service] {message}", flush=True)


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


def publish_event(routing_key: str, payload: dict[str, Any]):
    try:
        connection = pika.BlockingConnection(get_connection_parameters())
        channel = connection.channel()
        channel.exchange_declare(
            exchange=RABBITMQ_EXCHANGE,
            exchange_type="topic",
            durable=True,
        )
        channel.basic_publish(
            exchange=RABBITMQ_EXCHANGE,
            routing_key=routing_key,
            body=json.dumps(payload).encode("utf-8"),
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
            ),
        )
        connection.close()
        log(f"Evento publicado: {routing_key} para produto {payload['product_id']}")
    except Exception as exc:
        log(f"Não foi possível publicar evento {routing_key}: {exc}")


def publish_replacement_received(
    replacement_id: int,
    product_id: int,
    product_name: str,
    quantity_received: int,
    current_stock: int,
    received_at: datetime,
):
    publish_event(
        "replacement.received",
        {
            "event_id": str(uuid.uuid4()),
            "event": "replacement.received",
            "replacement_id": replacement_id,
            "product_id": product_id,
            "product_name": product_name,
            "quantity_received": quantity_received,
            "current_stock": current_stock,
            "current_quantity": current_stock,
            "received_at": received_at.isoformat(),
        },
    )


def get_first_value(event: dict[str, Any], *keys: str):
    for key in keys:
        value = event.get(key)
        if value is not None:
            return value
    return None


def parse_int(value: Any) -> int | None:
    try:
        if value is None:
            return None
        return int(value)
    except (TypeError, ValueError):
        return None


def is_auto_reorder_enabled(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "sim"}
    return False


def mark_event_processed(db: Session, event_id: str | None, event_type: str):
    if event_id:
        db.add(ProcessedEvent(event_id=event_id, event_type=event_type))


def event_was_processed(db: Session, event_id: str | None) -> bool:
    if not event_id:
        return False

    return (
        db.query(ProcessedEvent)
        .filter(ProcessedEvent.event_id == event_id)
        .first()
        is not None
    )


def acquire_product_lock(db: Session, product_id: int):
    db.execute(
        text("SELECT pg_advisory_xact_lock(:namespace, :product_id)"),
        {"namespace": ADVISORY_LOCK_NAMESPACE, "product_id": product_id},
    )


def get_open_order(db: Session, product_id: int) -> Pedido | None:
    return (
        db.query(Pedido)
        .filter(
            Pedido.produto_id == product_id,
            Pedido.status.in_(OPEN_ORDER_STATUSES),
        )
        .first()
    )


def resolve_supplier(db: Session, event: dict[str, Any], product_id: int) -> str | None:
    supplier = get_first_value(event, "fornecedor", "supplier")
    if supplier and str(supplier).strip():
        return str(supplier).strip()

    previous_order = (
        db.query(Pedido)
        .filter(Pedido.produto_id == product_id)
        .order_by(Pedido.data.desc())
        .first()
    )

    if previous_order and previous_order.fornecedor and previous_order.fornecedor.strip():
        return previous_order.fornecedor.strip()

    return None


def process_stock_low_event(event: dict[str, Any], event_type: str):
    event_id = event.get("event_id")
    product_id = parse_int(event.get("product_id"))

    db = SessionLocal()
    try:
        if event_was_processed(db, event_id):
            log(f"Evento duplicado ignorado: {event_id}")
            return

        if product_id is None:
            log("Evento stock.low ignorado: product_id não informado")
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        acquire_product_lock(db, product_id)

        if event_was_processed(db, event_id):
            log(f"Evento duplicado ignorado após trava: {event_id}")
            db.commit()
            return

        log(f"Evento stock.low recebido para o produto {product_id}")

        if not is_auto_reorder_enabled(event.get("auto_reorder_enabled")):
            log(f"Reposição automática desativada para o produto {product_id}")
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        log("Reposição automática ativada")

        open_order = get_open_order(db, product_id)
        if open_order:
            log(
                f"Pedido aberto já existe para o produto {product_id}. "
                "Novo pedido automático não será criado"
            )
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        current_quantity = parse_int(
            get_first_value(event, "current_quantity", "current_stock")
        )
        minimum_stock = parse_int(event.get("minimum_stock"))

        if current_quantity is None or minimum_stock is None:
            log(
                f"Pedido automático não criado para o produto {product_id}: "
                "estoque atual ou mínimo ausente no evento"
            )
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        quantity = max(minimum_stock - current_quantity, 1)
        supplier = resolve_supplier(db, event, product_id)

        if not supplier:
            log(
                f"Pedido automático não criado para o produto {product_id}: "
                "fornecedor não configurado"
            )
            mark_event_processed(db, event_id, event_type)
            db.commit()
            return

        pedido = Pedido(
            produto_id=product_id,
            produto_nome=event.get("product_name") or f"Produto {product_id}",
            fornecedor=supplier,
            quantidade=quantity,
            status=StatusPedido.PENDENTE,
            origin=ORDER_ORIGIN_AUTOMATIC,
            source_event_id=event_id,
        )

        db.add(pedido)
        mark_event_processed(db, event_id, event_type)
        db.commit()
        db.refresh(pedido)
        log(f"Pedido automático criado com quantidade {quantity}")
    except IntegrityError as exc:
        db.rollback()
        log(f"Evento stock.low tratado como duplicado: {exc}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def handle_stock_low_event(channel, method, properties, body):
    try:
        event = json.loads(body.decode("utf-8"))
        event_type = event.get("event") or method.routing_key
        process_stock_low_event(event, event_type)
        channel.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as exc:
        log(f"Erro ao processar stock.low: {exc}")
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)


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
                on_message_callback=handle_stock_low_event,
            )

            log("Conectado ao RabbitMQ")
            log("Aguardando eventos stock.low")
            channel.start_consuming()
        except Exception as exc:
            log(f"RabbitMQ indisponível ou conexão perdida: {exc}")
            time.sleep(5)
