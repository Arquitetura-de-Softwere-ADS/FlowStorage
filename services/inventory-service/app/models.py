import enum
from sqlalchemy import Column, Integer, String, Float, Enum
from app.database import Base

# Definindo as categorias permitidas
class CategoriaEnum(enum.Enum):
    ELETRONICOS = "Eletrônicos"
    ALIMENTOS = "Alimentos"
    VESTUARIO = "Vestuário"
    OUTROS = "Outros"

class Produto(Base):
    __tablename__ = "produtos"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    sku = Column(String, unique=True, index=True, nullable=False)
    categoria = Column(Enum(CategoriaEnum), nullable=False)
    preco = Column(Float, nullable=False)
    estoque = Column(Integer, default=0)
    minimo = Column(Integer, default=5)
