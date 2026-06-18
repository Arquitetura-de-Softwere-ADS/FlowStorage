import json
import os
import time
import uuid
from datetime import datetime
from typing import Any

import pika
from sqlalchemy.exc import IntegrityError

from app.auto_reorder import (
    build_automatic_replacement_request,
    create_automatic_replacement_if_needed,
)
from app.database import SessionLocal


RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "flowstorage.events")
RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "replacement-service.stock-low")
RABBITMQ_ROUTING_KEYS = os.getenv("RABBITMQ_ROUTING_KEYS", "stock.low")


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


def process_stock_low_event(event: dict[str, Any], event_type: str):
    db = SessionLocal()
    try:
        request = build_automatic_replacement_request(event, event_type)
        create_automatic_replacement_if_needed(db, request)
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
    except json.JSONDecodeError as exc:
        log(f"Mensagem stock.low inválida descartada: {exc}")
        channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
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
