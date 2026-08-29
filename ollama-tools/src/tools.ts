import { randomUUID } from "node:crypto"

export const CATALOG:{ sku: string, name: string, price: number, currency: string, category?: string, estoque?: number }[] = [
  { sku: 'PS5', name: 'PlayStation 5', price: 4799.0, currency: 'BRL', category: 'game'},
  { sku: 'PCGAMER', name: 'PC Gamer', price: 12499.0, currency: 'BRL', category: 'PC'},
  { sku: 'NOTEWORK', name: 'Notebook de trabalho', price: 6299.0, currency: 'BRL', category: 'PC'},
  { sku: 'MONITOR', name: 'Monitor 27" 144Hz', price: 1899.9, currency: 'BRL', category: 'PC' },
  { sku: 'CADEIRA', name: 'Cadeira gamer', price: 1299.0, currency: 'BRL', category: 'moveis' },
  { sku: 'LHC', name: 'Acelerador de partículas de bancada (seminovo, poucos prótons rodados)', price: 4200000000.0, currency: 'BRL', category: 'lab' },
]

export const DEFAULT_TZ = 'America/Sao_Paulo'
export const INTENCAO_EXPIRA_SEGUNDOS = 180

export const USUARIOS: { usuario_id: string; nome: string; limite: number; gasto_total: number }[] = [
  { usuario_id: 'user_demo', nome: 'Usuário Demo', limite: 5000, gasto_total: 0 }
]

export type registrarIntencaoResponse = {
  intencao_id: string;    // "int_a1b2c3", gerado pelo backend
  produto_id: string;
  quantidade: number;
  valor_total: number;    // calculado no backend, não enviado pelo cliente
  moeda: string;          // "BRL"
  status: "pendente";
  expira_em: string;  // ISO 8601
}

export type RegistroIntencoes = {
  intencao_id: string,
  usuario_id: string,
  sku: string,
  quantidade: number,
  valor_total: number,
  moeda: string,
  expira_em: Date,
  status: 'pendente' | 'paga',
  metodo_pagamento?: 'cartao' | 'pix',
  transacao_id?: string,
  data_pagamento?: Date,
}[]

export type CompraResponse =
  | {
      status: 'aprovado';
      transacao_id: string;
      intencao_id: string;
      valor: number;
      metodo_pagamento: 'cartao' | 'pix';
      limite_restante: number;
      data: string;
    }
  | {
      status: 'recusado';
      erro: 'INTENCAO_INVALIDA' | 'INTENCAO_JA_PAGA' | 'INTENCAO_EXPIRADA' | 'LIMITE_EXCEDIDO' | 'METODO_INVALIDO';
      mensagem: string;
    }

export function getTime(args: { timezone?: unknown }) {
  const tz = typeof args.timezone === 'string' && args.timezone.trim() ? args.timezone.trim() : DEFAULT_TZ
  try {
    return { timezone: tz, now: new Date().toLocaleString('pt-BR', { timeZone: tz, timeZoneName: 'short' }) }
  } catch {
    throw new BadArgs(`unknown timezone: ${tz}`)
  }
}

export function searchItems(args: { search?: unknown }) {
  const q = typeof args.search === 'string' ? args.search.trim().toLowerCase() : ''
  const items = q ? CATALOG.filter((i) => i.name.toLowerCase().includes(q)) : CATALOG
  return { count: items.length, items }
}

export function listarCatalogo(args: { category?: string }) {
  const q = typeof args.category === 'string' ? args.category.trim().toLowerCase() : ''
  const items = q ? CATALOG.filter((i) => i.category?.toLowerCase() === q) : CATALOG
  if (items.length === 0) {
    throw new BadArgs(`categoria nao encontrada: ${q}. Faça novamente a busca sem informar categoria.`)
  }
  return { count: items.length, items }
}

export function registrarIntencao(
  registro_intencoes: RegistroIntencoes,
  args: { sku: string, quantidade: number }
): registrarIntencaoResponse {
    const q_sku = typeof args.sku === 'string' ? args.sku.trim().toLowerCase() : ''
    const quantidade = typeof args.quantidade === 'number' && Number.isFinite(args.quantidade) && args.quantidade > 0 ? Math.floor(args.quantidade) : 0
    try {
      const item = CATALOG.find((i) => i.sku.toLowerCase() === q_sku)
      if (!item) {
        throw new BadArgs(`SKU not found: ${q_sku}`)
      }
      const intencao_id = `int_${randomUUID().toString().slice(0, 8)}`
      const date_expira: Date = new Date()
      date_expira.setSeconds(date_expira.getSeconds() + INTENCAO_EXPIRA_SEGUNDOS)
      const valor_total = item.price * quantidade
      registro_intencoes.push({
        intencao_id,
        usuario_id: USUARIOS[0].usuario_id,
        sku: item.sku,
        quantidade,
        valor_total,
        moeda: item.currency,
        expira_em: date_expira,
        status: 'pendente'
      })
      return {
        intencao_id,
        produto_id: item.sku,
        quantidade,
        valor_total,
        moeda: item.currency,
        status: 'pendente',
        expira_em: date_expira.toISOString()
      }
    } catch {
        throw new BadArgs(`SKU não encontrado: ${q_sku}. Você, vendedor, deve consultar o catálogo você mesmo usando suas ferramentas, não peça ao usuário.`)
    }
}

export function realizarCompra(
  registro_intencoes: RegistroIntencoes,
  args: { intencao_id?: unknown, metodo_pagamento?: unknown }
): CompraResponse {
  const intencao_id = typeof args.intencao_id === 'string' ? args.intencao_id.trim() : ''
  const metodo = typeof args.metodo_pagamento === 'string' ? args.metodo_pagamento.trim().toLowerCase() : ''

  if (!intencao_id) {
    return { status: 'recusado', erro: 'INTENCAO_INVALIDA', mensagem: 'A intenção informada é inválida.' }
  }

  const intencao = registro_intencoes.find((item) => item.intencao_id === intencao_id)
  if (!intencao) {
    return { status: 'recusado', erro: 'INTENCAO_INVALIDA', mensagem: 'Intenção inexistente ou inventada. Use uma intenção válida gerada pelo backend.' }
  }

  if (intencao.usuario_id !== USUARIOS[0].usuario_id) {
    return { status: 'recusado', erro: 'INTENCAO_INVALIDA', mensagem: 'Essa intenção não pertence ao usuário atual.' }
  }

  if (intencao.status === 'paga') {
    return { status: 'recusado', erro: 'INTENCAO_JA_PAGA', mensagem: 'Essa intenção já foi utilizada em uma compra.' }
  }

  if (new Date(intencao.expira_em).getTime() < Date.now()) {
    return { status: 'recusado', erro: 'INTENCAO_EXPIRADA', mensagem: 'A intenção expirou e não pode mais ser utilizada.' }
  }

  if (metodo !== 'cartao' && metodo !== 'pix') {
    return { status: 'recusado', erro: 'METODO_INVALIDO', mensagem: 'Método de pagamento inválido. Use cartao ou pix.' }
  }

  const usuario = USUARIOS[0]
  const gastoAtual = usuario.gasto_total ?? 0
  if (gastoAtual + intencao.valor_total > usuario.limite) {
    return { status: 'recusado', erro: 'LIMITE_EXCEDIDO', mensagem: `Compra recusada: o valor de R$ ${intencao.valor_total.toFixed(2)} excede o limite restante do usuário.` }
  }

  usuario.gasto_total = gastoAtual + intencao.valor_total
  intencao.status = 'paga'
  intencao.metodo_pagamento = metodo
  intencao.transacao_id = `tx_${randomUUID().toString().slice(0, 8)}`
  intencao.data_pagamento = new Date()

  return {
    status: 'aprovado',
    transacao_id: intencao.transacao_id,
    intencao_id: intencao.intencao_id,
    valor: intencao.valor_total,
    metodo_pagamento: metodo,
    limite_restante: usuario.limite - usuario.gasto_total,
    data: intencao.data_pagamento.toISOString(),
  }
}

export class BadArgs extends Error {}
