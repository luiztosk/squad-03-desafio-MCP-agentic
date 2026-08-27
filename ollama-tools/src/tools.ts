
export const CATALOG:{ sku: string, name: string, price: number, currency: string, category?: string, estoque?: number }[] = [
  { sku: 'PS5', name: 'PlayStation 5', price: 4799.0, currency: 'BRL', category: 'game'},
  { sku: 'PCGAMER', name: 'PC Gamer', price: 12499.0, currency: 'BRL', category: 'PC'},
  { sku: 'NOTEWORK', name: 'Notebook de trabalho', price: 6299.0, currency: 'BRL', category: 'PC'},
  { sku: 'MONITOR', name: 'Monitor 27" 144Hz', price: 1899.9, currency: 'BRL', category: 'PC' },
  { sku: 'CADEIRA', name: 'Cadeira gamer', price: 1299.0, currency: 'BRL', category: 'moveis' },
  { sku: 'LHC', name: 'Acelerador de partículas de bancada (seminovo, poucos prótons rodados)', price: 4200000000.0, currency: 'BRL' },
]

export const DEFAULT_TZ = 'America/Sao_Paulo'

export function getTime(args: { timezone?: unknown }) {
  const tz = typeof args.timezone === 'string' && args.timezone.trim() ? args.timezone.trim() : DEFAULT_TZ
  try {
    return { timezone: tz, now: new Date().toLocaleString('pt-BR', { timeZone: tz, timeZoneName: 'short' }) }
  } catch {
    throw new BadArgs(`unknown timezone: ${tz}`)
  }
}

export function listItems(args: { search?: unknown }) {
  const q = typeof args.search === 'string' ? args.search.trim().toLowerCase() : ''
  const items = q ? CATALOG.filter((i) => i.name.toLowerCase().includes(q)) : CATALOG
  return { count: items.length, items }
}

export function listCatalog(args: { category?: string }) {
  console.log(args)
  const q = typeof args.category === 'string' ? args.category.trim().toLowerCase() : ''
  console.log('categoria: ', q)
  const items = q ? CATALOG.filter((i) => i.category?.toLowerCase().includes(q)) : CATALOG
  return { count: items.length, items }
}

export class BadArgs extends Error {}
