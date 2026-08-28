import assert from 'node:assert/strict'
import { BadArgs, CATALOG, DEFAULT_TZ, INTENCAO_EXPIRA_SEGUNDOS, getTime, listarCatalogo, realizarCompra, registrarIntencao, searchItems } from './tools.ts'
import type { RegistroIntencoes } from './tools.ts'

const here = getTime({})
assert.equal(here.timezone, DEFAULT_TZ)
assert.match(here.now, /^\d{2}\/\d{2}\/\d{4}/)
assert.equal(getTime({ timezone: '  ' }).timezone, DEFAULT_TZ)
assert.equal(getTime({ timezone: 42 }).timezone, DEFAULT_TZ)
assert.match(getTime({ timezone: 'UTC' }).now, /\d{4}/)
assert.notEqual(getTime({ timezone: 'Asia/Tokyo' }).now, getTime({ timezone: 'America/Sao_Paulo' }).now)
assert.throws(() => getTime({ timezone: 'Mars/Olympus' }), BadArgs)

assert.equal(searchItems({}).count, CATALOG.length)
assert.equal(searchItems({ search: 'playstation' }).items[0].sku, 'PS5')
assert.equal(searchItems({ search: '  Monitor ' }).count, 1)
assert.equal(searchItems({ search: 'unobtainium' }).count, 0)
assert.equal(searchItems({ search: 99 }).count, CATALOG.length)

assert.equal(listarCatalogo({}).produtos.length, CATALOG.length)
assert.equal(listarCatalogo({ categoria: 'pc' }).produtos.length, 3)
assert.equal(listarCatalogo({ categoria: 'pc' }).produtos[0].id, 'PCGAMER')
assert.throws(() => listarCatalogo({ categoria: 'nao-existe' }), BadArgs)

const registro_intencoes: RegistroIntencoes = []
const limite = { restante: 10000 }
const intencao = registrarIntencao(registro_intencoes, { sku: 'PS5', quantidade: 1 })
assert.equal(intencao.status, 'pendente')
assert.equal(intencao.valor_total, 4799)

const compraAprovada = realizarCompra(
  registro_intencoes,
  { intencao_id: intencao.intencao_id, metodo_pagamento: 'pix' },
  limite
)
assert.equal(compraAprovada.status, 'aprovado')
if (compraAprovada.status === 'aprovado') {
  assert.match(compraAprovada.transacao_id, /^tx_/)
  assert.equal(compraAprovada.limite_restante, 5201)
}

const compraDuplicada = realizarCompra(
  registro_intencoes,
  { intencao_id: intencao.intencao_id, metodo_pagamento: 'cartao' },
  limite
)
assert.equal(compraDuplicada.status, 'recusado')
if (compraDuplicada.status === 'recusado') {
  assert.equal(compraDuplicada.erro, 'INTENCAO_JA_PAGA')
}

const metodoInvalido = realizarCompra(
  registro_intencoes,
  { intencao_id: intencao.intencao_id, metodo_pagamento: 'boleto' },
  limite
)
assert.equal(metodoInvalido.status, 'recusado')
if (metodoInvalido.status === 'recusado') {
  assert.equal(metodoInvalido.erro, 'METODO_INVALIDO')
}

const intencaoExpirada = registrarIntencao(registro_intencoes, { sku: 'MONITOR', quantidade: 1 })
registro_intencoes.find((item) => item.intencao_id === intencaoExpirada.intencao_id)!.expira_em =
  new Date(Date.now() - (INTENCAO_EXPIRA_SEGUNDOS + 1) * 1000)
const compraExpirada = realizarCompra(
  registro_intencoes,
  { intencao_id: intencaoExpirada.intencao_id, metodo_pagamento: 'pix' },
  limite
)
assert.equal(compraExpirada.status, 'recusado')
if (compraExpirada.status === 'recusado') {
  assert.equal(compraExpirada.erro, 'INTENCAO_EXPIRADA')
}

const intencaoLimite = registrarIntencao(registro_intencoes, { sku: 'NOTEWORK', quantidade: 1 })
const limiteBaixo = { restante: 100 }
const compraSemLimite = realizarCompra(
  registro_intencoes,
  { intencao_id: intencaoLimite.intencao_id, metodo_pagamento: 'cartao' },
  limiteBaixo
)
assert.equal(compraSemLimite.status, 'recusado')
if (compraSemLimite.status === 'recusado') {
  assert.equal(compraSemLimite.erro, 'LIMITE_EXCEDIDO')
}

const intencaoInvalida = realizarCompra(
  registro_intencoes,
  { intencao_id: 'intencao_inventada', metodo_pagamento: 'pix' },
  limite
)
assert.equal(intencaoInvalida.status, 'recusado')
if (intencaoInvalida.status === 'recusado') {
  assert.equal(intencaoInvalida.erro, 'INTENCAO_INVALIDA')
}

assert.throws(() => registrarIntencao(registro_intencoes, { sku: 'PS5', quantidade: 0 }), BadArgs)

console.log('tools.ts ok')
