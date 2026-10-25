import { addDias, contar, idadeAtd } from './utils'

// Regras de agrupamento usadas nos indicadores estratégicos
export const ehGrave = (riscosAtivos) => {
  const graves = new Set(riscosAtivos.slice(0, 2).map((r) => r.nome))
  return (a) => graves.has(a.risco) || /vermelho|laranja/i.test(a.risco || '')
}
export const ehInternacaoOuTransf = (a) => /interna|transfer/i.test(a.desfecho || '')
export const ehEvasaoOuPedido = (a) => /evas|pedido/i.test(a.desfecho || '')

export const FAIXAS = [
  ['0–17', 0, 17], ['18–39', 18, 39], ['40–59', 40, 59], ['60–79', 60, 79], ['80+', 80, 200],
]

export function diasEntre(de, ate) {
  return Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000) + 1
}

export function periodoAnterior(de, ate) {
  const n = diasEntre(de, ate)
  return { de: addDias(de, -n), ate: addDias(de, -1) }
}

const taxa = (n, t) => (t ? n / t : null)

export function resumo(lista, de, ate, riscos) {
  const t = lista.length
  const grave = ehGrave(riscos)
  const idades = lista.map(idadeAtd).filter((x) => x != null)
  const comDesf = lista.filter((a) => a.desfecho)
  return {
    total: t,
    mediaDia: t / diasEntre(de, ate),
    graves: taxa(lista.filter(grave).length, t),
    internacao: taxa(comDesf.filter(ehInternacaoOuTransf).length, comDesf.length),
    evasao: taxa(comDesf.filter(ehEvasaoOuPedido).length, comDesf.length),
    especialista: taxa(lista.filter((a) => a.especialidades?.length).length, t),
    completude: taxa(comDesf.length, t),
    idadeMedia: idades.length ? idades.reduce((s, x) => s + x, 0) / idades.length : null,
  }
}

export function serieDiaria(lista, de, ate) {
  const c = contar(lista, (a) => a.data_atendimento)
  const out = []
  for (let d = de; d <= ate; d = addDias(d, 1)) out.push({ x: d, y: c.get(d) || 0 })
  // média móvel de 7 dias
  out.forEach((p, i) => {
    const jan = out.slice(Math.max(0, i - 6), i + 1)
    p.mm = jan.length >= Math.min(7, out.length) ? jan.reduce((s, q) => s + q.y, 0) / jan.length : null
  })
  return out
}

// Agrupa por semana (início na segunda) para o mix de risco
export function inicioSemana(iso) {
  const d = new Date(iso + 'T12:00:00')
  const dow = (d.getDay() + 6) % 7
  return addDias(iso, -dow)
}

export function mixPorSemana(lista, riscos) {
  const m = new Map()
  for (const a of lista) {
    const s = inicioSemana(a.data_atendimento)
    if (!m.has(s)) m.set(s, new Map())
    const g = m.get(s)
    g.set(a.risco || '—', (g.get(a.risco || '—') || 0) + 1)
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([semana, g]) => {
    const total = [...g.values()].reduce((s, x) => s + x, 0)
    return { semana, total, partes: riscos.map((r) => ({ nome: r.nome, cor: r.cor, valor: g.get(r.nome) || 0 })) }
  })
}

export function matriz(lista, linhas, colunas, fl, fc) {
  return linhas.map((l) => {
    const daLinha = lista.filter((a) => fl(a) === l.nome)
    return {
      ...l,
      total: daLinha.length,
      celulas: colunas.map((c) => ({ nome: c.nome, valor: daLinha.filter((a) => fc(a) === c.nome).length })),
    }
  })
}

export function porDiaSemana(lista, de, ate) {
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const ocorr = Array(7).fill(0)
  for (let d = de; d <= ate; d = addDias(d, 1)) ocorr[new Date(d + 'T12:00:00').getDay()]++
  const tot = Array(7).fill(0)
  lista.forEach((a) => { tot[new Date(a.data_atendimento + 'T12:00:00').getDay()]++ })
  // começa na segunda
  return [1, 2, 3, 4, 5, 6, 0].map((i) => ({ nome: nomes[i], valor: ocorr[i] ? tot[i] / ocorr[i] : 0 }))
}
