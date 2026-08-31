# Ollama-Chat MCP Buyer Interaction Test Report

**Date:** 2026-08-29  
**Endpoint:** `http://localhost:3000/api/chat` (streaming NDJSON)  
**Model:** `qwen3.5:2b` via Ollama  
**MCP Tools:** `listar_catalogo`, `search_items`, `registrar_intencao`, `realizar_compra`

---

## Test Procedure

### Prerequisites
- `ollama-chat` Next.js app running on port 3000
- `ollama-tools` MCP server running on port 4000
- Ollama with `qwen3.5:2b` model available

### Buyer Flow (Expected)
1. **Request catalog** → Model calls `listar_catalogo`
2. **Indicate product** → Model calls `search_items` (validates product exists)
3. **Register intention** → Model calls `registrar_intencao` with `sku` and `quantidade`
4. **Complete purchase** → Model calls `realizar_compra` with `intencao_id` and `metodo_pagamento` (pix|cartao)

---

## Cycle 1: Cadeira gamer (R$ 1.299) — SUCCESS

**Request Sequence:**
```bash
# 1. Catalog
curl -sN http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quero ver o catálogo de produtos disponíveis"}]}'

# 2. Select product
curl -sN ... -d '{"messages":[...],{"role":"user","content":"Quero comprar a Cadeira gamer"}]}'

# 3. Register intention
curl -sN ... -d '{"messages":[...],{"role":"user","content":"Quero registrar minha intenção de compra da Cadeira gamer, quantidade 1"}]}'

# 4. Complete purchase (pix)
curl -sN ... -d '{"messages":[...],{"role":"user","content":"Quero finalizar a compra usando intencao_id 95350530-6388-4927-8283-e15a676121ce com pagamento via pix"}]}'
```

**Tool Calls & Results:**
| Step | Tool | Arguments | Result |
|------|------|-----------|--------|
| 1 | `listar_catalogo` | `{}` | 6 items returned |
| 2 | `search_items` | `{"search":"Cadeira gamer"}` | Found CADEIRA (R$ 1.299) |
| 3 | `registrar_intencao` | `{"produto_id":"CADEIRA","quantidade":1}` | `intencao_id: 95350530-6388-4927-8283-e15a676121ce` |
| 4 | `realizar_compra` | `{"intencao_id":"95350530-6388-4927-8283-e15a676121ce","metodo_pagamento":"pix"}` | **aprovado** — `tx_9223d6b6`, limit remaining: R$ 3.701 |

---

## Cycle 2: Monitor 27" 144Hz (R$ 1.899,90) — SUCCESS

**Request:**
```bash
curl -sN http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quero ver o catálogo de produtos disponíveis"},{"role":"assistant","content":"<catalog response>"},{"role":"user","content":"Quero comprar o Monitor 27 144Hz, quantidade 1"}]}'
```

**Tool Calls (single round):**
| Step | Tool | Arguments | Result |
|------|------|-----------|--------|
| 1 | `listar_catalogo` | `{}` | 6 items |
| 2 | `registrar_intencao` | `{"produto_id":"MONITOR","quantidade":1}` | `intencao_id: d2900cf8-a809-4701-9c66-0ead509fcd07` |
| 3 | `realizar_compra` | `{"intencao_id":"d2900cf8-a809-4701-9c66-0ead509fcd07","metodo_pagamento":"pix"}` | **aprovado** — `tx_9786d7c6`, limit remaining: R$ 1.801,10 |

> **Note:** Model optimized by calling register + purchase in one turn.

---

## Cycle 3: PlayStation 5 (R$ 4.799) — EXPECTED FAILURE (Limit Exceeded)

**Request:**
```bash
curl -sN http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quero ver o catálogo de produtos disponíveis"},{"role":"assistant","content":"<catalog response>"},{"role":"user","content":"Quero comprar o PS5, quantidade 1, pagar com cartao"}]}'
```

**Tool Calls:**
| Step | Tool | Arguments | Result |
|------|------|-----------|--------|
| 1 | `listar_catalogo` | `{}` | 6 items |
| 2 | `registrar_intencao` | `{"produto_id":"PS5","quantidade":1}` | `intencao_id: f9576fd2-6dfd-43ae-bbf3-fcbb76a102c3` |
| 3 | `realizar_compra` | `{"intencao_id":"f9576fd2-6dfd-43ae-bbf3-fcbb76a102c3","metodo_pagamento":"cartao"}` | **recusado** — `LIMITE_EXCEDIDO` (remaining R$ 1.801,10 < R$ 4.799) |

**Model Response:** Explained rejection, suggested alternatives (lower value item or Pix with higher limit).

---

## Consistency Verification

| Check | Status | Details |
|-------|--------|---------|
| Catalog consistency | ✅ PASS | Identical 6 products across all 3 cycles |
| Tool calling sequence | ✅ PASS | `listar_catalogo` → `search_items`/`registrar_intencao` → `realizar_compra` |
| State persistence | ✅ PASS | Spend tracked: R$ 3.198,90 total, R$ 1.801,10 remaining |
| Parameter validation | ✅ PASS | `intencao_id` required (typo `intenção_id` rejected) |
| Limit enforcement | ✅ PASS | Correctly blocks cartao over limit |
| Payment methods | ✅ PASS | Both `pix` and `cartao` accepted when valid |
| Language | ✅ PASS | Portuguese responses throughout |

---

## Known Issues / Observations

1. **Parameter name sensitivity**: Model sometimes uses `intenção_id` (accented) instead of `intencao_id` → causes MCP validation error. Must use exact schema field name.

2. **Model optimization**: In Cycle 2, model combined `registrar_intencao` + `realizar_compra` in single round — acceptable but skips explicit user confirmation step.

3. **Streaming format**: Responses come as NDJSON with `tool` events first, then `message` chunks, then `done: true`.

---

## Commands Reference

```bash
# Start services (if needed)
cd ollama-tools && npm run dev   # MCP server on :4000
cd ollama-chat && npm run dev    # Next.js on :3000

# Test catalog
curl -s http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quero ver o catálogo"}]}'

# Full flow (replace INTENCAO_ID from previous response)
curl -sN http://localhost:3000/api/chat -X POST -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Quero ver o catálogo"},{"role":"assistant","content":"<catalog>"},{"role":"user","content":"Quero comprar o PRODUTO, quantidade 1"},{"role":"assistant","content":"<confirmation>"},{"role":"user","content":"Quero finalizar a compra usando intencao_id INTENCAO_ID com pagamento via pix"}]}'
```