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
    print(f"[inventory-service] {message}", flush=True)


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


def build_stock_payload(
    event_type: str,
    produto,
    previous_stock: int | None = None,
) -> dict[str, Any]:
    payload = {
        "event_id": str(uuid.uuid4()),
        "event": event_type,
        "product_id": produto.id,
        "product_name": produto.nome,
        "current_quantity": produto.estoque,
        "current_stock": produto.estoque,
        "minimum_stock": produto.minimo,
        "created_at": datetime.utcnow().isoformat(),
    }

    if previous_stock is not None:
        payload["previous_quantity"] = previous_stock
        payload["previous_stock"] = previous_stock
        payload["quantity_delta"] = produto.estoque - previous_stock

    return payload


def get_primary_stock_event(produto, previous_stock: int | None) -> str:
    if previous_stock is None or produto.estoque == previous_stock:
        return "stock.updated"

    if produto.estoque > previous_stock:
        return "stock.increased"

    return "stock.decreased"


def publish_stock_events(
    produto,
    previous_stock: int | None = None,
    primary_event_type: str | None = None,
):
    event_type = primary_event_type or get_primary_stock_event(produto, previous_stock)
    publish_event(event_type, build_stock_payload(event_type, produto, previous_stock))

    if produto.estoque <= produto.minimo:
        publish_event("stock.low", build_stock_payload("stock.low", produto, previous_stock))
