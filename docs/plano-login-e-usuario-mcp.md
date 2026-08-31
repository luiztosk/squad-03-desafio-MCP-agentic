# Plano: Login / Senha + Integração de Usuário no MCP

## Objetivo

Fazer o chat exigir autenticação (login/senha) e garantir que as tools do MCP operem por usuário — de forma simples, didática e entregável.

---

## 1. Estado atual

### O que já existe

**`ollama-chat/src/app/page.tsx`** — a página do chat já tem a lógica de proteção:
- Lê `chat-token` do `localStorage`
- Se não tiver token → redireciona para `/login`
- Se tiver token → chama `GET /api/auth` para validar
- Se a validação falhar → limpa o token e vai para `/login`
- Só mostra o chat se autenticado

**`ollama-chat/src/app/api/chat/route.ts`** — a API do chat já valida tokens:
- Função `verifyToken(token)` — valida JWT com HMAC-SHA256
- Retorna `sub` (usuário) ou `null`
- Bloqueia requisições sem Authorization válido (401)

**`ollama-tools/src/tools.ts`** — o MCP já tem modelo de dados multiusuário:
- `USUARIOS` — array com `usuario_id` (UUID), `nome`, `limite`, `gasto_total`
- `RegistroIntencoes` — cada intenção já carrega `usuario_id` (UUID)
- `registrarIntencao` e `realizarCompra` recebem `registro_intencoes` como parâmetro
- Gera `usuario_id` com `randomUUID()` do Node.js (`node:crypto`)

### O que falta (causa 404)

| Arquivo | Por que existe | Status |
|---|---|---|
| `src/app/login/page.tsx` | Formulário de login | **NÃO EXISTE** → 404 |
| `src/app/api/auth/route.ts` | Verifica token (usado pela página) | **NÃO EXISTE** → 404 |
| `src/app/api/login/route.ts` | Recebe credenciais, devolve token | **NÃO EXISTE** → 404 |
| `src/lib/auth.ts` | Compartilhar `verifyToken` e `createToken` | **NÃO EXISTE** (duplicado) |

### O que falta no MCP (usuário não passado)

| Arquivo | Problema |
|---|---|
| `ollama-tools/src/tools.ts` | `registrarIntencao` e `realizarCompra` usam `USUARIOS[0]` hardcoded |
| `ollama-tools/src/server.ts` | Não recebe nem passa `usuario_id` |
| `ollama-chat/src/app/api/chat/route.ts` | `runTool` não injeta `usuario_id` |

---

## 2. Plano de implementação

### Passo 1 — Extrair autenticação compartilhada (`ollama-chat/src/lib/auth.ts`)

Criar `src/lib/auth.ts` com:

```ts
// Constantes
export const AUTH_SECRET = process.env.AUTH_SECRET ?? 'squad-03-dev-secret'

// Helpers (já existem em route.ts)
export function toBase64Url(value: string): string
export function fromBase64Url(value: string): string

// Verifica token, retorna sub (usuário) ou null
export function verifyToken(token: string | null): string | null

// Cria token para um usuário (sub = UUID do usuário)
export function createToken(sub: string): string
```

Depois: atualizar `route.ts` para importar de `lib/auth.ts` em vez de duplicar.

### Passo 2 — Criar `/api/login` (`ollama-chat/src/app/api/login/route.ts`)

```ts
// POST { username, password }
// Credenciais: demo / demo (ou env vars LOGIN_USERNAME / LOGIN_PASSWORD)
// Se válidas → createToken(username) → retorna { token }
// Se inválidas → 401 { error: 'Credenciais inválidas' }
```

### Passo 3 — Criar `/api/auth` (`ollama-chat/src/app/api/auth/route.ts`)

```ts
// GET
// Lê header Authorization: Bearer <token>
// Chama verifyToken()
// Se válido → 200 { valid: true }
// Se inválido → 401
```

### Passo 4 — Criar página `/login` (`ollama-chat/src/app/login/page.tsx`)

```tsx
// Formulário com username e password
// Ao submeter → POST /api/login → armazenar token no localStorage como 'chat-token' → redirect para '/'
// Se já autenticado → redirect automático para '/'
```

### Passo 5 — Injetar usuário nas chamadas MCP (`ollama-chat/src/app/api/chat/route.ts`)

Na função `runTool`, antes de chamar `client.callTool`:

```ts
async function runTool(client, call, usuario_id) {
  // injeta usuario_id (UUID) nos argumentos da tool (sobrescreve qualquer valor do modelo)
  const args = { ...call.function.arguments, usuario_id }
  const out = await client.callTool({ name: call.function.name, arguments: args })
  ...
}
```

E em `POST /api/chat`:

```ts
const usuario_id = verifyToken(token)  // já existe, retorna o UUID (sub)
...
const result = client ? await runTool(client, call, usuario_id) : ...
```

### Passo 6 — MCP recebe e usa o `usuario_id` (`ollama-tools/src/tools.ts`)

Os `usuario_id` são **UUIDs** gerados com `randomUUID()` do Node.js (`node:crypto`).

**`registrarIntencao`** — receber `usuario_id` como parâmetro:

```ts
export function registrarIntencao(
  registro_intencoes: RegistroIntencoes,
  args: { sku: string; quantidade: number; usuario_id: string }  // usuario_id é UUID
): registrarIntencaoResponse {
  // Usa args.usuario_id (UUID) em vez de USUARIOS[0].usuario_id
  ...
}
```

**`realizarCompra`** — receber `usuario_id` (UUID) e usar para lookup:

```ts
export function realizarCompra(
  registro_intencoes: RegistroIntencoes,
  args: { intencao_id: string; metodo_pagamento: string; usuario_id: string }  // UUID
): CompraResponse {
  const usuario = USUARIOS.find(u => u.usuario_id === args.usuario_id)
  // Valida permissões, limite, etc.
  ...
}
```

### Passo 7 — Server passa `usuario_id` para as tools (`ollama-tools/src/server.ts`)

```ts
async ({ produto_id, quantidade, usuario_id }) =>
  json(registrarIntencao(registro_intencoes, { sku: produto_id, quantidade, usuario_id }))

async ({ intencao_id, metodo_pagamento, usuario_id }) =>
  json(realizarCompra(registro_intencoes, { intencao_id, metodo_pagamento, usuario_id }))
```

### Passo 8 — Atualizar testes (`ollama-tools/src/tools.check.ts`)

Usar `usuario_id: USUARIOS[0].usuario_id` (que é um UUID) nos calls de teste.

---

## 3. Fluxo final

```
1. Usuário acessa http://localhost:3000
   → page.tsx verifica localStorage, não tem token
   → router.replace('/login')

2. Usuário vê tela de login
   → digita demo / demo
   → POST /api/login
   → recebe { token: "jwt..." }
   → salva no localStorage como 'chat-token'
   → redirect para '/'

3. Usuário acessa http://localhost:3000 (ou recarrega)
   → page.tsx verifica localStorage, tem token
   → GET /api/auth (com Authorization: Bearer token)
   → 200 OK → setIsAuthenticated(true) → mostra chat

4. Usuário conversa
   → chat.tsx pega token do localStorage
   → POST /api/chat (com Authorization: Bearer token)
   → route.ts: verifyToken(token) → retorna sub (ex: UUID "a1b2c3d4-...")
   → modelo chama tool → runTool injeta usuario_id: UUID "a1b2c3d4-..."
   → MCP recebe usuario_id → valida usuário, limite, intenção
   → compra aprovada ou recusada pelo backend
```

---

## 4. Credenciais e configuração

**Arquivo `.env.local`** (colocar no README):

```
AUTH_SECRET=squad-03-dev-secret
LOGIN_USERNAME=demo
LOGIN_PASSWORD=demo
```

**Usuários no MCP (`tools.ts`):**

```ts
export const USUARIOS = [
  { usuario_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nome: 'Usuário Demo', limite: 5000, gasto_total: 0 }
]
```

---

## 5. Arquivos a criar/modificar

### Criar:
| Arquivo | Descrição |
|---|---|
| `ollama-chat/src/lib/auth.ts` | Funções compartilhadas de JWT |
| `ollama-chat/src/app/api/login/route.ts` | Endpoint de login (POST) |
| `ollama-chat/src/app/api/auth/route.ts` | Endpoint de verificação (GET) |
| `ollama-chat/src/app/login/page.tsx` | Página de login (formulário) |

### Modificar:
| Arquivo | Mudança |
|---|---|
| `ollama-chat/src/app/api/chat/route.ts` | Import de `lib/auth.ts`, capturar `sub`, injetar em `runTool` |
| `ollama-chat/src/app/page.tsx` | Nenhuma mudança estrutural (já está pronta) |
| `ollama-tools/src/tools.ts` | `registrarIntencao` e `realizarCompra` recebem `usuario_id` |
| `ollama-tools/src/server.ts` | Passar `usuario_id` para as tools |
| `ollama-tools/src/tools.check.ts` | Atualizar chamadas de teste |

---

## 6. Testes

1. **Login**: acessar `/` → redireciona para `/login` → fazer login com `demo/demo`
2. **Token válido**: após login, recarregar → ainda autenticado
3. **Logout**: clicar "Sair" → volta para `/login`
4. **MCP por usuário**: fazer uma compra → `limite_restante` reflete o UUID do usuário
5. **Tool check**: `npm run check` no `ollama-tools` passa

---

# Sugestões para evolução futura (pós-entrega)

Este documento lista melhorias que podem ser implementadas no futuro para tornar o projeto mais robusto, seguro e próximo de um ambiente real de produção.

---

## 1. Segurança

### 1.1. Hash de senhas
Atualmente as credenciais são armazenadas em texto puro no `.env.local`.

**Sugestão:**  
Utilizar `bcrypt` ou `argon2` para hashear as senhas no backend. Apenas o hash deve ser armazenado (em um banco de dados).

**Exemplo:**
```ts
const hash = await bcrypt.hash(password, 10)
const match = await bcrypt.compare(passwordDigitada, hash)
```

---

### 1.2. Expiração do token JWT
O token gerado atualmente não expira.

**Sugestão:**  
Adicionar um campo `exp` no payload do JWT (ex.: 24h). No `verifyToken`, validar a expiração.

**Exemplo:**
```ts
const payload = { sub: usuario_id, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 }
```

---

### 1.3. Logout no backend (opcional)
Embora o logout seja apenas a remoção do token no cliente, é possível criar um *blacklist* de tokens (em Redis ou em memória) para invalidar tokens antes do vencimento — útil se o usuário quiser "sair de todos os dispositivos".

---

## 2. Persistência

### 2.1. Banco de dados
Hoje os dados (`USUARIOS`, `RegistroIntencoes`) estão em arrays em memória. Ao reiniciar o servidor, tudo é perdido.

**Sugestão:**  
Substituir os arrays por um banco de dados real:

- **SQLite** (para desenvolvimento simples)
- **PostgreSQL** ou **MySQL** (para produção)

**Estrutura mínima:**
- Tabela `usuarios` (id, nome, limite, gasto_total)
- Tabela `intencoes` (id, usuario_id, sku, quantidade, status, criado_em)
- Tabela `compras` (id, intencao_id, metodo_pagamento, valor, realizada_em)

---

## 3. Tratamento de erros

### 3.1. Usuário não encontrado no MCP
Se o `usuario_id` extraído do token não existir no array `USUARIOS`, a ferramenta deve retornar um erro claro.

**Sugestão:**  
Validar a existência do usuário no início de cada tool.

```ts
const usuario = USUARIOS.find(u => u.usuario_id === args.usuario_id)
if (!usuario) {
  throw new Error('Usuário não encontrado ou inválido')
}
```

### 3.2. Respostas padronizadas
Padronizar as respostas de erro entre as APIs (`/api/login`, `/api/auth`, `/api/chat`) com um formato consistente, por exemplo:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Usuário ou senha incorretos"
  }
}
```

---

## 4. Testes e qualidade

### 4.1. Testes de integração
Adicionar testes que simulam o fluxo completo: login → chamada ao chat → execução de tools com usuário específico.

**Ferramentas sugeridas:**  
- `supertest` para testar as rotas da API
- `vitest` ou `jest` para testes unitários

### 4.2. Validação de entrada
Utilizar `zod` para validar os payloads recebidos nas APIs (`/api/login`, `/api/chat`, MCP).

**Exemplo:**
```ts
const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})
```

---

## 5. Experiência do usuário

### 5.1. Feedback de carregamento
Indicar visualmente quando o login ou a verificação de token estão em andamento (evita múltiplos cliques no botão).

### 5.2. Mensagens de erro amigáveis
Exibir mensagens como "Senha incorreta. Tente novamente." em vez de erros técnicos.

---

## 6. Observabilidade

### 6.1. Logs estruturados
Adicionar logs com níveis (`info`, `warn`, `error`) e informações úteis como `usuario_id`, `rota`, `timestamp`.

### 6.2. Métricas básicas
Contar quantas requisições de login falharam, quantas tools foram executadas por usuário, etc. (pode ser feito com um contador simples em memória ou integração com Prometheus).

---

## 7. Documentação

### 7.1. Swagger/OpenAPI
Documentar os endpoints (`/api/login`, `/api/auth`, `/api/chat`) com Swagger para facilitar testes manuais e integração com outros times.

### 7.2. Diagrama de sequência
Incluir um diagrama mostrando o fluxo completo (frontend → API → MCP), destacando onde o `usuario_id` é injetado.

---

## Conclusão

Essas sugestões não precisam ser implementadas todas de uma vez. Elas servem como um *roadmap* de evolução, permitindo que o projeto cresça de forma gradual — de um MVP educacional para uma aplicação mais madura, sem perder a clareza didática.

**Prioridade recomendada para os próximos passos:**
1. Expiração do token (baixo custo, alto ganho de segurança)
2. Banco de dados (essencial para qualquer projeto real)
3. Validação de entrada com `zod` (previne erros bobos)
```
