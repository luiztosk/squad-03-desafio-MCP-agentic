import assert from 'node:assert/strict'
import { BadArgs, CATALOG, DEFAULT_TZ, getTime, registrarIntencao, realizarCompra, searchItems, USUARIOS } from './tools.ts'

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

const registro: any[] = []
const intencao = registrarIntencao(registro, { sku: 'PS5', quantidade: 1, usuario_id: USUARIOS[0].usuario_id })
const compraOk = realizarCompra(registro, { intencao_id: intencao.intencao_id, metodo_pagamento: 'cartao' })
assert.equal(compraOk.status, 'aprovado')
assert.equal(compraOk.valor, intencao.valor_total)
assert.equal(compraOk.metodo_pagamento, 'cartao')
assert.equal(USUARIOS[0].gasto_total, intencao.valor_total)

const compraRepetida = realizarCompra(registro, { intencao_id: intencao.intencao_id, metodo_pagamento: 'pix' })
assert.equal(compraRepetida.status, 'recusado')
assert.equal(compraRepetida.erro, 'INTENCAO_JA_PAGA')

const intencaoInvalida = realizarCompra(registro, { intencao_id: 'int_nao_existe', metodo_pagamento: 'pix' })
assert.equal(intencaoInvalida.status, 'recusado')
assert.equal(intencaoInvalida.erro, 'INTENCAO_INVALIDA')

const registro2: any[] = []
const intencaoLimitada = registrarIntencao(registro2, { sku: 'MONITOR', quantidade: 10, usuario_id: USUARIOS[0].usuario_id })
const acimaLimite = realizarCompra(registro2, { intencao_id: intencaoLimitada.intencao_id, metodo_pagamento: 'pix' })
assert.equal(acimaLimite.status, 'recusado')
assert.equal(acimaLimite.erro, 'LIMITE_EXCEDIDO')

console.log('tools.ts ok')
