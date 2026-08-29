# Debug: Model Halting with Multiple Tool Calls

## Problem
The model (qwen3.5:2b) was halting/stuck after multiple tool calls:
- Emitting only `thinking` tokens without `content`
- Calling the same tool repeatedly (infinite loop)
- Not responding with `done: true`

## Root Causes Found

### 1. Thinking Mode Enabled (Default for Qwen3)
Qwen3 models have a "thinking" mode that outputs reasoning in a separate `thinking` field. The code only handled `content`, causing tokens to appear as empty content.

**Fix**: Added `think: false` to Ollama request:
```typescript
body: JSON.stringify({ 
  model: MODEL, 
  messages: convo, 
  tools, 
  options: { 'temperature': OLLAMA_TEMP, 'num_predict': 0 }, 
  stream: true, 
  think: false  // <-- added
})
```

### 2. Missing `tool_name` in Tool Result Messages
Ollama expects tool result messages to include `tool_name` field to identify which tool was executed. Without it, the model doesn't know the tool completed and retries it.

**Fix**: Updated `Message` type and tool result push:
```typescript
type Message = { role: string; content: string; tool_calls?: ToolCall[]; tool_name?: string }

// When pushing tool result:
convo.push({ 
  role: 'tool', 
  content: JSON.stringify(result), 
  tool_name: call.function.name  // <-- added
})
```

## Request Sequences That Triggered the Issue

### Sequence 1: Multiple Tool Calls in One Turn
```
User: "comprar 1 pc gamer pagando com pix"
→ Model calls: search_items → registrar_intencao → realizar_compra
→ realizar_compra fails (LIMITE_EXCEDIDO)
→ Model retries realizar_compra infinitely (missing tool_name)
```

### Sequence 2: Search + Catalog Fallback
```
User: "comprar 1 ps5 pagando com cartao"
→ Model calls: search_items (search: "ps5") → returns 0 results
→ Model calls: listar_catalogo → finds PS5
→ Model calls: registrar_intencao → realizar_compra
→ realizar_compra fails → Model retries infinitely
```

### Sequence 3: Expired Intent
```
User provides expired intencao_id
→ Model calls: realizar_compra
→ Returns INTENCAO_EXPIRADA
→ Model retries infinitely
```

## Working Test Cases After Fix

### Test 1: Simple Purchase Flow
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "comprar 1 pc gamer pagando com pix"}]}'
```
Result: Model calls tools once, gets results, responds, stops with `done: true`

### Test 2: Multi-turn with Intent ID
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [
    {"role": "user", "content": "comprar 1 pc gamer pagando com pix"},
    {"role": "assistant", "content": "Encontrei... ID da intenção: xxx"},
    {"role": "user", "content": "o id é xxx"}
  ]}'
```
Result: Model calls realizar_compra once, gets result, responds, stops

### Test 3: Search Fallback
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "comprar 1 ps5 pagando com cartao"}]}'
```
Result: Model tries search, falls back to listar_catalogo, proceeds normally

## Files Modified
- `ollama-chat/src/app/api/chat/route.ts`
  - Line 11: Added `tool_name?: string` to Message type
  - Line 69: Added `think: false` to request body
  - Line 138: Added `tool_name: call.function.name` to tool result push