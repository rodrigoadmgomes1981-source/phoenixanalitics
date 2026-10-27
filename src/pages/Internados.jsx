import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { api } from '../lib/api'
import { contar, diasPermanencia, fmtData, hojeISO } from '../lib/utils'
import { exportarXLSX } from '../lib/exportar'
import Icon from '../components/Icon'
import { Empty, Segmented, Spinner } from '../components/ui'
import { AtendimentoCard, AtendimentoDetalhe } from '../components/AtendimentoCard'
import AtendimentoForm from '../components/AtendimentoForm'

const ORDENS = [
  { value: 'dias', label: 'Mais tempo' },
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'risco', label: 'Gravidade' },
]

/** Todos os pacientes sem alta, independente da data de entrada. */
export default function Internados() {
  const { profile, ativos, toast, config } = useApp()
  const [lista, setLista] = useState(null)
  const [setor, setSetor] = useState('')
  const [ordem, setOrdem] = useState('dias')
  const [busca, setBusca] = useState('')
  const [det, setDet] = useState(null)
  const [form, setForm] = useState({ open: false, inicial: null })

  const carregar = useCallback(async () => {
    try { setLista(await api.listAtendimentos({ ativos: true })) } catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])
  const fechar = () => { setDet(null); carregar() }

  const riscos = ativos('risco')
  const ordemRisco = (n) => { const i = riscos.findIndex((r) => r.nome === n); return i < 0 ? 99 : i }

  const resumo = useMemo(() => {
    const l = lista || []
    const dias = l.map((a) => diasPermanencia(a))
    return {
      total: l.length,
      porSetor: [...contar(l, (a) => a.setor || 'Sem setor').entries()],
      media: dias.length ? dias.reduce((s, x) => s + x, 0) / dias.length : null,
      longos: dias.filter((x) => x >= 7).length,
      graves: l.filter((a) => ordemRisco(a.risco) <= 1).length,
    }
  }, [lista]) // eslint-disable-line react-hooks/exhaustive-deps

  const q = busca.trim().toLowerCase()
  const visiveis = (lista || [])
    .filter((a) => !setor || (a.setor || 'Sem setor') === setor)
    .filter((a) => !q || [a.prontuario, a.iniciais, a.cid, a.medico_nome].some((v) => v && String(v).toLowerCase().includes(q)))
    .sort((a, b) => ordem === 'dias' ? diasPermanencia(b) - diasPermanencia(a)
      : ordem === 'recentes' ? (b.data_atendimento + b.created_at).localeCompare(a.data_atendimento + a.created_at)
        : ordemRisco(a.risco) - ordemRisco(b.risco) || diasPermanencia(b) - diasPermanencia(a))

  const exportar = () => exportarXLSX(visiveis, `internados-${hojeISO()}`,
    `PACIENTES INTERNADOS — ${config.hospital.toUpperCase()} — ${fmtData(hojeISO())}`)

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pacientes internados</h1>
          <p className="muted small">Todos os pacientes sem alta, de qualquer data de entrada · atualizado agora</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={carregar}><Icon name="refresh" size={18} />Atualizar</button>
          {profile.role === 'admin' && <button className="btn btn-soft" disabled={!visiveis.length} onClick={exportar}><Icon name="download" size={18} />Excel</button>}
        </div>
      </div>

      {!lista ? <Spinner /> : (
        <>
          <div className="kpis">
            <div className="kpi kpi-hero"><span>Internados</span><strong>{resumo.total}</strong><small>{resumo.porSetor.map(([s, n]) => `${n} ${s.toLowerCase()}`).join(' · ') || 'nenhum'}</small></div>
            <div className="kpi"><span>Tempo médio internado</span><strong>{resumo.media == null ? '—' : `${resumo.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} d`}</strong><small>até hoje</small></div>
            <div className={'kpi' + (resumo.longos ? ' kpi-warn' : '')}><span>Há 7 dias ou mais</span><strong>{resumo.longos}</strong><small>revisar plano de alta</small></div>
            <div className="kpi"><span>Vermelho + Laranja</span><strong>{resumo.graves}</strong><small>entre os internados</small></div>
          </div>

          <div className="internados-filtros">
            <div className="chips chips-scroll">
              <button className={'chip' + (!setor ? ' on' : '')} onClick={() => setSetor('')}>Todos ({resumo.total})</button>
              {resumo.porSetor.map(([s, n]) => (
                <button key={s} className={'chip' + (setor === s ? ' on' : '')} onClick={() => setSetor(s)}>{s} ({n})</button>
              ))}
            </div>
            <div className="toolbar">
              <div className="search">
                <Icon name="search" size={18} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Prontuário, iniciais, CID ou médico" />
              </div>
            </div>
            <Segmented value={ordem} onChange={setOrdem} options={ORDENS} />
          </div>

          {visiveis.length === 0 ? (
            <Empty icon="file" titulo={resumo.total ? 'Nenhum paciente com esse filtro' : 'Nenhum paciente internado'}
              texto={resumo.total ? 'Ajuste o setor ou a busca.' : 'Todos os pacientes já tiveram alta.'} />
          ) : (
            <div className="cards cards-grid">
              {visiveis.map((a) => <AtendimentoCard key={a.id} a={a} onOpen={setDet} mostrarMedico />)}
            </div>
          )}
        </>
      )}

      {profile.role === 'medico' && (
        <button className="fab" onClick={() => setForm({ open: true, inicial: null })}>
          <Icon name="plus" size={22} /><span>Incluir paciente</span>
        </button>
      )}
      <AtendimentoForm open={form.open} inicial={form.inicial} onClose={() => setForm({ open: false, inicial: null })} onSaved={carregar} />
      <AtendimentoDetalhe a={det} onClose={() => setDet(null)}
        onEditar={(a) => { setDet(null); setForm({ open: true, inicial: a }) }}
        onExcluido={fechar} onAlterado={fechar} />
    </div>
  )
}
