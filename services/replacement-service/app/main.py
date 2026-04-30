from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

# Importamos o cliente que você criou (ajuste o caminho se necessário)
from app.grpc.client import inventory_client
from app.database import SessionLocal, engine
from app import models, schemas
from fastapi.middleware.cors import CORSMiddleware

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Serviço de Pedidos de Reposição")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # depois você pode restringir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência do Banco de Dados
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/pedidos/", response_model=schemas.PedidoResponse)
def criar_pedido(pedido: schemas.PedidoCreate, db: Session = Depends(get_db)):
    # 1. Chamar o Inventário via nosso cliente gRPC simplificado
    response = inventory_client.consultar_produto(pedido.produto_id)
    
    # Se o cliente retornar None, é porque houve erro de conexão (RpcError)
    if response is None:
        raise HTTPException(status_code=503, detail="Serviço de Inventário indisponível")
    
    if not response.found:
        raise HTTPException(status_code=404, detail="Produto não existe no inventário")

    # 2. Salvar o pedido (usando o nome que veio na resposta gRPC)
    novo_pedido = models.Pedido(
        produto_id=pedido.produto_id,
        produto_nome=response.nome,
        fornecedor=pedido.fornecedor,
        quantidade=pedido.quantidade,
        status=models.StatusPedido.PENDENTE
    )
    
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    return novo_pedido

@app.get("/pedidos/", response_model=list[schemas.PedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    return db.query(models.Pedido).all()

@app.post("/pedidos/{pedido_id}/receber")
def receber_pedido(pedido_id: int, db: Session = Depends(get_db)):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if pedido.status != models.StatusPedido.PENDENTE:
        raise HTTPException(status_code=400, detail="Apenas pedidos Pendentes podem ser recebidos")

    # 3. Chamar o cliente gRPC para aumentar o estoque
    response = inventory_client.adicionar_estoque(pedido.produto_id, pedido.quantidade)
    
    if response is None:
        raise HTTPException(status_code=503, detail="Serviço de Inventário indisponível")
        
    if not response.success:
        raise HTTPException(status_code=500, detail=f"Erro no Inventário: {response.message}")

    # 4. Atualizar o status local após confirmação do gRPC
    pedido.status = models.StatusPedido.RECEBIDO
    db.commit()
    db.refresh(pedido)
    
    return {
        "mensagem": "Pedido recebido e estoque atualizado!", 
        "estoque_atual": response.current_stock
    }

@app.post("/pedidos/{pedido_id}/cancelar")
def cancelar_pedido(pedido_id: int, db: Session = Depends(get_db)):
    pedido = db.query(models.Pedido).filter(models.Pedido.id == pedido_id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if pedido.status != models.StatusPedido.PENDENTE:
        raise HTTPException(status_code=400, detail="Apenas pedidos Pendentes podem ser cancelados")

    pedido.status = models.StatusPedido.CANCELADO
    db.commit()
    return {"mensagem": "Pedido cancelado com sucesso"}