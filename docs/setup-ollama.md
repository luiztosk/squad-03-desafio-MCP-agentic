# Setup do Ollama + Qwen3

Este guia mostra como preparar o ambiente para executar uma LLM localmente usando **Ollama** e **Qwen3**.

A configuração recomendada para a trilha é:

- **Ollama**
- **Qwen3 1.7B**
- **Node.js**
- Execução local, sem necessidade de AWS
- GPU dedicada não obrigatória

> Para padronizar o ambiente da turma, use sempre `qwen3:1.7b` nos exercícios.

---

## 1. Pré-requisitos

### Recomendado

- Windows 10/11, macOS 14+ ou Linux
- 8 GB de RAM no mínimo
- 16 GB de RAM recomendado
- Aproximadamente 5 GB livres em disco
- Node.js instalado
- Conexão com a internet para baixar o Ollama e o modelo

Não é obrigatório possuir GPU dedicada.

---

## 2. Instalar o Ollama

### Windows

Baixe e instale o Ollama:

https://ollama.com/download/windows

Depois da instalação, abra um novo PowerShell e execute:

```powershell
ollama --version
```

O comando deve retornar a versão instalada.

Exemplo:

```text
ollama version x.x.x
```

---

### macOS

Baixe o Ollama:

https://ollama.com/download/mac

Instale o aplicativo e depois execute no terminal:

```bash
ollama --version
```

---

### Linux

Execute:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Depois valide:

```bash
ollama --version
```

Caso seja necessário iniciar o servidor manualmente:

```bash
ollama serve
```

---

## 3. Baixar o Qwen3

Para os exercícios da trilha, vamos utilizar:

```text
qwen3:1.7b
```

Baixe o modelo:

```bash
ollama pull qwen3:1.7b
```

O download é de aproximadamente **1,4 GB**.

> Evite usar apenas `qwen3`, pois o alias padrão pode apontar para uma versão maior do modelo.

---

## 4. Verificar se o modelo foi instalado

Execute:

```bash
ollama ls
```

Deve aparecer algo semelhante a:

```text
NAME          ID              SIZE
qwen3:1.7b    xxxxxxxxxxxx    1.4 GB
```

Neste momento temos:

```text
Notebook
   │
   ├── Ollama ✅
   │
   └── Qwen3 1.7B ✅
```

---

## 5. Conversar com a LLM pelo terminal

Execute:

```bash
ollama run qwen3:1.7b
```

O terminal ficará disponível para receber prompts:

```text
>>>
```

Teste:

```text
>>> Explique o que é uma API REST em duas frases.
```

Outro exemplo:

```text
>>> Explique em uma frase a diferença entre uma LLM e um agente.
```

Se o modelo responder, a execução local está funcionando.

Fluxo:

```text
Usuário
   │
   ▼
Ollama
   │
   ▼
Qwen3
   │
   ▼
Resposta
```

---

## 6. Testar a API HTTP do Ollama

O Ollama disponibiliza uma API local em:

```text
http://localhost:11434
```

A aplicação pode conversar com o modelo usando HTTP:

```text
           HTTP
Aplicação ───────► Ollama
                   │
                   ▼
                 Qwen3
```

### macOS / Linux / Git Bash

Execute:

```bash
curl http://localhost:11434/api/chat \
  -d '{
    "model": "qwen3:1.7b",
    "messages": [
      {
        "role": "user",
        "content": "Explique o que é uma API REST em uma frase."
      }
    ],
    "stream": false
  }'
```

A resposta será um JSON semelhante a:

```json
{
  "model": "qwen3:1.7b",
  "message": {
    "role": "assistant",
    "content": "Uma API REST é..."
  },
  "done": true
}
```

---

### Windows PowerShell

No PowerShell:

```powershell
$body = @{
    model = "qwen3:1.7b"
    messages = @(
        @{
            role = "user"
            content = "Explique o que é uma API REST em uma frase."
        }
    )
    stream = $false
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://localhost:11434/api/chat" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

---

## 7. Testar com Node.js

Agora vamos chamar a LLM a partir de uma aplicação Node.js.

### Criar o projeto

```bash
mkdir ollama-test
cd ollama-test
npm init -y
```

Crie o arquivo:

```text
index.js
```

Adicione:

```javascript
const response = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "qwen3:1.7b",
    messages: [
      {
        role: "user",
        content: "Explique o que é uma API REST em uma frase.",
      },
    ],
    stream: false,
  }),
});

const data = await response.json();

console.log(data.message.content);
```

Execute:

```bash
node index.js
```

O terminal deve mostrar a resposta produzida pela LLM.

Exemplo:

```text
Uma API REST é...
```

---

## 8. O que está acontecendo?

A aplicação Node.js está fazendo uma chamada HTTP para o Ollama:

```text
┌──────────────────────┐
│ index.js             │
│                      │
│ fetch()              │
└──────────┬───────────┘
           │
           │ HTTP POST
           │ JSON
           ▼
┌──────────────────────┐
│ localhost:11434      │
│ Ollama API           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Qwen3 1.7B           │
│                      │
│ LLM                  │
└──────────┬───────────┘
           │
           ▼
        Resposta
```

Do ponto de vista da aplicação, continuamos trabalhando com conceitos conhecidos:

```text
HTTP Request
+
JSON
+
HTTP Response
```

A diferença é que agora o serviço chamado é uma **LLM executando localmente**.

---

## 9. Verificar modelos em execução

Execute:

```bash
ollama ps
```

O comando mostra os modelos atualmente carregados.

Exemplo:

```text
NAME          SIZE      PROCESSOR
qwen3:1.7b    ...       100% CPU
```

Dependendo da máquina, o modelo pode utilizar CPU ou GPU.

---

## 10. Problemas comuns

### `ollama` não é reconhecido

Feche e abra novamente o terminal após instalar o Ollama.

Depois teste:

```bash
ollama --version
```

---

### A API `localhost:11434` não responde

No Windows e macOS, confirme que o aplicativo Ollama está aberto.

No Linux, execute:

```bash
ollama serve
```

Depois tente novamente.

---

### O modelo ainda não existe localmente

Execute:

```bash
ollama pull qwen3:1.7b
```

Depois confirme:

```bash
ollama ls
```

---

### A máquina está muito lenta

Caso necessário, utilize uma versão menor:

```bash
ollama pull qwen3:0.6b
```

E execute:

```bash
ollama run qwen3:0.6b
```

---

## 11. Outras versões do Qwen3

| Modelo | Download aproximado | Uso sugerido |
|---|---:|---|
| `qwen3:0.6b` | ~523 MB | Máquinas com poucos recursos |
| **`qwen3:1.7b`** | **~1,4 GB** | **Padrão recomendado para a trilha** |
| `qwen3:4b` | ~2,5 GB | Máquinas com 16 GB de RAM |
| `qwen3:8b` | ~5,2 GB | Máquinas mais potentes |

Para garantir que todos estejam executando o mesmo modelo, sempre informe explicitamente a versão:

```bash
ollama run qwen3:1.7b
```

---

# Checklist de Setup

- [ ] Ollama instalado
- [ ] `ollama --version` funciona
- [ ] Qwen3 1.7B baixado
- [ ] `ollama ls` mostra `qwen3:1.7b`
- [ ] `ollama run qwen3:1.7b` responde aos prompts
- [ ] API `http://localhost:11434/api/chat` responde
- [ ] Aplicação Node.js consegue chamar a API

Se todos os itens acima estiverem concluídos:

```text
AMBIENTE PRONTO ✅
```

---

## Próximos passos

A partir deste ambiente, os próximos exercícios podem evoluir gradualmente:

```text
Chamada simples à LLM
        ↓
System Prompt
        ↓
Structured Output
        ↓
Tool Calling
        ↓
Agent Loop
        ↓
MCP
```

A ideia é primeiro entender como cada componente funciona e somente depois introduzir abstrações e frameworks de programação agentica.

---

## Referências

- Ollama: https://ollama.com/
- Documentação: https://docs.ollama.com/
- Qwen3 no Ollama: https://ollama.com/library/qwen3
- API do Ollama: https://docs.ollama.com/api/introduction