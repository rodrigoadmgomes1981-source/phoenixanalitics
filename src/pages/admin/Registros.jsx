import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { fmtData, fmtHora, nomeCurto } from '../../lib/utils'
import { exportarCSV, exportarXLSX } from '../../lib/exportar'
import Periodo, { intervalo } from '../../components/Periodo'
import { Empty, RiscoTag, Sheet, Spinner } from '../../components/ui'
import { AtendimentoCard, AtendimentoDetalhe } from '../../components/AtendimentoCard'
import AtendimentoForm from '../../components/AtendimentoForm'
import Icon from '../../components/Icon'

const FILTRO0 = { busca: '', risco: '', setor: '', desfecho: '', especialidade: '', exame: '', medicacao: '', medico: '' }

export default function Registros() {
  const { ativos, corRisco, toast, config } = useApp()
  const [periodo, setPeriodo] = useState({ tipo: '7' })
  const [lista, setLista] = useState(null)
  const [f, setF] = useState(FILTRO0)
  const [abrirFiltros, setAbrirFiltros] = useState(false)
  const [det, setDet] = useState(null)
  const [form, setForm] = useState({ open: false, inicial: null })
  const iv = intervalo(periodo)

  const carregar = useCallback(async () => {
    try { setLista(await api.listAtendimentos({ de: iv.de, ate: iv.ate })) } catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [iv.de, iv.ate, toast])
  useEffect(() => { setLista(null); carregar() }, [carregar])

  const medicos = useMemo(() => [...new Set((lista || []).map((a) => a.medico_nome).filter(Boolean))].sort(), [lista])
  const filtrados = useMemo(() => {
    const q = f.busca.trim().toLowerCase()
    return (lista || []).filter((a) =>
      (!q || [a.prontuario, a.iniciais, a.cid, a.exames, a.medicacoes, a.observacoes, ...(a.exames_grupos || []), ...(a.medicacoes_classes || [])].some((v) => v && v.toLowerCase().includes(q))) &&
      (!f.risco || a.risco === f.risco) &&
      (!f.setor || a.setor === f.setor) &&
      (!f.desfecho || (f.desfecho === '__pend' ? !a.desfecho : a.desfecho === f.desfecho)) &&
      (!f.especialidade || (f.especialidade === '__nenhum' ? !a.especialidades?.length : a.especialidades?.includes(f.especialidade))) &&
      (!f.exame || (f.exame === '__nenhum' ? !a.exames_grupos?.length : a.exames_grupos?.includes(f.exame))) &&
      (!f.medicacao || (f.medicacao === '__nenhum' ? !a.medicacoes_classes?.length : a.medicacoes_classes?.includes(f.medicacao))) &&
      (!f.medico || a.medico_nome === f.medico))
  }, [lista, f])
  const nFiltros = Object.entries(f).filter(([k, v]) => k !== 'busca' && v).length
  const nomeArq = `checklist-${iv.de}_a_${iv.ate}`
  const titulo = `CHECKLIST MÉDICO — ${config.hospital.toUpperCase()} — ${fmtData(iv.de)} a ${fmtData(iv.ate)}`

  const sel = (k, label, tipo, extra) => (
    <label className="field" key={k}><span className="field-label">{label}</span>
      <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}>
        <option value="">Todos</option>
        {extra}
        {(tipo ? ativos(tipo).map((p) => p.nome) : medicos).map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  )
  const filtrosUI = (
    <div className="filters-grid">
      {sel('risco', 'Classificação de risco', 'risco')}
      {sel('setor', 'Setor', 'setor')}
      {sel('especialidade', 'Apoio de especialista', 'especialidade', <option value="__nenhum">Sem apoio</option>)}
      {sel('exame', 'Exames (família)', 'exame', <option value="__nenhum">Sem exames</option>)}
      {sel('medicacao', 'Medicação (classe)', 'medicacao', <option value="__nenhum">Sem medicação</option>)}
      {sel('desfecho', 'Desfecho', 'desfecho', <option value="__pend">Pendente</option>)}
      {sel('medico', 'Médico')}
    </div>
  )

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Registros</h1>
          <p className="muted">{lista ? `${filtrados.length} de ${lista.length} atendimento(s)` : 'Carregando…'}</p>
        </div>
        <div className="row-gap">
          <button className="btn btn-soft" disabled={!filtrados.length} onClick={() => exportarXLSX(filtrados, nomeArq, titulo)}><Icon name="download" size={18} />Excel</button>
          <button className="btn btn-ghost" disabled={!filtrados.length} onClick={() => exportarCSV(filtrados, nomeArq)}>CSV</button>
        </div>
      </div>
      <Periodo value={periodo} onChange={setPeriodo} />

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={18} />
          <input value={f.busca} onChange={(e) => setF({ ...f, busca: e.target.value })} placeholder="Prontuário, iniciais, CID, exame…" />
        </div>
        <button className="btn btn-ghost show-mobile" onClick={() => setAbrirFiltros(true)}>
          <Icon name="filter" size={18} />Filtros{nFiltros ? ` (${nFiltros})` : ''}
        </button>
        {nFiltros > 0 && <button className="btn btn-link" onClick={() => setF({ ...FILTRO0, busca: f.busca })}>Limpar</button>}
      </div>
      <div className="hide-mobile">{filtrosUI}</div>

      {!lista ? <Spinner /> : filtrados.length === 0 ? <Empty icon="search" titulo="Nenhum registro" texto="Ajuste o período ou os filtros." /> : (
        <>
          <div className="cards show-mobile-block">
            {filtrados.map((a) => <AtendimentoCard key={a.id} a={a} onOpen={setDet} mostrarMedico mostrarData />)}
          </div>
          <div className="table-wrap hide-mobile">
            <table className="table">
              <thead><tr>
                <th>Data</th><th>Prontuário</th><th>Iniciais</th><th>Risco</th><th>Setor</th><th>Especialista</th><th>Exames</th><th>CID</th><th>Desfecho</th><th>Médico</th>
              </tr></thead>
              <tbody>
                {filtrados.map((a) => (
                  <tr key={a.id} onClick={() => setDet(a)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setDet(a)}>
                    <td>{fmtData(a.data_atendimento, { day: '2-digit', month: '2-digit' })}<small className="muted"> {fmtHora(a.created_at)}</small></td>
                    <td className="mono">{a.prontuario}</td>
                    <td><strong>{a.iniciais}</strong></td>
                    <td><RiscoTag nome={a.risco} cor={corRisco(a.risco)} compact /></td>
                    <td>{a.setor}</td>
                    <td>{(a.especialidades || []).join(', ') || <span className="muted">—</span>}</td>
                    <td>{(a.exames_grupos || []).join(', ') || <span className="muted">—</span>}</td>
                    <td className="mono">{a.cid}</td>
                    <td>{a.desfecho || <span className="tag tag-warn">Pendente</span>}</td>
                    <td>{nomeCurto(a.medico_nome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Sheet open={abrirFiltros} onClose={() => setAbrirFiltros(false)} title="Filtros"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setF({ ...FILTRO0, busca: f.busca })}>Limpar</button>
          <button className="btn btn-primary btn-grow" onClick={() => setAbrirFiltros(false)}>Ver {filtrados.length} resultado(s)</button>
        </>}>
        {filtrosUI}
      </Sheet>
      <AtendimentoForm open={form.open} inicial={form.inicial} onClose={() => setForm({ open: false, inicial: null })} onSaved={carregar} />
      <AtendimentoDetalhe a={det} onClose={() => setDet(null)}
        onEditar={(a) => { setDet(null); setForm({ open: true, inicial: a }) }} onExcluido={() => { setDet(null); carregar() }} />
    </div>
  )
}
