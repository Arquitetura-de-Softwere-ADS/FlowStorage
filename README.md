# FlowStorage

Sistema modular de gestão de estoque com arquitetura de microserviços.

## Visão geral

O FlowStorage é dividido em:

- **Frontend** (SPA) em React + TanStack Router (rodando via Vite/Bun)
- **Microserviços** em FastAPI + SQLAlchemy
- **Bancos isolados por serviço** (PostgreSQL)
- **Integração via gRPC** entre serviços (Inventário como fonte de verdade do estoque)
- **Mensageria Pub/Sub** com RabbitMQ para eventos de estoque

Módulos e serviços de negócio:

- **Autenticação** (cadastro/login + JWT)
- **Inventário** (CRUD de produtos)
- **Pedidos de reposição** (cria pedido e, ao receber, aumenta estoque via gRPC)
- **Vendas** (registra venda e baixa estoque via gRPC)
- **Notificações** (assina eventos de estoque e cria notificações para usuários inscritos)
- **Reposição automática** (assina `stock.low` e cria pedidos sem duplicar quando habilitada no produto)
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
│              │            └─────────────────────────────┘
│              │ ── HTTP ─▶ ┌─────────────────────────────┐
│              │            │ Notification Service (8005)  │ ── Postgres (5437)
│              │            │  └─ consome RabbitMQ         │
│              │            └─────────────────────────────┘
└──────────────┘

Inventory Service ── publica eventos stock.* ──▶ RabbitMQ ──▶ Notification Service
                                                  └──────────▶ Replacement Service
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
- RabbitMQ (exchange topic para publish/subscribe)

## Serviços e portas

### HTTP

- **Auth Service**: `http://localhost:8001`
- **Sales Service**: `http://localhost:8002`
- **Inventory Service**: `http://localhost:8003`
- **Replacement Service**: `http://localhost:8004`
- **Notification Service**: `http://localhost:8005`
- **RabbitMQ Management**: `http://localhost:15672` (usuário `guest`, senha `guest`)

### gRPC

- **Inventory gRPC**: `localhost:50051` (no host) / `inventory-service:50051` (na rede do Docker)

### Bancos (Postgres)

- **Auth DB**: `localhost:5433` (db `auth_db`, user `auth_user`)
- **Sales DB**: `localhost:5434` (db `sales_db`, user `sales_user`)
- **Inventory DB**: `localhost:5435` (db `inventory_db`, user `inventory_user`)
- **Replacement DB**: `localhost:5436` (db `replacement_db`, user `replacement_user`)
- **Notification DB**: `localhost:5437` (db `notification_db`, user `notification_user`)

Observação importante: hoje as URLs de conexão do banco estão hard-coded nos serviços (apontando para os hosts do Docker, como `auth-db`, `inventory-db`, etc.).

## Como rodar (recomendado)

### 1) Subir backend com Docker

Na raiz do repositório:

```bash
docker compose up --build
```

Isso sobe:

- RabbitMQ com painel web de gerenciamento
- 5 bancos Postgres (um por microserviço)
- 5 microserviços FastAPI
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
- `http://localhost:8005/docs`

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
- `PATCH /produtos/{produto_id}/auto-reorder` → ativa/desativa reposição automática
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
	"minimo": 5,
	"fornecedor": "Fornecedor X"
}
```

Resposta do produto também inclui:

```json
{
	"id": 1,
	"auto_reorder_enabled": false
}
```

Produtos existentes começam com `auto_reorder_enabled = false`. A coluna é salva no banco do inventário e não usa `localStorage`.

Body para ativar/desativar a reposição automática:

```json
{
	"enabled": true
}
```

Resposta:

```json
{
	"product_id": 1,
	"auto_reorder_enabled": true
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

Pedidos criados pela tela/API manual recebem `origin = "MANUAL"`. Pedidos criados pelo consumer de estoque crítico recebem `origin = "AUTOMATIC"` e aparecem na tela como “Automático”.

### Notification Service (8005)

O `notification-service` é o assinante de eventos de estoque. Ele permite que um usuário monitore produtos específicos e salva notificações quando o RabbitMQ entrega eventos relacionados a esses produtos.

- `POST /subscriptions` → cadastra inscrição de usuário em produto
- `GET /subscriptions/{user_id}` → lista produtos monitorados por usuário
- `DELETE /subscriptions/{subscription_id}` → remove inscrição
- `GET /notifications/{user_id}` → lista notificações do usuário
- `PATCH /notifications/{notification_id}/read` → marca notificação como lida

Body para criar inscrição:

```json
{
	"user_id": 1,
	"product_id": 3
}
```

Exemplo de notificação salva:

```json
{
	"id": 1,
	"user_id": 1,
	"product_id": 3,
	"title": "Estoque baixo",
	"message": "O produto Teclado Mecânico está com estoque baixo. Quantidade atual: 2. Mínimo recomendado: 5.",
	"event_type": "stock.low",
	"read": false,
	"created_at": "2026-06-16T10:00:00"
}
```

## Mensageria Pub/Sub com RabbitMQ

O projeto usa RabbitMQ para demonstrar uma arquitetura baseada em mensagens com publish/subscribe.

- **Publicador**: `inventory-service`
- **Broker/canal intermediário**: RabbitMQ
- **Assinantes**: `notification-service` e `replacement-service`
- **Exchange**: `flowstorage.events`
- **Tipo da exchange**: `topic`
- **Eventos consumidos pelo notification-service**: `stock.updated` e `stock.low`
- **Evento consumido pelo replacement-service**: `stock.low`
- **Fila de notificações**: `notification-service.stock`
- **Fila de reposição automática**: `replacement-service.stock-low`

Quando o estoque é alterado pelo endpoint HTTP do inventário ou pelos fluxos gRPC de venda/reposição, o `inventory-service` publica:

```json
{
	"event_id": "uuid-unico",
	"event": "stock.low",
	"product_id": 3,
	"product_name": "Teclado Mecânico",
	"previous_quantity": 8,
	"previous_stock": 8,
	"current_quantity": 2,
	"current_stock": 2,
	"minimum_stock": 5,
	"auto_reorder_enabled": true,
	"fornecedor": "Fornecedor X",
	"supplier": "Fornecedor X",
	"created_at": "2026-06-16T10:00:00"
}
```

O `stock.low` é publicado preferencialmente quando o produto entra no estado crítico, ou seja, quando sai de uma situação acima do mínimo e passa para `estoque <= minimo`. Se o produto já estava crítico e cai de 4 para 3, o inventário evita republicar a entrada crítica. Mesmo assim, o replacement-service também se protege contra eventos repetidos.

O `notification-service` mantém uma fila própria ligada às routing keys configuradas no compose. Ao receber `stock.low`, ele cria notificação crítica mesmo que o sino daquele produto esteja desativado.

O `replacement-service` mantém a fila `replacement-service.stock-low`, ligada somente à routing key `stock.low`. Ao receber o evento, ele:

- lê `product_id` e `auto_reorder_enabled`;
- ignora o evento se `auto_reorder_enabled` for `false`;
- usa `event_id` para evitar reprocessamento;
- usa uma trava transacional por produto antes de checar/criar pedidos;
- verifica se já existe pedido `Pendente` para o mesmo produto;
- calcula `quantidade = max(minimum_stock - current_quantity, 1)`;
- cria o pedido como `origin = "AUTOMATIC"` quando existe fornecedor válido.

Fluxo esperado:

```text
inventory-service
        |
        | publica stock.low
        v
flowstorage.events
        |
        |------------------------------|
        v                              v
notification-service.stock     replacement-service.stock-low
        |                              |
        v                              v
cria notificação                cria pedido automático
```

Logs esperados no `notification-service`:

```text
[notification-service] Conectado ao RabbitMQ
[notification-service] Aguardando eventos de estoque
[notification-service] Evento recebido: stock.low
[notification-service] Produto monitorado encontrado: produto 3, 1 inscrição(ões)
[notification-service] Notificação criada para o usuário 1
```

Logs esperados no `replacement-service`:

```text
[replacement-service] Evento stock.low recebido para o produto 3
[replacement-service] Reposição automática ativada
[replacement-service] Pedido automático criado com quantidade 5
```

### Teste do fluxo de notificações

Passo 1: subir o projeto.

```bash
docker compose up --build
```

Passo 2: cadastrar uma inscrição para monitorar o produto 3.

```bash
curl -X POST http://localhost:8005/subscriptions \
	-H "Content-Type: application/json" \
	-d '{"user_id":1,"product_id":3}'
```

Passo 3: alterar o estoque do produto 3 para gerar `stock.updated` e, se ficar abaixo do mínimo, `stock.low`.

```bash
curl -X PUT http://localhost:8003/produtos/3 \
	-H "Content-Type: application/json" \
	-d '{
		"nome":"Teclado Mecânico",
		"sku":"TEC-003",
		"categoria":"Eletrônicos",
		"preco":250.0,
		"estoque":2,
		"minimo":5
	}'
```

Se o produto 3 ainda não existir no banco, crie um produto em `POST /produtos/` e use o `id` retornado no lugar do `3`.

Passo 4: verificar os logs do assinante.

```bash
docker compose logs -f notification-service
```

Passo 5: consultar as notificações do usuário 1.

```bash
curl http://localhost:8005/notifications/1
```

Resultado esperado: a resposta deve conter uma notificação relacionada ao produto monitorado.

## Reposição automática de estoque

Na tela **Inventário**, cada produto tem dois controles independentes:

- **Sino**: controla notificações comuns/monitoramento do produto.
- **Checkbox de reposição automática**: controla se o sistema pode criar pedido automático quando o produto entra em estoque crítico.

Notificações críticas continuam sendo criadas mesmo com sino e checkbox desativados. O checkbox desmarcado significa apenas: não gerar novos pedidos automáticos para aquele produto.

Regra de estoque crítico:

```text
estoque <= minimo
```

Quando o checkbox é marcado, o frontend atualiza a interface imediatamente e envia:

```bash
curl -X PATCH http://localhost:8003/produtos/1/auto-reorder \
	-H "Content-Type: application/json" \
	-d '{"enabled":true}'
```

Se a API falhar, a tela volta o checkbox para o valor anterior e exibe uma mensagem simples. Enquanto a requisição estiver em andamento, o checkbox fica desabilitado.

Quando `enabled = true` e o produto já estiver crítico no momento da ativação, o inventário publica um `stock.low` imediatamente para o replacement-service tentar criar o pedido automático.

### Fornecedor usado pelo pedido automático

O sistema não usa fornecedor fixo no código. A reposição automática tenta resolver o fornecedor nesta ordem:

1. `fornecedor` salvo no produto e enviado pelo evento `stock.low`.
2. fornecedor do pedido mais recente já existente para o mesmo produto.

Se nenhum fornecedor válido existir, o evento é processado com segurança, mas o pedido automático não é criado. Nesse caso, configure o fornecedor do produto pela criação/API do inventário ou crie um primeiro pedido manual com fornecedor para aquele produto.

### Teste no navegador

1. Suba backend e frontend.
2. Acesse `http://localhost:5173/app/inventory`.
3. Crie um produto com estoque acima do mínimo e informe o fornecedor.
4. Ative/desative o checkbox ao lado do sino e confirme que ele não recarrega a página.
5. Faça uma venda ou atualize o estoque para ficar `estoque <= minimo`.
6. Acesse `Pedidos de reposição` e veja o pedido marcado como “Automático”.

### Teste no Insomnia/curl

Cenário com checkbox desmarcado:

```bash
curl -X POST http://localhost:8003/produtos/ \
	-H "Content-Type: application/json" \
	-d '{"nome":"Mouse","sku":"MOU-AUTO-1","categoria":"Eletrônicos","preco":79.9,"estoque":10,"minimo":5,"fornecedor":"Fornecedor X"}'

curl -X PUT http://localhost:8003/produtos/1 \
	-H "Content-Type: application/json" \
	-d '{"nome":"Mouse","sku":"MOU-AUTO-1","categoria":"Eletrônicos","preco":79.9,"estoque":4,"minimo":5,"fornecedor":"Fornecedor X"}'
```

Resultado esperado: cria notificação crítica, mas não cria pedido automático.

Cenário com checkbox marcado:

```bash
curl -X PATCH http://localhost:8003/produtos/1/auto-reorder \
	-H "Content-Type: application/json" \
	-d '{"enabled":true}'

curl -X PUT http://localhost:8003/produtos/1 \
	-H "Content-Type: application/json" \
	-d '{"nome":"Mouse","sku":"MOU-AUTO-1","categoria":"Eletrônicos","preco":79.9,"estoque":4,"minimo":5,"fornecedor":"Fornecedor X"}'
```

Resultado esperado: cria notificação crítica e um pedido automático de `max(5 - 4, 1) = 1` unidade.

Cenário de ativação enquanto já está crítico:

```bash
curl -X PUT http://localhost:8003/produtos/1 \
	-H "Content-Type: application/json" \
	-d '{"nome":"Mouse","sku":"MOU-AUTO-1","categoria":"Eletrônicos","preco":79.9,"estoque":2,"minimo":5,"fornecedor":"Fornecedor X"}'

curl -X PATCH http://localhost:8003/produtos/1/auto-reorder \
	-H "Content-Type: application/json" \
	-d '{"enabled":true}'
```

Resultado esperado: cria um único pedido automático de `max(5 - 2, 1) = 3` unidades, desde que não exista pedido pendente para o produto.

Para consultar pedidos:

```bash
curl http://localhost:8004/pedidos/
```

### Verificação no banco

Inventory DB:

```sql
SELECT id, nome, estoque, minimo, fornecedor, auto_reorder_enabled
FROM produtos
ORDER BY id;
```

Replacement DB:

```sql
SELECT id, produto_id, quantidade, fornecedor, status, origin, source_event_id
FROM pedidos
ORDER BY id;

SELECT event_id, event_type, created_at
FROM processed_events
ORDER BY created_at DESC;
```

### Cenários obrigatórios

- Checkbox desmarcado: `stock.low` gera notificação crítica e o replacement-service registra que a reposição automática está desativada.
- Checkbox marcado: `stock.low` cria pedido automático se houver fornecedor e nenhum pedido pendente.
- Duplicidade: `event_id`, trava por produto e checagem de pedido `Pendente` impedem dois pedidos abertos para o mesmo produto.
- Produto já crítico: marcar o checkbox publica `stock.low` para criar o pedido automático imediatamente.
- Desativação: desmarcar salva `auto_reorder_enabled = false`, não cancela pedidos existentes e não bloqueia pedidos manuais.
- Pedido recebido: o fluxo atual de recebimento continua aumentando estoque via gRPC e publicando `replacement.received`.

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
	 ├─ notification-service/
	 ├─ replacement-service/
	 └─ sales-service/
```

## Notas técnicas (importantes)

- **CORS está liberado** (`allow_origins=["*"]`) nos serviços (bom para dev; restringir em produção).
- **Tabelas são criadas automaticamente** no startup via `metadata.create_all`. As colunas novas usadas pela reposição automática são adicionadas com `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sem apagar dados existentes.
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
