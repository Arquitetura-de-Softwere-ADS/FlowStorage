from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "postgresql://replacement_user:123456@replacement-db:5432/replacement_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def ensure_schema():
    with engine.begin() as connection:
        connection.execute(
            text(
                "ALTER TABLE pedidos "
                "ADD COLUMN IF NOT EXISTS origin VARCHAR NOT NULL DEFAULT 'MANUAL'"
            )
        )
        connection.execute(
            text("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS source_event_id VARCHAR")
        )
        connection.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_pedidos_source_event_id "
                "ON pedidos (source_event_id) WHERE source_event_id IS NOT NULL"
            )
        )
