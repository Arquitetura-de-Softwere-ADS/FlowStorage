# Conversa do Chat - FlowStorage

> Nota: este arquivo registra a conversa visível entre usuário e assistente. Instruções internas do sistema/desenvolvedor e raciocínio privado não foram incluídos.

## Contexto Inicial do Ambiente

```text
cwd: /home/vitor/Documentos/IFRN/5°periodo/projetos/FlowStorage
shell: bash
data atual: 2026-06-09
timezone: America/Fortaleza
arquivo ativo no IDE: docker-compose.yml
aba aberta: docker-compose.yml
```

---

## 1. Pedido Inicial

### Usuário

```text
# Context from my IDE setup:

## Active file: docker-compose.yml

## Open tabs:
- docker-compose.yml: docker-compose.yml

## My request for Codex:
Analise o contexto desse simples sitema. 

E diga de qual forma podemos implmentar mensageria, seguindo essas instruções da atividade:

A arquitetura publish-subscribe é uma abordagem eficaz para aplicações que exigem comunicação assíncrona, escalável e em tempo real entre diferentes componentes ou usuários. Esta atividade tem como objetivo consolidar os conhecimentos adquiridos sobre arquiteturas baseadas em mensagens, permitindo que os alunos construam aplicações que simulam ambientes reais de comunicação distribuída.


Nesta atividade você irá implementar uma aplicação simples utilizando a arquitetura publish-subscribe, empregando canais de comunicação que possibilitem a distribuição de mensagens entre múltiplos clientes ou serviços em tempo real.

Orientações sobre Tecnologias

Os grupos têm liberdade para utilizar tecnologias baseadas em mensagens, como:
RabbitMQ, Apache Kafka, Redis Pub/Sub, MQTT, entre outros.
Frameworks que integram essas tecnologias, como NestJS, Spring Boot com WebSockets, etc.
As soluções devem evidenciar claramente os papéis de publicador, assinante e o canal intermediário de comunicação (broker ou servidor socket).

Apresente, em formato de slides, um tutorial técnico sobre as tecnologia de mensageria de terceiros utilizadas  (ex.: RabbitMQ, Kafka, etc.),:
Conceito da ferramenta adotada.
Justificativa da escolha.
Como configurar e utilizar.
```

### Assistente

```text
Vou fazer uma leitura rápida da estrutura e do `docker-compose.yml` para entender o sistema antes de sugerir a mensageria. Vou focar em uma solução simples que deixe bem visíveis publicador, assinante e broker, porque isso parece central na atividade.
```

### Assistente

```text
A base já mostra uma arquitetura de microsserviços bem didática: serviços FastAPI separados, cada um com seu Postgres, e comunicação síncrona via gRPC com o inventário. Agora vou olhar os fluxos de negócio para apontar onde o publish-subscribe encaixa sem complicar demais.
```

### Assistente

```text
O ponto mais natural apareceu: venda baixa estoque e reposição aumenta estoque, ambos hoje chamando o inventário diretamente por gRPC. Para a atividade, dá para manter o gRPC onde ele faz sentido e adicionar mensageria para eventos de domínio, especialmente “venda criada”, “estoque alterado” e “estoque baixo”.
```

### Assistente

```text
Também notei que os serviços estão em Python/FastAPI e Docker Compose, então RabbitMQ encaixa com baixa fricção: um container a mais no Compose e a lib `pika` nos serviços que publicam/consomem. Kafka seria mais pesado para esse cenário de sala de aula.
```

### Assistente

Pelo contexto do FlowStorage, a melhor forma é implementar mensageria como **eventos assíncronos entre os microserviços**, sem substituir totalmente o gRPC.

Hoje o sistema está assim:

- `sales-service` registra venda e chama o `inventory-service` via gRPC para baixar estoque.
- `replacement-service` cria/recebe pedidos e chama o `inventory-service` via gRPC para consultar ou aumentar estoque.
- `inventory-service` é a fonte de verdade do estoque.
- Cada serviço tem seu próprio Postgres.
- Tudo roda em Docker Compose.

Para a atividade, eu recomendaria usar **RabbitMQ com Pub/Sub via exchange do tipo `topic`**.

**Por que RabbitMQ aqui**
- É mais simples que Kafka para uma aplicação acadêmica pequena.
- Funciona muito bem com Docker Compose.
- Deixa claro o papel de:
  - **publicador**: serviço que emite evento.
  - **assinante**: serviço que escuta evento.
  - **broker/canal**: RabbitMQ.
- Tem painel web em `localhost:15672`, ótimo para apresentar nos slides.
- Integra fácil com Python/FastAPI usando `pika`.

**Arquitetura sugerida**
Manter o gRPC para operações que precisam de resposta imediata, como:

- “existe estoque suficiente?”
- “baixe o estoque agora”
- “aumente o estoque agora”

E usar RabbitMQ para eventos depois que algo aconteceu:

```text
Sales Service ── publica ──▶ RabbitMQ ──▶ Notification Service
Inventory Service ─ publica ▶ RabbitMQ ──▶ Replacement Service
Replacement Service ─ publica ▶ RabbitMQ ─▶ Notification Service
```

**Eventos possíveis**
Usaria uma exchange chamada:

```text
flowstorage.events
```

Com routing keys:

```text
sales.created
stock.updated
stock.low
replacement.created
replacement.received
replacement.cancelled
```

Exemplo de fluxo bem legal para a atividade:

1. Usuário registra uma venda no `sales-service`.
2. `sales-service` salva a venda e chama o `inventory-service` via gRPC.
3. `inventory-service` baixa o estoque.
4. `inventory-service` publica no RabbitMQ:

```json
{
  "event": "stock.updated",
  "product_id": 1,
  "product_name": "Mouse",
  "current_stock": 3,
  "minimum_stock": 5
}
```

5. Se o estoque ficar abaixo do mínimo, o `inventory-service` publica também:

```json
{
  "event": "stock.low",
  "product_id": 1,
  "product_name": "Mouse",
  "current_stock": 3,
  "minimum_stock": 5
}
```

6. O `replacement-service` assina `stock.low` e pode criar automaticamente um pedido de reposição pendente.
7. Um `notification-service` assina `stock.*`, `sales.*` e `replacement.*` e envia notificações em tempo real para o frontend via WebSocket.

Essa abordagem fica excelente para demonstrar Pub/Sub porque um mesmo evento pode ser recebido por múltiplos consumidores.

**Mudanças principais**
No `docker-compose.yml`, adicionar RabbitMQ:

```yaml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"
    - "15672:15672"
  environment:
    RABBITMQ_DEFAULT_USER: guest
    RABBITMQ_DEFAULT_PASS: guest
```

Adicionar `pika` nos serviços que publicam/consomem:

```txt
pika
```

Criar um helper simples, por exemplo `app/messaging.py`, com funções para publicar eventos no RabbitMQ.

**Onde publicar**
No `sales-service`:

- publicar `sales.created` depois que a venda for salva com sucesso.

No `inventory-service`:

- publicar `stock.updated` depois de `DecreaseStock` e `IncreaseStock`.
- publicar `stock.low` quando `produto.estoque <= produto.minimo`.

No `replacement-service`:

- publicar `replacement.created`, `replacement.received` e `replacement.cancelled`.

**Onde consumir**
A opção mais didática seria criar um novo serviço:

```text
notification-service
```

Ele ficaria assinando os eventos do RabbitMQ e poderia:

- imprimir logs no terminal;
- salvar histórico;
- mandar eventos em tempo real para o frontend via WebSocket.

Para a atividade, eu implementaria pelo menos dois assinantes:

```text
replacement-service  -> assina stock.low
notification-service -> assina todos os eventos
```

Assim vocês mostram claramente que **um evento publicado pode ser entregue a múltiplos interessados**.

**Estrutura dos slides**
Sugestão direta para a apresentação:

1. **Título**
   - Mensageria Pub/Sub no FlowStorage com RabbitMQ

2. **Problema**
   - Serviços precisam reagir a eventos sem depender de chamadas diretas entre si.

3. **Conceito Pub/Sub**
   - Publicador envia mensagem.
   - Broker distribui.
   - Assinantes recebem conforme interesse.

4. **Ferramenta escolhida: RabbitMQ**
   - Broker de mensagens.
   - Exchanges, queues e routing keys.
   - Painel web de gerenciamento.

5. **Justificativa**
   - Simples com Docker.
   - Boa integração com Python.
   - Visualização fácil pelo painel.
   - Adequado para microsserviços pequenos.

6. **Arquitetura no FlowStorage**
   - Mostrar `sales-service`, `inventory-service`, `replacement-service`, `notification-service` e `RabbitMQ`.

7. **Eventos**
   - `sales.created`
   - `stock.updated`
   - `stock.low`
   - `replacement.created`

8. **Configuração**
   - Trecho do `docker-compose.yml`.
   - Instalação do `pika`.

9. **Exemplo de publicação**
   - Serviço de inventário publicando `stock.low`.

10. **Exemplo de consumo**
   - Serviço de reposição ouvindo `stock.low`.

11. **Demonstração**
   - Criar produto.
   - Fazer venda.
   - Estoque baixa.
   - Evento aparece no RabbitMQ.
   - Reposição/notificação recebe evento.

12. **Conclusão**
   - gRPC continua para comandos síncronos.
   - RabbitMQ entra para eventos assíncronos.
   - Sistema fica mais desacoplado, escalável e em tempo real.

Resumo: eu implementaria **RabbitMQ + exchange topic + eventos de estoque/venda/reposição**, mantendo o gRPC atual. É simples, combina bem com o projeto e atende muito claramente aos critérios da atividade.

---

## 2. Inscrição Para Monitorar Itens de Estoque Específicos

### Usuário

```text
# Context from my IDE setup:

## Active file: docker-compose.yml

## Open tabs:
- docker-compose.yml: docker-compose.yml

## My request for Codex:
Inscrição para monitorar itens de estoque específicos.

Uma das funcionalidades que a atividade exige seria essa, como ela seria implementada nesse contexto
```

### Assistente

Nesse contexto, essa funcionalidade pode ser implementada como uma **inscrição de usuários/serviços em eventos de estoque de produtos específicos**.

A ideia seria:

```text
Frontend ── HTTP/WebSocket ─▶ Notification Service
Inventory Service ── publica eventos ─▶ RabbitMQ
RabbitMQ ── entrega eventos ─▶ Notification Service
Notification Service ── avisa usuários inscritos
```

O frontend **não se conecta direto ao RabbitMQ**. Ele se inscreve pelo backend.

**Exemplo prático**
O usuário quer monitorar o produto `id = 3`.

Ele faz uma requisição:

```http
POST /monitoramentos
```

```json
{
  "produto_id": 3
}
```

O sistema salva algo como:

```text
user_id | produto_id
1       | 3
```

Quando o estoque do produto 3 mudar, o `inventory-service` publica um evento no RabbitMQ:

```json
{
  "event": "stock.updated",
  "product_id": 3,
  "product_name": "Teclado Mecânico",
  "current_stock": 4,
  "minimum_stock": 5
}
```

Com uma routing key assim:

```text
stock.product.3.updated
```

Ou, se estiver abaixo do mínimo:

```text
stock.product.3.low
```

Aí o `notification-service` recebe esse evento e verifica:

> “Existe algum usuário inscrito no produto 3?”

Se sim, ele envia uma notificação via WebSocket ou salva no banco para o usuário ver depois.

**Como ficaria com RabbitMQ**
Usaria uma exchange do tipo `topic`:

```text
flowstorage.events
```

O `inventory-service` publicaria eventos com routing keys específicas:

```text
stock.product.1.updated
stock.product.2.updated
stock.product.3.low
```

O assinante poderia escutar:

```text
stock.product.3.*
```

Ou seja: “quero todos os eventos de estoque do produto 3”.

Também poderia escutar todos os produtos:

```text
stock.product.*.*
```

E filtrar no `notification-service`.

**Implementação mais simples para o projeto**
Eu faria assim:

1. Criar um novo serviço `notification-service`.
2. Adicionar RabbitMQ no `docker-compose.yml`.
3. O `inventory-service` publica eventos quando estoque muda.
4. O `notification-service` consome eventos `stock.product.*.*`.
5. Criar tabela de inscrições:

```text
stock_subscriptions
- id
- user_id
- product_id
- created_at
```

6. Criar endpoints:

```http
POST /subscriptions/stock
GET /subscriptions/stock
DELETE /subscriptions/stock/{id}
```

7. Criar WebSocket:

```http
/ws/notifications
```

Assim, o fluxo final seria:

```text
Usuário se inscreve no produto 3
        ↓
Inventory altera estoque do produto 3
        ↓
Inventory publica stock.product.3.updated no RabbitMQ
        ↓
Notification Service recebe o evento
        ↓
Notification Service procura usuários inscritos no produto 3
        ↓
Frontend recebe alerta em tempo real
```

Essa funcionalidade evidencia muito bem o Pub/Sub porque:

- o `inventory-service` é o **publicador**;
- o RabbitMQ é o **broker/canal intermediário**;
- o `notification-service` é o **assinante**;
- o usuário escolhe quais “canais” quer acompanhar, no caso, produtos específicos.

---

## 3. Solicitação Para Gerar Este Markdown

### Usuário

```text
# Context from my IDE setup:

## Active file: docker-compose.yml

## Open tabs:
- docker-compose.yml: docker-compose.yml

## My request for Codex:
gere um md de absolutamente toda a conversa deste chat
```

