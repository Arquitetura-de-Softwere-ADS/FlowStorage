import json
import os
import uuid
from datetime import datetime
from typing import Any

import pika


RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "rabbitmq")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", "5672"))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_EXCHANGE = os.getenv("RABBITMQ_EXCHANGE", "flowstorage.events")


def log(message: str):
    print(f"[sales-service] {message}", flush=True)


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


def publish_sale_created(
    sale_id: int,
    product_id: int,
    product_name: str,
    quantity_sold: int,
    current_stock: int,
    created_at: datetime,
):
    publish_event(
        "sales.created",
        {
            "event_id": str(uuid.uuid4()),
            "event": "sales.created",
            "sale_id": sale_id,
            "product_id": product_id,
            "product_name": product_name,
            "quantity_sold": quantity_sold,
            "current_stock": current_stock,
            "current_quantity": current_stock,
            "created_at": created_at.isoformat(),
        },
    )
