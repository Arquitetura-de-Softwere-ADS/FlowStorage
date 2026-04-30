import grpc

from app.grpc.generated import inventory_pb2, inventory_pb2_grpc


INVENTORY_GRPC_URL = "inventory-service:50051"


def get_inventory_stub():
    channel = grpc.insecure_channel(INVENTORY_GRPC_URL)
    stub = inventory_pb2_grpc.InventoryServiceStub(channel)
    return stub


def get_product(product_id: int):
    stub = get_inventory_stub()
    return stub.GetProduct(inventory_pb2.ProductRequest(product_id=product_id))


def decrease_stock(product_id: int, quantity: int):
    stub = get_inventory_stub()
    return stub.DecreaseStock(
        inventory_pb2.DecreaseStockRequest(product_id=product_id, quantity=quantity)
    )
