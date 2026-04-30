import grpc

from app.grpc.generated import inventory_pb2, inventory_pb2_grpc


class InventoryClient:
    def __init__(self):
        self.channel = grpc.insecure_channel("inventory-service:50051")
        self.stub = inventory_pb2_grpc.InventoryServiceStub(self.channel)

    def consultar_produto(self, produto_id: int):
        request = inventory_pb2.ProductRequest(product_id=produto_id)

        try:
            return self.stub.GetProduct(request)
        except grpc.RpcError as e:
            print(f"Erro gRPC ao consultar: {e}")
            return None

    def adicionar_estoque(self, produto_id: int, quantidade: int):
        request = inventory_pb2.IncreaseStockRequest(
            product_id=produto_id,
            quantity=quantidade
        )

        try:
            return self.stub.IncreaseStock(request)
        except grpc.RpcError as e:
            print(f"Erro gRPC ao aumentar estoque: {e}")
            return None


inventory_client = InventoryClient()