export const hojeISO = () => toISO(new Date())

export function toISO(d) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export function addDias(iso, n) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function fmtData(iso, opts) {
  if (!iso) return '—'
  const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('pt-BR', opts || { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDataLonga(iso) {
  const s = fmtData(iso, { weekday: 'long', day: '2-digit', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function fmtHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function idade(nasc, ref) {
  if (!nasc) return null
  const n = new Date(nasc + 'T12:00:00')
  const r = ref ? new Date(ref + 'T12:00:00') : new Date()
  let a = r.getFullYear() - n.getFullYear()
  const m = r.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && r.getDate() < n.getDate())) a--
  return a >= 0 && a < 130 ? a : null
}

export function contar(lista, fn) {
  const m = new Map()
  for (const it of lista) {
    const vals = [].concat(fn(it) ?? [])
    for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1)
  }
  return m
}

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))

export function nomeCurto(nome = '') {
  const p = nome.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]} ${p[p.length - 1]}` : p[0] || ''
}

export function iniciaisNome(nome = '') {
  const p = nome.replace(/^(dr\.?|dra\.?)\s+/i, '').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
}

// Idade no atendimento (no link de visualização a idade já vem calculada, sem a data de nascimento)
export const idadeAtd = (a) => (a.idade != null ? a.idade : idade(a.data_nascimento, a.data_atendimento))
