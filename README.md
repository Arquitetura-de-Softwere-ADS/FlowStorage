# FlowStorage

Sistema modular de gestão de estoque com arquitetura de microserviços.

## Visão geral

O FlowStorage é dividido em:

- **Frontend** (SPA) em React + TanStack Router (rodando via Vite/Bun)
- **Microserviços** em FastAPI + SQLAlchemy
- **Bancos isolados por serviço** (PostgreSQL)
- **Integração via gRPC** entre serviços (Inventário como fonte de verdade do estoque)

Módulos cobertos pela UI:

- **Autenticação** (cadastro/login + JWT)
- **Inventário** (CRUD de produtos)
- **Pedidos de reposição** (cria pedido e, ao receber, aumenta estoque via gRPC)
- **Vendas** (registra venda e baixa estoque via gRPC)
- **Relatórios**: rotas/serviço removidos (mantido vazio para compatibilidade no frontend)

## Arquitetura (alto nível)

```text
┌──────────────┐            ┌──────────────────────┐
│   Frontend   │ ── HTTP ─▶ │  Auth Service (8001) │ ── Postgres (5433)
│ (Vite/Bun)   │            └──────────────────────┘
│              │ ── HTTP ─▶ ┌──────────────────────────┐
│              │            │ Inventory Service (8003)  │ ── Postgres (5435)
│              │            │ + gRPC (50051)            │
│              │            └──────────────────────────┘
│              │ ── HTTP ─▶ ┌──────────────────────┐
│              │            │ Sales Service (8002)  │ ── Postgres (5434)
│              │            │  └─ gRPC → Inventory  │
│              │            └──────────────────────┘
│              │ ── HTTP ─▶ ┌─────────────────────────────┐
│              │            │ Replacement Service (8004)   │ ── Postgres (5436)
│              │            │  └─ gRPC → Inventory         │
└──────────────┘            └─────────────────────────────┘
```

## Stack

### Frontend

- Bun + Vite
- React
- TanStack Router / TanStack Start (config via `@lovable.dev/vite-tanstack-config`)
- TailwindCSS
- Componentes Radix UI

### Backend

- Python 3.12
- FastAPI
- SQLAlchemy
- PostgreSQL (via Docker)
- gRPC (InventoryService)

## Serviços e portas

### HTTP

- **Auth Service**: `http://localhost:8001`
- **Sales Service**: `http://localhost:8002`
- **Inventory Service**: `http://localhost:8003`
- **Replacement Service**: `http://localhost:8004`

### gRPC

- **Inventory gRPC**: `localhost:50051` (no host) / `inventory-service:50051` (na rede do Docker)

### Bancos (Postgres)

- **Auth DB**: `localhost:5433` (db `auth_db`, user `auth_user`)
- **Sales DB**: `localhost:5434` (db `sales_db`, user `sales_user`)
- **Inventory DB**: `localhost:5435` (db `inventory_db`, user `inventory_user`)
- **Replacement DB**: `localhost:5436` (db `replacement_db`, user `replacement_user`)

Observação importante: hoje as URLs de conexão do banco estão hard-coded nos serviços (apontando para os hosts do Docker, como `auth-db`, `inventory-db`, etc.).

## Como rodar (recomendado)

### 1) Subir backend com Docker

Na raiz do repositório:

```bash
docker compose up --build
```

Isso sobe:

- 4 bancos Postgres (um por microserviço)
- 4 microserviços FastAPI
- gRPC do inventário na porta 50051 (no mesmo container do inventário)

Para parar:

```bash
docker compose down
```

Para apagar os dados (volumes) e recomeçar do zero:

```bash
docker compose down -v
```

### 2) Subir frontend

Em outro terminal:

```bash
cd frontend
bun install
bun run dev
```

Alternativa (sem Bun):

```bash
cd frontend
npm install
npm run dev
```

O Vite normalmente sobe em `http://localhost:5173`.

## Docs e health checks

Cada serviço FastAPI expõe documentação OpenAPI por padrão:

- `http://localhost:8001/docs`
- `http://localhost:8002/docs`
- `http://localhost:8003/docs`
- `http://localhost:8004/docs`

## APIs (endpoints principais)

### Auth Service (8001)

- `GET /` → status do serviço
- `POST /auth/register`
	- body: `{ "name": string, "email": string, "password": string }`
- `POST /auth/login`
	- body: `{ "email": string, "password": string }`
	- response: `{ "access_token": string, "token_type": "bearer" }`
- `GET /auth/me` (Bearer token)

Exemplo:

```bash
curl -X POST http://localhost:8001/auth/register \
	-H "Content-Type: application/json" \
	-d '{"name":"Ayrton","email":"ayrton@example.com","password":"123456"}'
```

### Inventory Service (8003)

- `POST /produtos/` → cria produto
- `GET /produtos/` → lista
- `GET /produtos/{produto_id}` → detalhe
- `PUT /produtos/{produto_id}` → atualiza
- `DELETE /produtos/{produto_id}` → remove
- `PATCH /produtos/{produto_id}/adicionar-estoque/{quantidade}` → adiciona estoque (HTTP)

Campos do produto (API):

```json
{
	"nome": "Mouse",
	"sku": "MOU-001",
	"categoria": "Eletrônicos",
	"preco": 79.9,
	"estoque": 10,
	"minimo": 5
}
```

Observação: `categoria` é um enum no backend (valores: `Eletrônicos`, `Alimentos`, `Vestuário`, `Outros`).

### Sales Service (8002)

- `GET /sales/` → lista vendas
- `POST /sales/` → cria venda e baixa estoque via gRPC no inventário

Body:

```json
{
	"items": [
		{ "product_id": 1, "quantity": 2 }
	]
}
```

### Replacement Service (8004)

- `GET /pedidos/` → lista pedidos de reposição
- `POST /pedidos/` → cria pedido (consulta produto no inventário via gRPC)
- `POST /pedidos/{pedido_id}/receber` → recebe pedido e aumenta estoque via gRPC
- `POST /pedidos/{pedido_id}/cancelar` → cancela pedido

Body para criar:

```json
{
	"produto_id": 1,
	"fornecedor": "Fornecedor X",
	"quantidade": 10
}
```

## gRPC (InventoryService)

O contrato está em:

- `proto/inventory/v1/inventory.proto`

RPCs definidos:

- `GetProduct`
- `DecreaseStock`
- `IncreaseStock`

Os stubs Python gerados ficam em:

- `services/inventory-service/app/grpc/generated/`
- `services/sales-service/app/grpc/generated/`
- `services/replacement-service/app/grpc/generated/`

### Regenerar stubs (quando mudar o .proto)

Exemplo a partir da raiz do repositório (requer Python + `grpcio-tools` instalado no ambiente do serviço):

```bash
cd services/inventory-service
python -m grpc_tools.protoc \
	-I ../../proto \
	--python_out=app/grpc/generated \
	--grpc_python_out=app/grpc/generated \
	../../proto/inventory/v1/inventory.proto
```

Repita o mesmo comando em `services/sales-service` e `services/replacement-service`.

## Estrutura do repositório

```text
.
├─ docker-compose.yml
├─ frontend/
├─ proto/
│  └─ inventory/v1/inventory.proto
└─ services/
	 ├─ auth-service/
	 ├─ inventory-service/
	 ├─ replacement-service/
	 └─ sales-service/
```

## Notas técnicas (importantes)

- **CORS está liberado** (`allow_origins=["*"]`) nos serviços (bom para dev; restringir em produção).
- **Tabelas são criadas automaticamente** no startup via `metadata.create_all` (não há migrações).
- **JWT do Auth** usa `SECRET_KEY = "troque-essa-chave-depois"` (placeholder). Para qualquer uso real, troque e mova para variável de ambiente.
- **URLs do Postgres e senhas** também estão no código/compose como valores fixos (apenas dev).
- **Outros serviços não validam JWT** hoje; a UI usa login apenas para experiência do app.

## Troubleshooting

- Porta em uso: altere o mapeamento em `docker-compose.yml`.
- Erro de conexão gRPC: confirme se o container do inventário está no ar e expondo `50051`.
- “Dados velhos”/inconsistência: apague volumes com `docker compose down -v`.

## Próximos passos (sugestões)

- Centralizar configuração por `.env` (DB URLs, JWT secret, CORS origins).
- Proteger rotas dos serviços com validação JWT.
- Adicionar migrações (Alembic) para evoluir schema com segurança.