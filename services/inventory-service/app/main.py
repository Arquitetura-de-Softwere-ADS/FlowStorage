from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from app import models, schemas
from app.database import SessionLocal, engine, ensure_schema
from app.messaging import publish_stock_events, publish_stock_low_event
from fastapi.middleware.cors import CORSMiddleware

# Cria tabelas
models.Base.metadata.create_all(bind=engine)
ensure_schema()

app = FastAPI(
    title="inventory Service",
    description="Microserviço de gestão de inventario",
)

# Dependency do banco
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# CORS (libera frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # pode restringir depois
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# CREATE
# =========================
@app.post("/produtos/", response_model=schemas.ProdutoResponse)
def criar_produto(produto: schemas.ProdutoCreate, db: Session = Depends(get_db)):
    db_produto = db.query(models.Produto).filter(models.Produto.sku == produto.sku).first()
    if db_produto:
        raise HTTPException(status_code=400, detail="SKU já cadastrado")

    novo_produto = models.Produto(**produto.model_dump())
    db.add(novo_produto)
    db.commit()
    db.refresh(novo_produto)
    return novo_produto


# =========================
# LIST
# =========================
@app.get("/produtos/", response_model=list[schemas.ProdutoResponse])
def listar_produtos(db: Session = Depends(get_db)):
    return db.query(models.Produto).all()


# =========================
# GET BY ID
# =========================
@app.get("/produtos/{produto_id}", response_model=schemas.ProdutoResponse)
def obter_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return produto


# =========================
# UPDATE
# =========================
@app.put("/produtos/{produto_id}", response_model=schemas.ProdutoResponse)
def atualizar_produto(produto_id: int, dados: schemas.ProdutoCreate, db: Session = Depends(get_db)):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    estoque_anterior = produto.estoque
    minimo_anterior = produto.minimo

    for key, value in dados.model_dump().items():
        setattr(produto, key, value)

    db.commit()
    db.refresh(produto)

    if produto.estoque != estoque_anterior or produto.minimo != minimo_anterior:
        publish_stock_events(
            produto,
            previous_stock=estoque_anterior,
            previous_minimum_stock=minimo_anterior,
            primary_event_type="stock.updated",
        )

    return produto


@app.patch(
    "/produtos/{produto_id}/auto-reorder",
    response_model=schemas.AutoReorderResponse,
)
def atualizar_reposicao_automatica(
    produto_id: int,
    dados: schemas.AutoReorderUpdate,
    db: Session = Depends(get_db),
):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()

    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    estava_desativado = not bool(produto.auto_reorder_enabled)
    produto.auto_reorder_enabled = dados.enabled
    db.commit()
    db.refresh(produto)

    if dados.enabled and estava_desativado and produto.estoque <= produto.minimo:
        publish_stock_low_event(produto, previous_stock=produto.estoque)

    return {
        "product_id": produto.id,
        "auto_reorder_enabled": produto.auto_reorder_enabled,
    }


# =========================
# DELETE
# =========================
@app.delete("/produtos/{produto_id}")
def excluir_produto(produto_id: int, db: Session = Depends(get_db)):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    db.delete(produto)
    db.commit()
    return {"mensagem": f"Produto {produto_id} removido com sucesso"}

@app.patch("/produtos/{produto_id}/adicionar-estoque/{quantidade}")
def adicionar_estoque(produto_id: int, quantidade: int, db: Session = Depends(get_db)):
    produto = db.query(models.Produto).filter(models.Produto.id == produto_id).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    
    estoque_anterior = produto.estoque
    produto.estoque += quantidade
    db.commit()
    db.refresh(produto)
    publish_stock_events(produto, previous_stock=estoque_anterior)
    return {"mensagem": "Estoque atualizado", "novo_estoque": produto.estoque}
