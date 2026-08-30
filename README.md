# Squad 03 : Desafio MCP do Bootcamp Agentic Payments

repo pra organizar os projetos do Desafio:
https://github.com/PedroLeale/agentic-payments-fde-workshops/blob/main/docs/desafio.md

pode ser usado como base os projetos ollama-chat e ollama-tools

# Etapas do desenvolvimento

## modelo escolhido: Qwen3.5 2B no Ollama local
```bash
ollama pull qwen3.5:2b
```

## Milestone 1: MCP minimo funcionando
> tag: `v0.0.1`
screenshot do fluxo `listar_catalogo` -> `registrar_intencao` -> `realizar_compra`
<img width="1174" height="1965" alt="image" src="https://github.com/user-attachments/assets/4e4886bd-528c-4c10-913f-7d151278a201" />


# Autenticação
Login/Senha + JWTminimo

# como rodar o projeto:

1. rodar o ollama [(como fazer o setup)](./docs/setup-ollama.md) localmente, já com o modelo `qwen3:1.7b` baixado (`ollama pull qwen3:1.7b` pra baixar)
2. rodar o projeto `ollama-tools` conforme seu [README](./ollama-tools/README.md) (este é o MCP)
3. rodar o projeto `ollama-chat` conforme seu [README](./ollama-chat/README.md) (este é o backend + frontend do chat)

> NOTA: tem que entrar em cada pasta pra rodar o `npm`, e não na raiz do repo, e tem que rodar os dois ao mesmo tempo (dois terminais)

# projetos `ollama-chat`, `ollama-tools`, e docs:

baseados nos exemplos do Pedro Leale: 
https://github.com/PedroLeale/agentic-payments-fde-workshops
