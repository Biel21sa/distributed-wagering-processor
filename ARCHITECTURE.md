# Arquitetura

Este documento explica como o Distributed Wagering Processor é estruturado e as garantias que ele oferece. Ele complementa o [README](./README.md), que cobre como executar o projeto.

## Objetivos e garantias

O sistema é um ledger financeiro para apostas. Seu design gira em torno de quatro propriedades:

1. **Atomicidade** — uma aposta é aplicada por completo (saldo da carteira, entrada no ledger, registro da transação e eventos de saída) ou não é aplicada de forma alguma.
2. **Idempotência** — a mesma operação lógica, reprocessada ou duplicada qualquer número de vezes, produz exatamente um efeito financeiro.
3. **Entrega ao-menos-uma-vez, nunca perdida** — mensagens de entrada e eventos de saída toleram quedas e reentrega. O objetivo é *não perder*, não *exactly once* na camada de transporte; a correção é garantida na camada de dados, não no transporte.
4. **Reprodutibilidade** — o schema é definido apenas por migrations, então qualquer ambiente (local, CI, produção) é construído de forma idêntica.

## Estrutura em camadas (hexagonal)

Todo módulo segue o mesmo formato de quatro camadas:

```
module/
  api/             # Controllers HTTP + DTOs (adaptadores de entrada)
  application/     # Casos de uso, ports (interfaces), workers
  domain/          # Entidades, value objects, invariantes, erros
  infrastructure/  # Repositórios MikroORM, mappers, clients SQS (adaptadores de saída)
```

- **domain** contém lógica de negócio pura, sem dependências de framework ou persistência (`Wallet`, `Money`, `WagerTransaction`, `WalletLedgerEntry`, failure codes).
- **application** orquestra os casos de uso e define os **ports** — interfaces como `WalletRepository`, `WagerTransactionRepository`, `OutboxRepository`. Depende de abstrações, não do MikroORM.
- **infrastructure** implementa esses ports com MikroORM e mapeia entre objetos de domínio e entidades de persistência.
- **api** expõe os casos de uso via HTTP.

As dependências sempre apontam para dentro: `api` → `application` → `domain`, com a `infrastructure` implementando os ports de `application`.

## Módulos

| Módulo | Responsabilidade |
| --- | --- |
| `wallet` | O agregado de carteira, seu ledger, criação (com uma transação `OPENING`) e reconciliação. |
| `wagering` | O domínio central: processar transações de aposta e resolver referências. |
| `outbox` | Armazenamento do outbox transacional e o worker publisher. |
| `inbox` | Inbox transacional para deduplicar mensagens de entrada. |
| `messaging` | Wiring do consumer SQS que alimenta o caso de uso do inbox. |
| `health` | Probes de liveness/readiness. |
| `shared` | Concerns transversais: erros de domínio, o filtro global de exceção HTTP, middleware de correlation-id, helpers de erro de DB. |

## Modelo de domínio

- **Wallet** — mantém um saldo `Money` e uma `version`. Cada `debit`/`credit` altera o saldo e incrementa a versão na camada de domínio.
- **Money** — um value object baseado em `decimal.js` com precisão de 2 casas decimais. `Money.from()` permite valores negativos (necessários para a matemática interna das reversões), enquanto `Money.nonNegative()` e o regex do `MoneyDto` rejeitam negativos na borda da API. Essa separação mantém o domínio expressivo ao mesmo tempo que protege as entradas.
- **WagerTransaction** — o registro de uma operação. Tipos (kinds): `OPENING`, `BET`, `WIN`, `LOSS`, `REFUND`, `ROLLBACK`. Status: `PENDING`, `PENDING_REFERENCE`, `PROCESSED`, `REJECTED`, `FAILED`. `OPENING` é interno, criado quando uma carteira é aberta com saldo diferente de zero.
- **WalletLedgerEntry** — um registro imutável de `DEBIT`/`CREDIT` com `balanceBefore`/`balanceAfter`, ligado tanto a uma carteira quanto à transação que o produziu.

### Failure codes

Rejeições carregam um `FailureCode` específico, e o desafio exige distinguir situações parecidas:

- `INSUFFICIENT_FUNDS` — um `BET` direto sem saldo suficiente.
- `NEGATIVE_BALANCE_REVERSAL` — uma **reversão** (estorno/rollback) que levaria o saldo a ficar negativo. Distinto de `INSUFFICIENT_FUNDS` de propósito.
- `INVALID_REFUND_REFERENCE` / `INVALID_ROLLBACK_REFERENCE` — a transação referenciada existe mas não corresponde (provider, jogador, carteira, round, valor ou tipo).
- `REFERENCE_NOT_FOUND` — uma referência nunca apareceu após o número máximo de tentativas.
- `DUPLICATE_REVERSAL` — um segundo estorno/rollback para a mesma referência (protegido tanto pela lógica de aplicação quanto por um índice único parcial do PostgreSQL).

## Integridade transacional (Unit of Work)

Cada caso de uso roda dentro de um único bloco `em.transactional(...)`, de modo que a atualização da carteira, a inserção no ledger, o registro da transação e os eventos do outbox são commitados ou revertidos juntos.

Como as entidades de persistência modelam as foreign keys como colunas escalares simples (sem relações ORM mapeadas), o MikroORM não consegue inferir a ordem de inserção sozinho. Onde existe uma dependência de foreign key (uma linha de ledger referencia sua transação de aposta, que referencia sua carteira), a ordem é feita de forma explícita para que as linhas pai existam antes da filha. Tudo permanece dentro da mesma transação de banco, preservando a atomicidade.

As duas foreign keys aplicadas em nível de banco são:

- `fk_ledger_wallet`: `wallet_ledger_entries.wallet_id → wallets.id`
- `fk_ledger_transaction`: `wallet_ledger_entries.transaction_id → wager_transactions.id`

## Idempotência

A idempotência é garantida na camada de banco, não apenas no código de aplicação:

- `wager_transactions` tem uma constraint única em `idempotency_key` (`uq_wager_idempotency_key`) e em `(provider_id, external_transaction_id)` (`uq_wager_provider_external_id`).
- Quando um duplicado é inserido, a violação de unicidade é capturada, a transação existente é carregada, e o **snapshot de resposta** armazenado (`response_balance_amount` / `response_balance_currency`) é reproduzido. O replay é sinalizado com `idempotentReplay: true`.
- Se a mesma chave de idempotência chegar com um *payload hash diferente*, a requisição é rejeitada com `IDEMPOTENCY_CONFLICT` em vez de reproduzir silenciosamente.

Isso significa que 50 requisições idênticas concorrentes resultam em exatamente uma transação, uma entrada de ledger e uma mudança de saldo — 1 execução real e 49 replays — e isso vale entre instâncias separadas da aplicação e entre reinicializações do ORM, porque a garantia vive no PostgreSQL.

## Concorrência e locking

Operações concorrentes na mesma carteira são serializadas com um **lock pessimista de linha** (`SELECT ... FOR UPDATE`) via `findByIdForUpdate`. O lock é por carteira, não global: operações em carteiras diferentes seguem em paralelo.

É isso que torna a corrida clássica segura — dada uma carteira com `100` e dois `BET 80` simultâneos, um fica `PROCESSED` e o outro `REJECTED` com `INSUFFICIENT_FUNDS`, terminando com saldo `20` e uma única entrada de ledger. A `version` da carteira incrementa a cada mudança de saldo bem-sucedida, fornecendo uma trilha de auditoria da ordem das mutações.

## Outbox transacional

Eventos de domínio não são publicados inline. Em vez disso, eles são gravados em uma tabela `outbox_messages` **na mesma transação** da mudança de negócio. Um worker publisher separado depois os lê e publica:

- O worker reivindica linhas pendentes com `SELECT ... FOR UPDATE SKIP LOCKED`, de modo que múltiplas instâncias de publisher dividem o trabalho sem atrapalhar umas às outras.
- Um evento é marcado como publicado somente *depois* de enviado com sucesso. Se o processo morrer entre a publicação e o `markPublished`, a linha permanece com `published_at IS NULL` e outro publisher a reenvia.
- Consequência: um evento pode ser publicado mais de uma vez. Isso é aceitável — o requisito é *nunca perder*, e espera-se que os consumidores a jusante sejam idempotentes.

A tabela de outbox não tem foreign keys, então os eventos não impõem restrições de ordem de inserção e podem ser gravados livremente dentro da transação.

## Inbox transacional

Mensagens SQS de entrada são deduplicadas com uma tabela `inbox_messages` chaveada pelo id da mensagem. O consumer:

1. Registra a mensagem no inbox e aplica o efeito financeiro **em uma única transação**.
2. Confirma (deleta) a mensagem SQS somente após essa transação ser commitada.

Se uma mensagem for reentregue (ex.: processada mas não confirmada antes de uma queda), o inbox já contém seu id, então o efeito financeiro **não** é aplicado novamente — a mensagem é simplesmente confirmada (ACK). Isso resulta em consumo ao-menos-uma-vez com efeito exatamente-uma-vez.

## Resolução de referências fora de ordem

Estornos e rollbacks referenciam uma transação anterior por id externo. Em um sistema distribuído, uma reversão pode chegar **antes** da transação que ela reverte.

- Se a referência estiver ausente, a reversão é estacionada como `PENDING_REFERENCE` e um retry é agendado com backoff exponencial.
- O `PendingReferenceWorker` periodicamente reprocessa transações estacionadas (`findPendingReferences` retorna as linhas cujo horário de próxima tentativa já venceu).
- Assim que a transação referenciada existe e está `PROCESSED`, a reversão se resolve: valida a correspondência, aplica o movimento de ledger inverso e transiciona para `PROCESSED`.
- Após o número máximo de tentativas, é rejeitada com `REFERENCE_NOT_FOUND`.

Uma transação é, portanto, salva mais de uma vez ao longo de seu ciclo de vida (estacionada, depois resolvida). O repositório de wager-transaction trata isso como um upsert — inserindo quando nova, atualizando in-place quando a linha já existe — de modo que re-salvar uma transação estacionada não colide com sua chave primária.

## Semântica das reversões

- **Estorno (Refund) de um BET** → credita de volta o valor debitado.
- **Rollback de um BET** → credita o valor de volta.
- **Rollback de um WIN** → debita o valor anteriormente creditado. Se a carteira não puder cobri-lo, a reversão é rejeitada com `NEGATIVE_BALANCE_REVERSAL`.
- Reversões duplicadas para a mesma referência são bloqueadas por índices únicos parciais (`uq_refund_reference`, `uq_rollback_reference`), além das verificações de aplicação — sob concorrência, uma vence e a outra é rejeitada com `DUPLICATE_REVERSAL`.

## Tratamento de erros

Um `GlobalExceptionFilter` global mapeia exceções para respostas HTTP:

- `HttpException` → seu próprio status com o corpo do framework.
- `DomainError` → status mapeado por código: `RESOURCE_NOT_FOUND` → 404; `IDEMPOTENCY_CONFLICT` / `WALLET_ALREADY_EXISTS` → 409; `INSUFFICIENT_FUNDS` / `CURRENCY_MISMATCH` → 422; outros erros de domínio → 400.
- Qualquer outra coisa → 500, e a exceção é logada com sua stack para que falhas inesperadas sejam diagnosticáveis.

A validação acontece na borda via um `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), de modo que as entradas de query/body são coeridas e campos desconhecidos são rejeitados antes de chegar a um caso de uso.

## Observabilidade

Um correlation id flui da borda HTTP através do caso de uso até os eventos do outbox:

```
HTTP (X-Correlation-Id) → caso de uso → WagerTransaction / EventContext → Evento no Outbox
```

O `CorrelationIdMiddleware` estabelece o id por requisição, e ele é propagado para o `EventContext` usado ao enfileirar eventos no outbox, de modo que uma única operação possa ser rastreada de ponta a ponta.

## Schema reproduzível

Não há geração de schema em tempo de execução. O diretório `migrations/` é a única fonte da verdade, e um teste de integração constrói o banco apenas a partir das migrations e verifica que todas as tabelas exigidas existem. As constraints que o desafio exige (chaves de idempotência únicas, carteira única por jogador+moeda, unicidade de ledger, unicidade de reversão, checks de failure-code) vivem nas migrations, de modo que estão garantidas em todos os ambientes.

## Executando múltiplas instâncias

O design assume escalabilidade horizontal:

- **Instâncias de API/consumer** são stateless; a correção vem das constraints do PostgreSQL e dos locks de linha.
- **Instâncias de publisher** coordenam via `SKIP LOCKED`, então escalar publishers (`docker compose up -d --scale ...`) simplesmente aumenta a vazão sem duplicar uma reivindicação.
- **Idempotência e deduplicação do inbox** valem entre instâncias porque são garantidas no banco de dados compartilhado.
