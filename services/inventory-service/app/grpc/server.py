from concurrent import futures

import grpc

from app.database import SessionLocal
from app.grpc.generated import inventory_pb2, inventory_pb2_grpc
from app.models import Produto


class InventoryService(inventory_pb2_grpc.InventoryServiceServicer):

    def GetProduct(self, request, context):
        db = SessionLocal()
        try:
            produto = db.query(Produto).filter(Produto.id == request.product_id).first()
            if not produto:
                return inventory_pb2.ProductResponse(found=False, message="Produto não encontrado")

            return inventory_pb2.ProductResponse(
                found=True,
                id=produto.id,
                nome=produto.nome,
                sku=produto.sku,
                preco=produto.preco,
                estoque=produto.estoque,
                message="Produto encontrado",
            )
        finally:
            db.close()

    def DecreaseStock(self, request, context):
        db = SessionLocal()
        try:
            produto = db.query(Produto).filter(Produto.id == request.product_id).first()
            if not produto:
                return inventory_pb2.StockResponse(success=False, message="Produto não encontrado", current_stock=0)

            if produto.estoque < request.quantity:
                return inventory_pb2.StockResponse(
                    success=False,
                    message="Estoque insuficiente",
                    current_stock=produto.estoque,
                )

            produto.estoque -= request.quantity
            db.commit()
            db.refresh(produto)

            return inventory_pb2.StockResponse(
                success=True,
                message="Estoque reduzido com sucesso",
                current_stock=produto.estoque,
            )
        finally:
            db.close()

    def IncreaseStock(self, request, context):
        db = SessionLocal()
        try:
            produto = db.query(Produto).filter(Produto.id == request.product_id).first()

            if not produto:
                return inventory_pb2.StockResponse(
                    success=False,
                    message="Produto não encontrado",
                    current_stock=0,
                )

            produto.estoque += request.quantity

            db.commit()
            db.refresh(produto)

            return inventory_pb2.StockResponse(
                success=True,
                message="Estoque aumentado com sucesso",
                current_stock=produto.estoque,
            )
        finally:
            db.close()


def serve():
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    inventory_pb2_grpc.add_InventoryServiceServicer_to_server(InventoryService(), server)
    server.add_insecure_port("[::]:50051")
    print("gRPC Inventory Service rodando na porta 50051")
    server.start()
    server.wait_for_termination()


if __name__ == "__main__":
    serve()
