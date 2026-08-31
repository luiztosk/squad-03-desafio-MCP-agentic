import express from 'express'
import morgan from 'morgan'
import morganBody from 'morgan-body'
import bodyParser from 'body-parser'
import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { DEFAULT_TZ, getTime, listCatalog, realizarCompra, registrarIntencao, searchItems } from './tools.ts'
import type { RegistroIntencoes } from './tools.ts'

const PORT = Number(process.env.PORT ?? 4000)

const mcp = new McpServer({ name: 'ollama-tools', version: '1.0.0' })

const registro_intencoes: RegistroIntencoes = []

mcp.registerTool(
  'get_time',
  {
    description: `Data e hora atuais. Já retorna no horário de Brasília (UTC-3) por padrão.`,
    inputSchema: {
      timezone: z.string().optional().describe(`Fuso IANA, ex.: America/Sao_Paulo. Padrão: ${DEFAULT_TZ}.`),
    },
  },
  async ({ timezone }) => json(getTime({ timezone }))
)

mcp.registerTool(
  'search_items',
  {
    description: 'Filtra por nome os produtos a venda.',
    inputSchema: {
      search: z.string().describe('Trecho do nome do item, sem diferenciar maiúsculas.'),
    },
  },
  async ({ search }) => json(searchItems({ search }))
)

mcp.registerTool(
  'listar_catalogo',
  {
    description: 'Lista os itens à venda e seus preços em reais. Opcionalmente filtra por categoria.',
    inputSchema: {
      categoria: z.string().optional().describe('Categoria do item, opcional.'),
    },
  },
  async ({ categoria }) => json(listCatalog({ category: categoria }))
)

mcp.registerTool(
  'registrar_intencao',
  {
    description: 'Registra a intenção de compra de um item.',
    inputSchema: {
      sku: z.string().describe('SKU do produto'),
      quantidade: z.number().describe('Quantidade do produto')
    },
  },
  async ({ sku, quantidade }) => json(registrarIntencao(registro_intencoes, { sku, quantidade }))
)

mcp.registerTool(
  'realizar_compra',
  {
    description: 'Executa a compra a partir de uma intenção previamente registrada.',
    inputSchema: {
      intencao_id: z.string().describe('Identificador da intenção de compra gerado pelo backend.'),
      metodo_pagamento: z.enum(['cartao', 'pix']).describe('Método de pagamento escolhido para a compra.')
    },
  },
  async ({ intencao_id, metodo_pagamento }) => json(realizarCompra(registro_intencoes, { intencao_id, metodo_pagamento }))
)

function json(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] }
}

const app = express()

app.use(express.json())
// app.use(morgan('dev'))
app.use(bodyParser.json())
morganBody(app)

app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => transport.close())
  await mcp.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.listen(PORT, () => console.log(`ollama-tools (MCP) on http://localhost:${PORT}/mcp`))
