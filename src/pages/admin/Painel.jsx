import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { addDias, contar, hojeISO, fmtData, nomeCurto } from '../../lib/utils'
import Periodo, { intervalo } from '../../components/Periodo'
import { BarList, Colunas } from '../../components/Charts'
import { Spinner } from '../../components/ui'
import { ehGrave } from '../../lib/indicadores'
import Icon from '../../components/Icon'

export default function Painel({ ir }) {
  const { ativos, toast, profile } = useApp()
  const [periodo, setPeriodo] = useState({ tipo: '7' })
  const [lista, setLista] = useState(null)
  const [hoje, setHoje] = useState([])
  const [medicos, setMedicos] = useState([])
  const iv = intervalo(periodo)

  useEffect(() => {
    setLista(null)
    api.listAtendimentos({ de: iv.de, ate: iv.ate }).then(setLista).catch((e) => { toast(e.message, 'erro'); setLista([]) })
  }, [iv.de, iv.ate, toast])

  useEffect(() => {
    api.listAtendimentos({ de: hojeISO(), ate: hojeISO() }).then(setHoje).catch(() => {})
    api.listUsuarios().then((u) => setMedicos(u.filter((x) => x.role === 'medico' && x.ativo))).catch(() => {})
  }, [])

  const d = useMemo(() => {
    if (!lista) return null
    const total = lista.length
    const dist = (tipo, fn) => {
      const c = contar(lista, fn)
      const base = ativos(tipo).map((p) => ({ nome: p.nome, cor: p.cor, valor: c.get(p.nome) || 0 }))
      const extras = [...c.entries()].filter(([k]) => !base.some((b) => b.nome === k)).map(([nome, valor]) => ({ nome, valor }))
      return [...base, ...extras]
    }
    const dias = []
    for (let x = iv.de; x <= iv.ate; x = addDias(x, 1)) dias.push({ dia: x, valor: 0 })
    const cDia = contar(lista, (a) => a.data_atendimento)
    dias.forEach((x) => { x.valor = cDia.get(x.dia) || 0 })
    const porMed = [...contar(lista, (a) => a.medico_nome).entries()].map(([nome, valor]) => ({ nome: nomeCurto(nome), valor })).sort((a, b) => b.valor - a.valor)
    const semDesf = lista.filter((a) => !a.desfecho).length
    const comEsp = lista.filter((a) => a.especialidades?.length).length
    const graves = lista.filter(ehGrave(ativos('risco'))).length
    return {
      total, dias, semDesf, comEsp, graves, porMed,
      media: dias.length ? (total / dias.length) : 0,
      risco: dist('risco', (a) => a.risco),
      setor: dist('setor', (a) => a.setor),
      desfecho: dist('desfecho', (a) => a.desfecho),
      esp: dist('especialidade', (a) => a.especialidades).sort((a, b) => b.valor - a.valor),
    }
  }, [lista, ativos, iv.de, iv.ate])

  const pct = (n) => (d?.total ? Math.round((n / d.total) * 100) + '%' : '—')
  const contHoje = contar(hoje, (a) => a.medico_id)

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Painel de monitoramento</h1>
          <p className="muted">{iv.de === iv.ate ? fmtData(iv.de) : `${fmtData(iv.de)} a ${fmtData(iv.ate)}`}</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-soft" onClick={() => ir('analytics')}><Icon name="trend" size={18} />Analytics</button>
          {profile.role === 'admin' && <button className="btn btn-ghost" onClick={() => ir('links')}><Icon name="share" size={18} />Compartilhar</button>}
        </div>
      </div>
      <Periodo value={periodo} onChange={setPeriodo} />

      {!d ? <Spinner /> : (
        <>
          <div className="kpis">
            <div className="kpi kpi-hero"><span>Atendimentos</span><strong>{d.total}</strong><small>{d.media.toFixed(1).replace('.', ',')} por dia</small></div>
            <div className="kpi"><span>Vermelho + Laranja</span><strong>{d.graves}</strong><small>{pct(d.graves)} do total</small></div>
            <div className="kpi"><span>Apoio de especialista</span><strong>{d.comEsp}</strong><small>{pct(d.comEsp)} do total</small></div>
            <div className={'kpi' + (d.semDesf ? ' kpi-warn' : '')}><span>Desfecho pendente</span><strong>{d.semDesf}</strong><small>{pct(d.semDesf)} do total</small></div>
          </div>

          <div className="dash-grid">
            <section className="card span-2">
              <h2 className="card-title">Atendimentos por dia</h2>
              {d.dias.length > 1 ? <Colunas dias={d.dias} /> : <p className="muted small">Selecione um período com mais de um dia para ver a evolução.</p>}
            </section>

            <section className="card">
              <h2 className="card-title">Preenchimento de hoje</h2>
              {medicos.length === 0 ? <p className="muted small">Nenhum médico ativo cadastrado.</p> : (
                <ul className="fill-list">
                  {medicos.map((m) => {
                    const n = contHoje.get(m.id) || 0
                    return (
                      <li key={m.id}>
                        <span className={'dot ' + (n ? 'dot-ok' : 'dot-off')} aria-hidden="true" />
                        <span className="fill-name">{m.nome}</span>
                        <span className={'tag ' + (n ? 'tag-teal' : 'tag-muted')}>{n ? `${n} registro${n > 1 ? 's' : ''}` : 'Sem registro'}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="card"><h2 className="card-title">Classificação de risco</h2><BarList itens={d.risco} total={d.total} /></section>
            <section className="card"><h2 className="card-title">Desfecho</h2><BarList itens={d.desfecho} total={d.total} /></section>
            <section className="card"><h2 className="card-title">Setor</h2><BarList itens={d.setor} total={d.total} /></section>
            <section className="card"><h2 className="card-title">Apoio de especialista</h2><BarList itens={d.esp} /></section>
            <section className="card"><h2 className="card-title">Atendimentos por médico</h2><BarList itens={d.porMed} total={d.total} /></section>
          </div>
        </>
      )}
    </div>
  )
}
