import { randomUUID } from "node:crypto"

export const CATALOG:{ sku: string, name: string, price: number, currency: string, category?: string, estoque?: number }[] = [
  { sku: 'PS5', name: 'PlayStation 5', price: 4799.0, currency: 'BRL', category: 'game', estoque: 12 },
  { sku: 'PCGAMER', name: 'PC Gamer', price: 12499.0, currency: 'BRL', category: 'PC', estoque: 4 },
  { sku: 'NOTEWORK', name: 'Notebook de trabalho', price: 6299.0, currency: 'BRL', category: 'PC', estoque: 8 },
  { sku: 'MONITOR', name: 'Monitor 27" 144Hz', price: 1899.9, currency: 'BRL', category: 'PC', estoque: 17 },
  { sku: 'CADEIRA', name: 'Cadeira gamer', price: 1299.0, currency: 'BRL', category: 'moveis', estoque: 23 },
  { sku: 'LHC', name: 'Acelerador de partículas de bancada (seminovo, poucos prótons rodados)', price: 4200000000.0, currency: 'BRL', category: 'lab', estoque: 1 },
]

export const DEFAULT_TZ = 'America/Sao_Paulo'
export const INTENCAO_EXPIRA_SEGUNDOS = 180

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
  sku: string, 
  quantidade: number,
  valor_total: number,
  expira_em: Date;
  pago: boolean;
}[]

export const LIMITE_INICIAL_USUARIO = 10000

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

export function listCatalog(args: { category?: string }) {
  const q = typeof args.category === 'string' ? args.category.trim().toLowerCase() : ''
  const items = q ? CATALOG.filter((i) => i.category?.toLowerCase() === q) : CATALOG
  if (items.length === 0) {
    throw new BadArgs(`categoria nao encontrada: ${q}. Faça novamente a busca sem informar categoria.`)
  }
  return { count: items.length, items }
}

export function listarCatalogo(args: { categoria?: string }) {
  const q = typeof args.categoria === 'string' ? args.categoria.trim().toLowerCase() : ''
  const items = q ? CATALOG.filter((i) => i.category?.toLowerCase() === q) : CATALOG
  if (items.length === 0) {
    throw new BadArgs(`categoria nao encontrada: ${q}. Faça novamente a busca sem informar categoria.`)
  }
  return {
    produtos: items.map((item) => ({
      id: item.sku,
      nome: item.name,
      preco: item.price,
      moeda: item.currency,
      estoque: item.estoque ?? 0,
    })),
  }
}

export function registrarIntencao(
  registro_intencoes: RegistroIntencoes,
  args: { sku: string, quantidade: number }
): registrarIntencaoResponse {
    const q_sku = typeof args.sku === 'string' ? args.sku.trim().toLowerCase() : ''
    const quantidade = typeof args.quantidade === 'number' && Number.isInteger(args.quantidade) && args.quantidade > 0
      ? args.quantidade
      : 0
    if (quantidade === 0) {
      throw new BadArgs('quantidade deve ser um inteiro maior que 0')
    }
    try {
      const item = CATALOG.find((i) => i.sku.toLowerCase() === q_sku)
      if (!item) {
        throw new BadArgs(`SKU not found: ${q_sku}`)
      }
      const intencao_id = randomUUID().toString()
      const date_expira: Date = new Date()
      date_expira.setSeconds(date_expira.getSeconds() + INTENCAO_EXPIRA_SEGUNDOS)
      registro_intencoes.push({ 
        intencao_id: intencao_id, 
        sku: item.sku, 
        quantidade: quantidade,
        valor_total: item.price * quantidade,
        expira_em: date_expira,
        pago: false,
      })
      console.log('registro de intencose: ', registro_intencoes)
      return { 
        intencao_id: intencao_id,
        produto_id: item.sku,
        quantidade: quantidade,
        valor_total: item.price * quantidade,
        moeda: item.currency,
        status: "pendente",
        expira_em: date_expira.toISOString()
      }
    } catch {
        throw new BadArgs(`SKU não encontrado: ${q_sku}. Você, deve consultar o catálogo você mesmo usando suas ferramentas, não peça ao usuário.`)
    }

}

export function realizarCompra(
  registro_intencoes: RegistroIntencoes,
  args: { intencao_id: string, metodo_pagamento: string },
  limite: { restante: number },
) {
  const intencao_id = typeof args.intencao_id === 'string' ? args.intencao_id.trim() : ''
  const metodo_pagamento = typeof args.metodo_pagamento === 'string' ? args.metodo_pagamento.trim().toLowerCase() : ''

  if (metodo_pagamento !== 'cartao' && metodo_pagamento !== 'pix') {
    return {
      status: 'recusado' as const,
      erro: 'METODO_INVALIDO' as const,
      mensagem: 'Método de pagamento inválido. Use cartao ou pix.',
    }
  }

  const intencao = registro_intencoes.find((i) => i.intencao_id === intencao_id)
  if (!intencao) {
    return {
      status: 'recusado' as const,
      erro: 'INTENCAO_INVALIDA' as const,
      mensagem: 'Intenção de compra inválida para esta sessão.',
    }
  }

  if (intencao.pago) {
    return {
      status: 'recusado' as const,
      erro: 'INTENCAO_JA_PAGA' as const,
      mensagem: 'Esta intenção de compra já foi utilizada.',
    }
  }

  if (new Date() > intencao.expira_em) {
    return {
      status: 'recusado' as const,
      erro: 'INTENCAO_EXPIRADA' as const,
      mensagem: 'A intenção de compra expirou. Gere uma nova intenção.',
    }
  }

  if (intencao.valor_total > limite.restante) {
    return {
      status: 'recusado' as const,
      erro: 'LIMITE_EXCEDIDO' as const,
      mensagem: 'Compra recusada por limite insuficiente.',
    }
  }

  intencao.pago = true
  limite.restante -= intencao.valor_total
  return {
    status: 'aprovado' as const,
    transacao_id: `tx_${randomUUID()}`,
    intencao_id: intencao.intencao_id,
    valor: intencao.valor_total,
    metodo_pagamento: metodo_pagamento as 'cartao' | 'pix',
    limite_restante: limite.restante,
    data: new Date().toISOString(),
  }
}

export class BadArgs extends Error {}
