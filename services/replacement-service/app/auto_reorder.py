import os
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import (
    ORDER_ORIGIN_AUTOMATIC,
    Pedido,
    ProcessedEvent,
    StatusPedido,
)


OPEN_ORDER_STATUSES = [StatusPedido.PENDENTE]
ADVISORY_LOCK_NAMESPACE = 42041
AUTOMATIC_REORDER_FALLBACK_SUPPLIER = os.getenv(
    "AUTOMATIC_REORDER_FALLBACK_SUPPLIER",
    "Fornecedor pendente",
)


@dataclass
class AutomaticReplacementRequest:
    event_type: str
    event_id: str | None
    product_id: int | None
    product_name: str | None
    current_quantity: int | None
    minimum_stock: int | None
    auto_reorder_enabled: bool
    supplier: str | None = None


def log(message: str):
    print(f"[replacement-service] {message}", flush=True)


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


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "sim"}
    return False


def build_automatic_replacement_request(
    event: dict[str, Any],
    event_type: str,
) -> AutomaticReplacementRequest:
    supplier = get_first_value(event, "fornecedor", "supplier")

    if supplier is not None:
        supplier = str(supplier).strip() or None

    return AutomaticReplacementRequest(
        event_type=event_type,
        event_id=event.get("event_id"),
        product_id=parse_int(event.get("product_id")),
        product_name=event.get("product_name"),
        current_quantity=parse_int(
            get_first_value(event, "current_quantity", "current_stock")
        ),
        minimum_stock=parse_int(event.get("minimum_stock")),
        auto_reorder_enabled=parse_bool(event.get("auto_reorder_enabled")),
        supplier=supplier,
    )


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


def resolve_supplier(
    db: Session,
    product_id: int,
    supplier_from_event: str | None,
) -> str | None:
    if supplier_from_event:
        return supplier_from_event

    previous_order = (
        db.query(Pedido)
        .filter(Pedido.produto_id == product_id)
        .order_by(Pedido.data.desc())
        .first()
    )

    if previous_order and previous_order.fornecedor and previous_order.fornecedor.strip():
        return previous_order.fornecedor.strip()

    return None


def create_automatic_replacement_if_needed(
    db: Session,
    request: AutomaticReplacementRequest,
) -> Pedido | None:
    if event_was_processed(db, request.event_id):
        log(f"Evento duplicado ignorado: {request.event_id}")
        return None

    if request.product_id is None:
        log("Evento stock.low ignorado: product_id não informado")
        mark_event_processed(db, request.event_id, request.event_type)
        db.commit()
        return None

    acquire_product_lock(db, request.product_id)

    if event_was_processed(db, request.event_id):
        log(f"Evento duplicado ignorado após trava: {request.event_id}")
        db.commit()
        return None

    log(f"Evento stock.low recebido para o produto {request.product_id}.")

    if not request.auto_reorder_enabled:
        log("Reposição automática desativada. Nenhum pedido foi criado.")
        mark_event_processed(db, request.event_id, request.event_type)
        db.commit()
        return None

    log("Reposição automática ativada.")

    open_order = get_open_order(db, request.product_id)
    if open_order:
        log(
            f"Já existe pedido aberto para o produto {request.product_id}. "
            "Nenhum pedido duplicado foi criado."
        )
        mark_event_processed(db, request.event_id, request.event_type)
        db.commit()
        return None

    if request.current_quantity is None or request.minimum_stock is None:
        log(
            f"Pedido automático não criado para o produto {request.product_id}: "
            "estoque atual ou mínimo ausente no evento."
        )
        mark_event_processed(db, request.event_id, request.event_type)
        db.commit()
        return None

    quantity = max(request.minimum_stock - request.current_quantity, 1)
    supplier = resolve_supplier(db, request.product_id, request.supplier)

    if not supplier:
        log(
            f"Fornecedor não configurado para o produto {request.product_id}. "
            f"Usando '{AUTOMATIC_REORDER_FALLBACK_SUPPLIER}' para criar o pedido automático."
        )
        supplier = AUTOMATIC_REORDER_FALLBACK_SUPPLIER

    pedido = Pedido(
        produto_id=request.product_id,
        produto_nome=request.product_name or f"Produto {request.product_id}",
        fornecedor=supplier,
        quantidade=quantity,
        status=StatusPedido.PENDENTE,
        origin=ORDER_ORIGIN_AUTOMATIC,
        source_event_id=request.event_id,
    )

    db.add(pedido)
    mark_event_processed(db, request.event_id, request.event_type)
    db.commit()
    db.refresh(pedido)
    log(
        f"Pedido automático criado para o produto {request.product_id} "
        f"com quantidade {quantity}."
    )
    return pedido
