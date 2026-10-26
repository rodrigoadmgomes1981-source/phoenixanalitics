import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { addDias, fmtDataLonga, hojeISO, contar } from '../../lib/utils'
import Icon from '../../components/Icon'
import { Empty, Spinner, Segmented } from '../../components/ui'
import { AtendimentoCard, AtendimentoDetalhe } from '../../components/AtendimentoCard'
import AtendimentoForm from '../../components/AtendimentoForm'

/**
 * Plantão = censo do dia. O paciente é incluído uma vez (data de internação) e aparece
 * todos os dias até a alta. Todos os médicos da unidade veem os mesmos pacientes.
 */
export default function Hoje() {
  const { profile, ativos, toast } = useApp()
  const [data, setData] = useState(hojeISO())
  const [lista, setLista] = useState(null)
  const [filtro, setFiltro] = useState('internados')
  const [busca, setBusca] = useState('')
  const [form, setForm] = useState({ open: false, inicial: null })
  const [det, setDet] = useState(null)

  const carregar = useCallback(async () => {
    try { setLista(await api.listAtendimentos({ de: data, ate: data, sobrepor: true })) }
    catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [data, toast])
  useEffect(() => { setLista(null); carregar() }, [carregar])

  // Atualiza o detalhe aberto quando a lista recarrega (ex.: depois de dar alta)
  const recarregar = async () => {
    await carregar()
    setDet(null)
  }

  const ehHoje = data === hojeISO()
  const grupos = useMemo(() => {
    const l = lista || []
    return {
      internados: l.filter((a) => !a.data_desfecho || a.data_desfecho > data),
      entradas: l.filter((a) => a.data_atendimento === data),
      saidas: l.filter((a) => a.data_desfecho === data),
    }
  }, [lista, data])

  const q = busca.trim().toLowerCase()
  const visiveis = grupos[filtro].filter((a) => !q || [a.prontuario, a.iniciais, a.cid].some((v) => v && String(v).toLowerCase().includes(q)))
  // Agrupa por setor (na ordem dos parâmetros)
  const setores = [...ativos('setor').map((s) => s.nome), ...new Set(visiveis.map((a) => a.setor || 'Sem setor'))]
  const porSetor = [...new Set(setores)].map((s) => ({ setor: s, itens: visiveis.filter((a) => (a.setor || 'Sem setor') === s) })).filter((g) => g.itens.length)
  const porRisco = contar(grupos.internados, (a) => a.risco)
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
        <button className={'stat stat-btn' + (filtro === 'internados' ? ' on' : '')} onClick={() => setFiltro('internados')}>
          <span>{ehHoje ? 'Internados agora' : 'Internados no fim do dia'}</span><strong>{lista ? grupos.internados.length : '–'}</strong>
        </button>
        <button className={'stat stat-btn' + (filtro === 'entradas' ? ' on' : '')} onClick={() => setFiltro('entradas')}>
          <span>Entradas do dia</span><strong>{lista ? grupos.entradas.length : '–'}</strong>
        </button>
        <button className={'stat stat-btn' + (filtro === 'saidas' ? ' on' : '')} onClick={() => setFiltro('saidas')}>
          <span>Altas do dia</span><strong>{lista ? grupos.saidas.length : '–'}</strong>
        </button>
      </div>

      {grupos.internados.length > 0 && (
        <div className="risk-strip" aria-label="Internados por classificação de risco">
          {ativos('risco').map((r) => {
            const n = porRisco.get(r.nome) || 0
            return n ? <div key={r.id} style={{ flex: n, background: r.cor }} title={`${r.nome}: ${n}`} /> : null
          })}
        </div>
      )}

      <div className="list-head">
        <h2>{filtro === 'internados' ? 'Pacientes internados' : filtro === 'entradas' ? 'Entradas do dia' : 'Altas do dia'}</h2>
        <Segmented value={filtro} onChange={setFiltro}
          options={[{ value: 'internados', label: 'Internados' }, { value: 'entradas', label: 'Entradas' }, { value: 'saidas', label: 'Altas' }]} />
      </div>
      {grupos[filtro].length > 6 && (
        <div className="search">
          <Icon name="search" size={18} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prontuário, iniciais ou CID" />
        </div>
      )}

      {!lista ? <Spinner /> : visiveis.length === 0 ? (
        <Empty icon="file"
          titulo={filtro === 'internados' ? 'Nenhum paciente internado' : filtro === 'entradas' ? 'Nenhuma entrada neste dia' : 'Nenhuma alta neste dia'}
          texto={filtro === 'internados' ? 'Toque em “Incluir paciente” para registrar uma nova internação.' : null} />
      ) : porSetor.map((g) => (
        <section key={g.setor} className="day-group">
          {porSetor.length > 1 && <h3 className="day-title">{g.setor}<span>{g.itens.length}</span></h3>}
          <div className="cards">
            {g.itens.map((a) => <AtendimentoCard key={a.id} a={a} dia={data} onOpen={setDet} mostrarMedico />)}
          </div>
        </section>
      ))}

      <button className="fab" onClick={() => setForm({ open: true, inicial: null })}>
        <Icon name="plus" size={22} /><span>Incluir paciente</span>
      </button>

      <AtendimentoForm open={form.open} inicial={form.inicial} dataPadrao={data}
        onClose={() => setForm({ open: false, inicial: null })} onSaved={carregar} />
      <AtendimentoDetalhe a={det} onClose={() => setDet(null)}
        onEditar={(a) => { setDet(null); setForm({ open: true, inicial: a }) }}
        onExcluido={recarregar} onAlterado={recarregar} />
    </div>
  )
}
