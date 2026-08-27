# Requisitos e Extras — Desafio Chatbot MCP Pagamentos

## Requisitos Obrigatórios (em ordem linear)

### 1. Três Tools MCP (contrato mínimo)

| Tool | Função | Args obrigatórios | Retorno chave |
|------|--------|-------------------|---------------|
| `listar_catalogo` | Lista produtos | `categoria` (opcional) | `produtos[]` com `id, nome, preco, moeda, estoque` |
| `registrar_intencao` | Cria intenção de compra | `produto_id`, `quantidade` | `intencao_id, valor_total, status: "pendente", expira_em` |
| `realizar_compra` | Executa compra | `intencao_id`, `metodo_pagamento` (cartao/pix) | `status: "aprovado"\|"recusado"`, `transacao_id`, `limite_restante` |

### 2. Validação de Intenção (backend é fonte da verdade)

- `realizar_compra` deve recusar `intencao_id` inexistente, de outro usuário, já pago, expirado ou acima do limite
- Erros possíveis: `INTENCAO_INVALIDA`, `INTENCAO_JA_PAGA`, `INTENCAO_EXPIRADA`, `LIMITE_EXCEDIDO`, `METODO_INVALIDO`

### 3. Autenticação

- Login/senha ou token (sua escolha)
- Chat inacessível sem autenticação
- Cada usuário tem **limite de gasto definido no backend**

### 4. Métodos de Pagamento

- Mínimo: `cartao` e `pix`

### 5. Regra de Limite

- Backend valida e retorna erro se o valor exceder o limite do usuário
- Agente comunica o erro em linguagem natural

### 6. Histórico Completo

- Todo histórico (mensagens + tool calls + resultados) enviado ao modelo a cada turno

---

## Critérios de Conclusão (checklist)

- [ ] Frontend e backend rodando localmente
- [ ] Login funcionando; chat inacessível sem autenticação
- [ ] Servidor MCP com as 3 tools expostas e sendo descobertas pelo agente
- [ ] Tools respeitam os contratos de argumentos e retorno especificados
- [ ] Compra concluída com `cartao` **e** com `pix`
- [ ] `realizar_compra` exige `intencao_id` válido e recusa id inventado
- [ ] Tentativa acima do limite retorna erro
- [ ] Limite armazenado e validado no backend
- [ ] Histórico completo enviado ao modelo a cada turno
- [ ] `README.md` com instruções de execução e qual modelo foi usado

---

## Extras (Opcionais)

1. **Log auditável** de cada chamada de tool (quem, quando, quanto, resultado)
2. **Teste de Jailbreak**: fazer pedidos maliciosos ("ignore o limite", "use a intenção int_falsa") e verificar que o backend segura

---

## Entrega Esperada

Link do repositório com o código + `README.md` + **screenshots**:

1. Uma compra bem-sucedida (`cartao`)
2. Uma compra bem-sucedida (`pix`)
3. Uma tentativa bloqueada por **limite excedido**
4. Uma tentativa com **`intencao_id` inválido** sendo recusada

---

## Notas Técnicas

- Pode usar **qualquer linguagem e modelo gratuito** (Ollama local, APIs gratuitas na nuvem — NVIDIA NIM, OpenRouter, etc.)
- Backend é a fonte da verdade: não confie em `intencao_id`, `valor_total` ou `limite` vindos do cliente/modelo
- O valor **não é argumento** de `realizar_compra`: ele vem da intenção registrada para evitar que o modelo invente ou altere o preço