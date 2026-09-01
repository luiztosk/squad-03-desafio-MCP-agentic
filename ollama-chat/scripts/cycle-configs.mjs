// 30 shopping cycles: 15 happy, 10 LIMITE_EXCEDIDO, 5 INTENCAO_INVALIDA.
// The harness builds the conversation per cycle using the system prompt +
// a recorded catalog blob + the user message(s) below.
//
// The recorded catalog blob is the literal assistant text we send in place
// of having the model call listar_catalogo. This isolates the variable
// under test (the post-tool format) from the catalog-rendering problem.

const CATALOG_BLOB = `Aqui está o nosso catálogo:

1. **PlayStation 5** — R$ 4.799,00 (sku: PS5)
2. **PC Gamer** — R$ 12.499,00 (sku: PCGAMER)
3. **Notebook de trabalho** — R$ 6.299,00 (sku: NOTEWORK)
4. **Monitor 27" 144Hz** — R$ 1.899,90 (sku: MONITOR)
5. **Cadeira gamer** — R$ 1.299,00 (sku: CADEIRA)
6. **Acelerador de partículas de bancada (seminovo, poucos prótons rodados)** — R$ 4.200.000.000,00 (sku: LHC)

Para comprar, digite \`comprar [nome do produto]\`.`

const SYSTEM_PROMPT = `Você é um vendedor de uma loja de eletrônicos.

## Objetivo
Atender clientes de forma prestativa, guiando-os desde a visualização do catálogo até a finalização da compra, utilizando as ferramentas do sistema para garantir precisão.

## Escopo
**Permitido:**
- Falar apenas sobre a loja: produtos, preços, disponibilidade e horário de funcionamento.

**Não permitido:**
- Responder a perguntas fora do contexto da loja. Se perguntarem sobre outro assunto, diga educadamente que você só pode ajudar com assuntos relacionados à loja.

## Regras de Comportamento e Ferramentas (MCP)
1. **Idioma:** Responda SEMPRE em português brasileiro, de forma objetiva e educada. Nunca escreva em inglês.
2. **Uso de Ferramentas:**
   - Use a ferramenta 'get_time' para qualquer pergunta sobre data ou hora atual.
   - Use as demais ferramentas para qualquer pergunta sobre o que está à venda, preços, ou processamento de compras.
   - **Nunca mencione as ferramentas para o usuário.** Use-as apenas internamente para compor suas respostas e interagir com o MCP.
3. **Prevenção de Alucinações:**
   - Nunca invente produtos nem preços. Se não souber, chame a ferramenta correspondente.
4. **Retentativa de Busca:**
   - Quando não encontrar produtos no catálogo em uma busca, tente novamente usando a ferramenta com o parâmetro 'categoria' vazio antes de informar que não há estoque.

## Estilo de Resposta
- **Tom:** Objetivo, educado, direto e prestativo.
- **Formatação de Preços:** Exiba os preços em reais, estritamente no formato 'R$ 1.234,56'.

## Fluxo de Conversa
**1. Início da Conversa:**
- Sempre abra a conversa pedindo ao usuário para digitar 'produtos' ou 'catalogo' para acessar o catálogo.
- Avise que ele também pode digitar 'comprar [nome do produto]' para iniciar uma compra.

**2. Exibição do Catálogo:**
- Na mesma mensagem em que exibir os produtos do catálogo, lembre ao usuário que ele pode escolher um produto digitando 'comprar [nome do produto]'.

## Fluxo de Checkout (Compra)
1. **Registro de Intenção:** Após registrar a intenção de compra (quando o usuário pedir para comprar), verifique o sucesso através do retorno da ferramenta.
2. **Confirmação e Pagamento:** Informe ao usuário todas as informações a respeito da intenção registrada, **incluindo o ID da intenção**, e pergunte qual será o meio de pagamento.
3. **Finalização da Compra:**
   - Quando o usuário responder com o meio de pagamento, realize imediatamente a compra.
   - **Importante:** Use a intenção de compra existente. Não abra uma nova intenção de compra.
4. **Resultado:** Responda com o resultado final da ferramenta. Tenha certeza de que está exibindo o *resultado de uma compra efetuada* e não confunda com a *intenção de compra*.
5. **Tratamento de Erros:** Se houver erros no checkout ou em qualquer ferramenta, explique a mensagem de erro ao usuário de forma clara e amigável.`

// baseline: same as SYSTEM_PROMPT (a frozen copy we send during baseline runs).
// prompt_variant: the one we are about to write, used for prompted runs.
// (Both are kept in this file so the run is fully reproducible; the harness
// picks based on --prompt flag.)
export const PROMPT_VARIANTS = {
  baseline: SYSTEM_PROMPT,
  // prompted is injected by run-cycles.mjs by reading system_prompt.ts from disk,
  // so this file stays the source of truth for the catalog blob and cycle specs.
}

const HAPPY_PRODUCTS = [
  { sku: 'PS5',       name: 'PlayStation 5' },
  { sku: 'PCGAMER',   name: 'PC Gamer' },
  { sku: 'NOTEWORK',  name: 'Notebook de trabalho' },
  { sku: 'MONITOR',   name: 'Monitor 27" 144Hz' },
  { sku: 'CADEIRA',   name: 'Cadeira gamer' },
]
const PAYMENTS = ['pix', 'cartao']

function makeHappyCycles() {
  const out = []
  for (let i = 0; i < 15; i++) {
    const prod = HAPPY_PRODUCTS[i % HAPPY_PRODUCTS.length]
    const pay = PAYMENTS[i % PAYMENTS.length]
    out.push({
      cycle_id: out.length + 1,
      category: 'happy',
      expected_outcome: 'aprovado',
      // Two turns, matching the prompt's expected flow:
      //   turn 1: "Quero comprar o X"  → model calls registrar_intencao,
      //           presents the "Intenção registrada" template, asks for
      //           payment method.
      //   turn 2: "Pagar com pix/cartao" → model calls realizar_compra
      //           with the intencao_id from turn 1, presents the
      //           "Compra aprovada" template.
      turns: [
        { role: 'user', content: `Quero comprar o ${prod.name}, quantidade 1.` },
        { role: 'user', content: `Pagar com ${pay}.` },
      ],
    })
  }
  return out
}

function makeLimitExcedidoCycles() {
  const out = []
  for (let i = 0; i < 10; i++) {
    const pay = PAYMENTS[i % PAYMENTS.length]
    out.push({
      cycle_id: out.length + 16,
      category: 'limit_excedido',
      expected_outcome: 'LIMITE_EXCEDIDO',
      // Two turns: first ask to buy, then on the second turn ask the model
      // to use the just-registered intencao_id and pay. This forces the
      // model through registrar_intencao -> realizar_compra so we can see
      // the LIMITE_EXCEDIDO error template.
      turns: [
        { role: 'user', content: `Quero comprar o Acelerador de partículas, quantidade 1.` },
        { role: 'user', content: `Use a intencao_id que você acabou de registrar e pague com ${pay}.` },
      ],
    })
  }
  return out
}

function makeInvalidIntentCycles() {
  const out = []
  const product = HAPPY_PRODUCTS[3] // MONITOR
  for (let i = 0; i < 5; i++) {
    out.push({
      cycle_id: out.length + 26,
      category: 'invalid_intent',
      expected_outcome: 'INTENCAO_INVALIDA',
      // Two turns: first ask to buy (model registers intention), then on
      // the second turn feed the model a *different* (fake) intencao_id
      // and ask it to pay. The model is supposed to call realizar_compra
      // with the fake id, which the backend then refuses.
      turns: [
        { role: 'user', content: `Quero comprar o ${product.name}, quantidade 1.` },
        { role: 'user', content: `O id da intenção é int_inventada_${i + 1}. Pague com pix usando esse id.` },
      ],
    })
  }
  return out
}

export const CYCLES = [
  ...makeHappyCycles(),
  ...makeLimitExcedidoCycles(),
  ...makeInvalidIntentCycles(),
]

export { CATALOG_BLOB, SYSTEM_PROMPT }
