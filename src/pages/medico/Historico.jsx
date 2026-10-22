import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { addDias, fmtDataLonga, hojeISO } from '../../lib/utils'
import Icon from '../../components/Icon'
import { Empty, Spinner, Segmented } from '../../components/ui'
import { AtendimentoCard, AtendimentoDetalhe } from '../../components/AtendimentoCard'
import AtendimentoForm from '../../components/AtendimentoForm'

export default function Historico() {
  const { profile, toast } = useApp()
  const [periodo, setPeriodo] = useState('30')
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState(null)
  const [det, setDet] = useState(null)
  const [form, setForm] = useState({ open: false, inicial: null })

  const carregar = useCallback(async () => {
    try {
      const de = periodo === 'tudo' ? undefined : addDias(hojeISO(), -Number(periodo) + 1)
      setLista(await api.listAtendimentos({ de, medicoId: profile.id }))
    } catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [periodo, profile.id, toast])
  useEffect(() => { setLista(null); carregar() }, [carregar])

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const f = (lista || []).filter((a) => !q || [a.prontuario, a.iniciais, a.cid, a.risco, a.setor, a.desfecho, ...(a.especialidades || [])]
      .some((v) => v && String(v).toLowerCase().includes(q)))
    const m = new Map()
    for (const a of f) { if (!m.has(a.data_atendimento)) m.set(a.data_atendimento, []); m.get(a.data_atendimento).push(a) }
    return [...m.entries()]
  }, [lista, busca])

  return (
    <div className="page">
      <h1 className="page-title">Meu histórico</h1>
      <div className="search">
        <Icon name="search" size={18} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar prontuário, iniciais, CID…" />
      </div>
      <Segmented value={periodo} onChange={setPeriodo}
        options={[{ value: '7', label: '7 dias' }, { value: '30', label: '30 dias' }, { value: '90', label: '90 dias' }, { value: 'tudo', label: 'Tudo' }]} />

      {!lista ? <Spinner /> : grupos.length === 0 ? (
        <Empty icon="search" titulo="Nada encontrado" texto="Ajuste o período ou a busca." />
      ) : grupos.map(([dia, itens]) => (
        <section key={dia} className="day-group">
          <h3 className="day-title">{fmtDataLonga(dia)}<span>{itens.length}</span></h3>
          <div className="cards">{itens.map((a) => <AtendimentoCard key={a.id} a={a} onOpen={setDet} />)}</div>
        </section>
      ))}

      <AtendimentoForm open={form.open} inicial={form.inicial} onClose={() => setForm({ open: false, inicial: null })} onSaved={carregar} />
      <AtendimentoDetalhe a={det} onClose={() => setDet(null)}
        onEditar={(a) => { setDet(null); setForm({ open: true, inicial: a }) }} onExcluido={() => { setDet(null); carregar() }} />
    </div>
  )
}
