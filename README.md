# Distributed Wagering Processor

Um processador de transações de apostas distribuído e financeiramente consistente, construído com [NestJS](https://nestjs.com/), [MikroORM](https://mikro-orm.io/) e PostgreSQL. Ele processa operações de carteira (apostas, ganhos, perdas, estornos, rollbacks) com garantias fortes de atomicidade, idempotência e entrega ao-menos-uma-vez entre múltiplas instâncias.

Para a justificativa de design e os detalhes internos, veja [ARCHITECTURE.md](./ARCHITECTURE.md).

## O que ele faz

- Mantém **carteiras** de jogadores com um **ledger** completo de cada mudança de saldo.
- Processa **transações de aposta** (`BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`) tanto via HTTP quanto consumindo mensagens do SQS.
- Garante **exatamente um** efeito financeiro por chave de idempotência, mesmo sob requisições concorrentes ou duplicadas.
- Publica eventos de domínio de forma confiável através de um **outbox transacional**.
- Deduplica mensagens de entrada através de um **inbox transacional**.
- Resolve estornos/rollbacks **fora de ordem** (uma reversão que chega antes da transação referenciada é estacionada e reprocessada).

## Stack tecnológica

- **Runtime:** Node.js + [Bun](https://bun.sh/) como gerenciador de pacotes / executor de scripts
- **Framework:** NestJS 12
- **Persistência:** PostgreSQL 17 via MikroORM 7 (schema orientado a migrations)
- **Mensageria:** AWS SQS (FIFO), emulado localmente com LocalStack
- **Testes:** Vitest + Supertest (os testes de integração rodam contra um PostgreSQL real)

## Pré-requisitos

- Bun instalado
- Docker + Docker Compose (para PostgreSQL e LocalStack)

## Primeiros passos

1. Instale as dependências:

   ```bash
   bun install
   ```

2. Crie seu arquivo de ambiente a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Suba a infraestrutura (PostgreSQL + LocalStack SQS):

   ```bash
   docker compose up -d postgres localstack
   ```

   Na primeira inicialização isso também cria o banco de testes dedicado `wagering_test` (veja `docker/postgres/init`).

4. Aplique as migrations do banco:

   ```bash
   bun run migration:up
   ```

5. Rode a aplicação em modo watch:

   ```bash
   bun run start:dev
   ```

A API escuta em `http://localhost:3000` por padrão.

## Configuração

A configuração é lida a partir de variáveis de ambiente (veja `.env.example` para a lista completa).

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `PORT` | Porta HTTP | `3000` |
| `DB_HOST` / `DB_PORT` | Host e porta do PostgreSQL | `localhost` / `5432` |
| `DB_NAME` | Nome do banco | `wagering` |
| `DB_USERNAME` / `DB_PASSWORD` | Credenciais do banco | `wagering` / `wagering` |
| `DB_NAME_TEST` | Banco usado pela suíte de testes de integração | `wagering_test` |
| `SQS_ENDPOINT` | Endpoint do SQS (LocalStack localmente) | `http://localhost:4566` |
| `AWS_REGION` | Região da AWS | `us-east-1` |
| `SQS_WAGER_QUEUE_URL` | Fila FIFO de transações de aposta de entrada | — |
| `SQS_WAGER_DLQ_URL` | Dead-letter queue | — |
| `SQS_EVENTS_QUEUE_URL` | Fila FIFO de eventos de saída | — |
| `PENDING_REFERENCE_WORKER_ENABLED` | Habilita o worker em background que reprocessa estornos/rollbacks estacionados | `false` |
| `MIKRO_ORM_DEBUG` | Loga SQL quando `true` | `false` |

## API HTTP

### Carteiras (Wallets)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/wallets` | Cria uma carteira com saldo inicial (cria uma transação `OPENING` + entrada de ledger `CREDIT` atomicamente). |
| `GET` | `/wallets/:id` | Busca uma carteira. |
| `GET` | `/wallets/:id/ledger` | Entradas do ledger paginadas por cursor (`?limit=`, `?cursor=`). |
| `POST` | `/wallets/:id/reconciliation` | Recalcula o saldo a partir do ledger e reporta a consistência. |

### Apostas (Wagering)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/wagering/transactions` | Processa uma transação de aposta. Exige o header `Idempotency-Key`; o `X-Correlation-Id` é propagado para observabilidade. |
| `GET` | `/wagering/transactions/:id` | Busca uma transação pelo seu id interno. |
| `GET` | `/providers/:providerId/wagering/transactions/:externalTransactionId` | Busca uma transação por provider + id externo. |

### Saúde (Health)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/health/live` | Probe de liveness. |
| `GET` | `/health/ready` | Probe de readiness (verifica a conectividade com o PostgreSQL). |

### Exemplo

```bash
# Criar uma carteira
curl -X POST http://localhost:3000/wallets \
  -H "Content-Type: application/json" \
  -d '{
    "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
    "initialBalance": { "amount": "1000.00", "currency": "BRL" }
  }'

# Processar uma aposta
curl -X POST http://localhost:3000/wagering/transactions \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: provider-a:bet-1" \
  -H "X-Correlation-Id: 7efc5261-8c2a-4250-872c-6f1b1f712694" \
  -d '{
    "providerId": "provider-a",
    "externalTransactionId": "bet-1",
    "playerId": "0192f28f-5dc0-7d58-bdb2-814ad6a0f4a1",
    "walletId": "<wallet-id>",
    "roundId": "round-1",
    "gameId": "fortune-chimp",
    "kind": "BET",
    "money": { "amount": "25.00", "currency": "BRL" }
  }'
```

## Banco de dados & migrations

O schema é definido inteiramente por migrations em `migrations/` — não há geração de schema em tempo de execução, o que mantém os ambientes reproduzíveis.

```bash
bun run migration:up       # aplica as migrations pendentes
bun run migration:down     # reverte a última migration
bun run migration:create   # gera uma nova migration a partir do diff das entidades
bun run migration:pending  # lista as migrations pendentes
bun run migration:list     # lista as migrations aplicadas
```

## Testes

Os testes de integração rodam contra uma instância real de PostgreSQL e usam o banco dedicado `wagering_test`. Garanta que o PostgreSQL esteja no ar e que o `wagering_test` exista (criado automaticamente na primeira inicialização do container, ou manualmente):

```bash
docker exec -it wagering-postgres psql -U wagering -d wagering \
  -c "CREATE DATABASE wagering_test OWNER wagering;"
```

Então:

```bash
bun run test          # roda a suíte completa (Vitest)
bun run test:watch    # modo watch
```

A suíte cobre, entre outros:

- **Reprodutibilidade das migrations** — todo o schema é construído apenas a partir das migrations.
- **Regras de domínio** — resultados de BET/WIN/LOSS, saldo insuficiente, reversões que gerariam saldo negativo.
- **Idempotência** — 50 requisições idênticas concorrentes produzem exatamente um efeito.
- **Concorrência** — a corrida `100 vs 80 + 80` resolve em uma processada / uma rejeitada via lock em nível de linha.
- **Outbox transacional** — eventos sobrevivem a quedas do publisher; dois publishers dividem o trabalho com `SKIP LOCKED`.
- **Inbox transacional** — a reentrega do SQS não aplica o efeito financeiro em dobro.
- **Reversões fora de ordem** — estornos/rollbacks estacionados como `PENDING_REFERENCE` e resolvidos pelo worker.
- **API HTTP** — requisição/resposta ponta a ponta e mapeamento de erros.

## Estrutura do projeto

```
src/
  app.module.ts             # Módulo raiz, conecta middleware + MikroORM
  main.ts                   # Bootstrap (ValidationPipe global + filtro de exceção)
  modules/
    wallet/                 # Agregado de carteira, ledger, criação/reconciliação
    wagering/               # Processamento de transações de aposta (o domínio central)
    outbox/                 # Outbox transacional + worker publisher
    inbox/                  # Inbox transacional (deduplicação)
    messaging/              # Wiring do consumer SQS
    health/                 # Probes de liveness/readiness
  shared/                   # Transversais: erros, filtros HTTP, helpers de DB
migrations/                 # Migrations do MikroORM (fonte da verdade do schema)
docker/                     # Scripts de init do PostgreSQL + LocalStack
test/                       # Testes de integração, concorrência, mensageria, outbox e HTTP
```

Cada módulo segue uma estrutura hexagonal (`api` / `application` / `domain` / `infrastructure`). Veja [ARCHITECTURE.md](./ARCHITECTURE.md) para os detalhes.
