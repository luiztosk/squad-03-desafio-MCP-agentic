# AGENTS.md

Guia para agentes de IA (Claude Code, Copilot, Cursor etc.) trabalharem neste
repositório. Leia isto antes de mexer em qualquer código.

## Visão geral do projeto

Projeto final de MCP do bootcamp **Agentic Payments** (Squad 03). É um chat
que roda um modelo local no **Ollama** e chama **ferramentas via MCP**
(Model Context Protocol) para consultar um catálogo e simular uma compra.

Fluxo de referência (milestone 1): `listar_catalogo` → `registrar_intencao` → `realizar_compra`.

Baseado nos exemplos de `PedroLeale/agentic-payments-fde-workshops`.

## Estrutura do repositório

```
.
├── docs/                 # documentação extra (ex.: setup-ollama.md)
├── ollama-tools/         # servidor MCP — as ferramentas que o modelo chama
├── ollama-chat/          # chat em Next.js — backend + frontend
├── postman/              # coleções para testar o MCP manualmente
└── README.md
```

Cada pasta (`ollama-tools`, `ollama-chat`) é um projeto Node **independente**,
com seu próprio `package.json`. **Nunca rode `npm` na raiz do repo** — sempre
entre na pasta certa primeiro.

### `ollama-tools` (servidor MCP)

- Processo separado de propósito: o chat nunca executa código de ferramenta
  diretamente, só sabe *pedir* via protocolo MCP.
- Transporte: Streamable HTTP, stateless (sem sessão para expirar). Endpoint
  único `POST /mcp`, falando JSON-RPC.
- Ferramentas atuais:
  - `get_time` — `{ "timezone": "America/Sao_Paulo" }` → data/hora ali; sem
    argumento, devolve horário de Brasília (UTC-3).
  - `list_items` — `{ "search": "playstation" }` → itens que batem com o
    filtro e preços em BRL; sem `search`, devolve tudo.
- Arquivos:
  - `src/tools.ts` — lógica das ferramentas (não sabe o que é MCP).
  - `src/server.ts` — registra as ferramentas e sobe o transporte.
  - `src/tools.check.ts` — self-check (`node src/tools.check.ts`), roda
    sozinho e falha se a lógica quebrar.
- Comandos:
  ```
  cd ollama-tools
  npm install
  npm start     # sobe em http://localhost:4000/mcp
  npm run check # self-check + typecheck
  ```

### `ollama-chat` (chat Next.js)

- Duas abas de conversa: **sem memória** (só a última mensagem é enviada) e
  **histórico completo** (todas as mensagens anteriores vão junto).
- Passar o mouse sobre uma mensagem abre um painel mostrando exatamente o que
  foi enviado ao modelo naquele turno (system prompt + ferramentas chamadas,
  argumentos e retorno). Nada é persistido em cookie/localStorage — o
  histórico vive só em memória da aba.
- `src/app/api/chat/route.ts` é o único caminho até o modelo:
  1. Abre conexão MCP com `ollama-tools` e traduz as ferramentas para o
     formato do Ollama.
  2. Chama o Ollama com `stream: true`, repassa tokens ao navegador em NDJSON.
  3. Se o modelo pedir uma ferramenta, executa via MCP, devolve o resultado
     e chama o modelo de novo — no máximo `MAX_ROUNDS` vezes.
  4. Segura os primeiros tokens de cada rodada por `HOLD_MS` (descarta
     rascunho antes da decisão de chamar ferramenta).
- `src/app/page.tsx` é o cliente inteiro (estado em memória, leitura do
  stream, painel lateral). O system prompt fica **no cliente** de propósito.
- Variáveis de ambiente (`.env.local`):

  | Variável       | Padrão                      | O que é                          |
  | -------------- | --------------------------- | -------------------------------- |
  | `OLLAMA_URL`   | `http://localhost:11434`    | Onde o Ollama escuta.            |
  | `OLLAMA_MODEL` | `qwen2.5:14b`               | Modelo usado (precisa suportar tools). |
  | `MCP_URL`      | `http://localhost:4000/mcp` | Servidor MCP com as ferramentas. |

- Comandos:
  ```
  cd ollama-chat
  npm install
  npm run dev   # http://localhost:3000
  ```

## Como rodar tudo localmente

1. Subir o **Ollama** (ver `docs/setup-ollama.md`), com um modelo que suporte
   tools já baixado (ex.: `ollama pull qwen3:1.7b` ou `ollama pull llama3.2`).
   - Se `ollama serve` disser `bind: address already in use`, já está no ar —
     não precisa rodar de novo. Confirme com `curl -s localhost:11434/api/version`.
2. **Terminal 1** — subir o MCP: `cd ollama-tools && npm install && npm start`.
3. **Terminal 2** — subir o chat: `cd ollama-chat && npm install && npm run dev`.
4. Abrir `http://localhost:3000`.

Sempre suba o servidor de ferramentas **antes** de conversar. Se o MCP não
estiver no ar, o chat continua respondendo — só que sem ferramentas.

## Convenções para o agente

- **Nunca** rode `npm install`/`npm run` na raiz — sempre dentro de
  `ollama-tools/` ou `ollama-chat/`.
- Ao mexer em `ollama-tools/src/tools.ts`, rode `npm run check` depois — é o
  self-check que garante que a lógica não quebrou.
- Ao adicionar uma nova ferramenta MCP: implemente a lógica em `tools.ts`
  (sem depender de MCP), registre em `server.ts`, e garanta que o schema de
  entrada/saída seja compatível com o formato de tools do Ollama (o chat
  traduz automaticamente via `src/app/api/chat/route.ts`).
- O system prompt do chat é intencionalmente exposto no cliente
  (`src/app/page.tsx`) para transparência no painel lateral — não mova isso
  para o servidor sem necessidade.
- Autenticação do projeto é **login/senha + JWT mínimo** — não adicione OAuth
  ou fluxos complexos sem alinhar antes.
- Modelos pequenos erram mais a decisão de quando chamar uma ferramenta;
  se estiver testando um modelo novo, confira suporte a tools com:
  `ollama show <modelo> | grep -i capabilities -A3`.
- `keep_alive` do Ollama: `-1` mantém o modelo carregado até reiniciar o
  serviço (bom para demos), `'30m'` é o padrão mais "educado" — não deixe
  `-1` commitado sem avisar.

## O que evitar

- Não commitar segredos/tokens — siga o `.gitignore` existente.
- Não persistir histórico de chat em cookie/localStorage — é uma decisão de
  design do projeto (transparência do que é enviado ao modelo).
- Não assumir que o Ollama precisa ser iniciado manualmente — na maioria das
  instalações ele já roda como serviço do sistema.