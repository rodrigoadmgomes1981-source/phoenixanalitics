import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { addDias, fmtDataLonga, hojeISO, contar } from '../../lib/utils'
import Icon from '../../components/Icon'
import { Empty, Spinner, Segmented } from '../../components/ui'
import { AtendimentoCard, AtendimentoDetalhe } from '../../components/AtendimentoCard'
import AtendimentoForm from '../../components/AtendimentoForm'

export default function Hoje() {
  const { profile, ativos, toast } = useApp()
  const [data, setData] = useState(hojeISO())
  const [lista, setLista] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [form, setForm] = useState({ open: false, inicial: null })
  const [det, setDet] = useState(null)

  const carregar = useCallback(async () => {
    try { setLista(await api.listAtendimentos({ de: data, ate: data, medicoId: profile.id })) }
    catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [data, profile.id, toast])
  useEffect(() => { setLista(null); carregar() }, [carregar])

  const ehHoje = data === hojeISO()
  const pend = (lista || []).filter((a) => !a.desfecho)
  const visiveis = filtro === 'pend' ? pend : lista || []
  const porRisco = contar(lista || [], (a) => a.risco)
  const primeiroNome = profile.nome.replace(/^(dr\.?|dra\.?)\s+/i, '').split(' ')[0]
  const h = new Date().getHours()

  return (
    <div className="page">
      <div className="hello">
        <p className="muted">{h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'},</p>
        <h1>{profile.nome.match(/^dra?\.?\s/i) ? profile.nome.split(' ').slice(0, 2).join(' ') : primeiroNome}</h1>
      </div>

      <div className="datebar">
        <button className="icon-btn" onClick={() => setData(addDias(data, -1))} aria-label="Dia anterior"><Icon name="left" /></button>
        <label className="datebar-mid">
          <Icon name="calendar" size={18} />
          <span>{ehHoje ? 'Hoje · ' : ''}{fmtDataLonga(data)}</span>
          <input type="date" value={data} max={hojeISO()} onChange={(e) => e.target.value && setData(e.target.value)} aria-label="Escolher data" />
        </label>
        <button className="icon-btn" disabled={ehHoje} onClick={() => setData(addDias(data, 1))} aria-label="Próximo dia"><Icon name="right" /></button>
      </div>

      <div className="stats">
        <div className="stat"><span>Atendimentos</span><strong>{lista ? lista.length : '–'}</strong></div>
        <div className={'stat' + (pend.length ? ' stat-warn' : '')}><span>Desfecho pendente</span><strong>{lista ? pend.length : '–'}</strong></div>
        <div className="stat"><span>Com especialista</span><strong>{lista ? lista.filter((a) => a.especialidades?.length).length : '–'}</strong></div>
      </div>

      {lista?.length > 0 && (
        <div className="risk-strip" aria-label="Distribuição por classificação de risco">
          {ativos('risco').map((r) => {
            const n = porRisco.get(r.nome) || 0
            return n ? <div key={r.id} style={{ flex: n, background: r.cor }} title={`${r.nome}: ${n}`} /> : null
          })}
        </div>
      )}

      <div className="list-head">
        <h2>Atendimentos</h2>
        <Segmented value={filtro} onChange={setFiltro}
          options={[{ value: 'todos', label: 'Todos' }, { value: 'pend', label: `Pendentes${pend.length ? ` (${pend.length})` : ''}` }]} />
      </div>

      {!lista ? <Spinner /> : visiveis.length === 0 ? (
        <Empty icon="file" titulo={filtro === 'pend' ? 'Nenhum desfecho pendente' : 'Nenhum atendimento registrado'}
          texto={filtro === 'pend' ? 'Todos os atendimentos têm desfecho.' : 'Toque em “Novo atendimento” para começar o checklist do dia.'} />
      ) : (
        <div className="cards">
          {visiveis.map((a) => <AtendimentoCard key={a.id} a={a} onOpen={setDet} />)}
        </div>
      )}

      <button className="fab" onClick={() => setForm({ open: true, inicial: null })}>
        <Icon name="plus" size={22} /><span>Novo atendimento</span>
      </button>

      <AtendimentoForm open={form.open} inicial={form.inicial} dataPadrao={data}
        onClose={() => setForm({ open: false, inicial: null })} onSaved={carregar} />
      <AtendimentoDetalhe a={det} onClose={() => setDet(null)}
        onEditar={(a) => { setDet(null); setForm({ open: true, inicial: a }) }} onExcluido={() => { setDet(null); carregar() }} />
    </div>
  )
}
