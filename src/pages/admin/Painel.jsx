import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { contar, hojeISO, fmtData, nomeCurto } from '../../lib/utils'
import Periodo, { intervalo } from '../../components/Periodo'
import { BarList, Colunas } from '../../components/Charts'
import { Spinner } from '../../components/ui'
import { censoDiario, diasInternado, ehGrave, permanencia } from '../../lib/indicadores'
import Icon from '../../components/Icon'

const num = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))

export default function Painel({ ir }) {
  const { ativos, toast, profile } = useApp()
  const [periodo, setPeriodo] = useState({ tipo: '7' })
  const [lista, setLista] = useState(null)
  const [internados, setInternados] = useState(null)
  const iv = intervalo(periodo)

  useEffect(() => {
    setLista(null)
    // sobrepor: quem esteve internado em algum dia do período (inclui quem entrou antes)
    api.listAtendimentos({ de: iv.de, ate: iv.ate, sobrepor: true }).then(setLista).catch((e) => { toast(e.message, 'erro'); setLista([]) })
  }, [iv.de, iv.ate, toast])

  useEffect(() => {
    api.listAtendimentos({ ativos: true }).then(setInternados).catch(() => setInternados([]))
  }, [])

  const d = useMemo(() => {
    if (!lista) return null
    const entradas = lista.filter((a) => a.data_atendimento >= iv.de && a.data_atendimento <= iv.ate)
    const total = entradas.length
    const dist = (tipo, fn, base = entradas) => {
      const c = contar(base, fn)
      const b = ativos(tipo).map((p) => ({ nome: p.nome, cor: p.cor, valor: c.get(p.nome) || 0 }))
      const extras = [...c.entries()].filter(([k]) => !b.some((x) => x.nome === k)).map(([nome, valor]) => ({ nome, valor }))
      return [...b, ...extras]
    }
    const saidas = lista.filter((a) => a.data_desfecho && a.data_desfecho >= iv.de && a.data_desfecho <= iv.ate)
    const porMed = [...contar(entradas, (a) => a.medico_nome).entries()].map(([nome, valor]) => ({ nome: nomeCurto(nome), valor })).sort((a, b) => b.valor - a.valor)
    return {
      total, saidas,
      perm: permanencia(lista, iv.de, iv.ate),
      censo: censoDiario(lista, iv.de, iv.ate),
      graves: entradas.filter(ehGrave(ativos('risco'))).length,
      porMed,
      risco: dist('risco', (a) => a.risco),
      setor: dist('setor', (a) => a.setor),
      desfecho: dist('desfecho', (a) => a.desfecho, saidas),
      esp: dist('especialidade', (a) => a.especialidades).sort((a, b) => b.valor - a.valor),
    }
  }, [lista, ativos, iv.de, iv.ate])

  const agora = useMemo(() => {
    if (!internados) return null
    const hoje = hojeISO()
    const comDias = internados.map((a) => ({ ...a, dias: diasInternado(a, hoje) })).sort((a, b) => b.dias - a.dias)
    const porSetor = [...contar(internados, (a) => a.setor || 'Sem setor').entries()].map(([nome, valor]) => ({ nome, valor }))
    return { total: internados.length, porSetor, longos: comDias.slice(0, 5), risco: dist2(ativos('risco'), internados) }
  }, [internados, ativos])

  const pct = (n) => (d?.total ? Math.round((n / d.total) * 100) + '%' : '—')

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Painel de monitoramento</h1>
          <p className="muted">{iv.de === iv.ate ? fmtData(iv.de) : `${fmtData(iv.de)} a ${fmtData(iv.ate)}`}</p>
        </div>
        <div className="row-gap">
          {(profile.role !== 'viewer' || profile.abas?.includes('analytics')) && <button className="btn btn-soft" onClick={() => ir('analytics')}><Icon name="trend" size={18} />Analytics</button>}
          {profile.role === 'admin' && <button className="btn btn-ghost" onClick={() => ir('links')}><Icon name="share" size={18} />Compartilhar</button>}
        </div>
      </div>
      <Periodo value={periodo} onChange={setPeriodo} />

      {!d ? <Spinner /> : (
        <>
          <div className="kpis">
            <div className="kpi kpi-hero"><span>Internados agora</span><strong>{agora ? agora.total : '–'}</strong><small>{agora?.porSetor.map((s) => `${s.valor} ${s.nome.toLowerCase()}`).join(' · ') || 'nenhum'}</small></div>
            <div className="kpi"><span>Entradas no período</span><strong>{d.total}</strong><small>{d.graves} Vermelho/Laranja ({pct(d.graves)})</small></div>
            <div className="kpi"><span>Altas no período</span><strong>{d.saidas.length}</strong><small>com desfecho registrado</small></div>
            <div className="kpi"><span>Permanência média</span><strong>{d.perm.media == null ? '—' : `${num(d.perm.media)} d`}</strong><small>{d.perm.longas ? `${d.perm.longas} alta(s) após 7+ dias` : 'das altas do período'}</small></div>
          </div>

          <div className="dash-grid">
            <section className="card span-2">
              <h2 className="card-title">Ocupação diária</h2>
              <p className="muted small mb-s">Pacientes internados ao fim de cada dia</p>
              {d.censo.length > 1 ? <Colunas dias={d.censo} /> : <p className="muted small">Selecione um período com mais de um dia para ver a evolução.</p>}
            </section>

            <section className="card">
              <h2 className="card-title">Internados agora</h2>
              {!agora ? <Spinner /> : agora.total === 0 ? <p className="muted small">Nenhum paciente internado.</p> : (
                <>
                  <BarList itens={agora.risco.filter((r) => r.valor)} total={agora.total} />
                  <div className="longos">
                    <strong className="small">Maiores permanências</strong>
                    <ul>
                      {agora.longos.map((a) => (
                        <li key={a.id}>
                          <span>{a.iniciais || a.cid || 'Paciente'} · {a.setor || '—'}</span>
                          <b className={a.dias >= 7 ? '' : 'ok'}>{a.dias === 0 ? 'hoje' : `${a.dias} d`}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </section>

            <section className="card"><h2 className="card-title">Entradas por classificação de risco</h2><BarList itens={d.risco} total={d.total} /></section>
            <section className="card"><h2 className="card-title">Desfecho das altas</h2><BarList itens={d.desfecho} total={d.saidas.length} vazio="Nenhuma alta no período" /></section>
            <section className="card"><h2 className="card-title">Entradas por setor</h2><BarList itens={d.setor} total={d.total} /></section>
            <section className="card"><h2 className="card-title">Apoio de especialista</h2><BarList itens={d.esp} /></section>
            {d.porMed.length > 0 && <section className="card"><h2 className="card-title">Inclusões por médico</h2><BarList itens={d.porMed} total={d.total} /></section>}
          </div>
        </>
      )}
    </div>
  )
}

function dist2(params, lista) {
  const c = contar(lista, (a) => a.risco)
  return params.map((p) => ({ nome: p.nome, cor: p.cor, valor: c.get(p.nome) || 0 }))
}
