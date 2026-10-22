import { useState } from 'react'
import { useApp } from '../context'
import { api } from '../lib/api'
import { fmtData, fmtHora, idade, nomeCurto } from '../lib/utils'
import { Confirm, RiscoTag, Sheet } from './ui'
import Icon from './Icon'

export function AtendimentoCard({ a, onOpen, mostrarMedico, mostrarData }) {
  const { corRisco } = useApp()
  const cor = corRisco(a.risco) || '#94A3B8'
  const id = idade(a.data_nascimento, a.data_atendimento)
  return (
    <button className="atd-card" style={{ '--c': cor }} onClick={() => onOpen(a)}>
      <div className="atd-main">
        <div className="atd-top">
          <strong className="atd-ini">{a.iniciais || '—'}</strong>
          {id != null && <span className="atd-meta">{id} anos</span>}
          <span className="atd-meta">· Pront. {a.prontuario || '—'}</span>
        </div>
        <div className="atd-tags">
          <RiscoTag nome={a.risco} cor={cor} compact />
          {a.setor && <span className="tag">{a.setor}</span>}
          {a.cid && <span className="tag tag-mono">{a.cid}</span>}
          {(a.especialidades || []).map((e) => <span key={e} className="tag tag-teal">{e}</span>)}
          {(a.exames_grupos || []).map((e) => <span key={'x' + e} className="tag tag-navy">{e}</span>)}
          {a.medicacoes_classes?.length > 0 && <span className="tag">{a.medicacoes_classes.length} classe{a.medicacoes_classes.length > 1 ? 's' : ''} de medicação</span>}
        </div>
        <div className="atd-foot">
          {a.desfecho
            ? <span className="desf"><Icon name="check" size={14} />{a.desfecho}</span>
            : <span className="desf desf-pend"><Icon name="clock" size={14} />Desfecho pendente</span>}
          <span className="atd-hora">
            {mostrarData && fmtData(a.data_atendimento, { day: '2-digit', month: '2-digit' }) + ' · '}
            {mostrarMedico ? nomeCurto(a.medico_nome) : fmtHora(a.created_at)}
          </span>
        </div>
      </div>
      <Icon name="right" size={18} className="atd-chev" />
    </button>
  )
}

export function AtendimentoDetalhe({ a, onClose, onEditar, onExcluido }) {
  const { corRisco, profile, toast } = useApp()
  const [confirmar, setConfirmar] = useState(false)
  if (!a) return null
  const id = idade(a.data_nascimento, a.data_atendimento)
  const linhas = [
    ['Prontuário', a.prontuario],
    ['Iniciais', a.iniciais],
    ['Nascimento', a.data_nascimento ? `${fmtData(a.data_nascimento)}${id != null ? ` (${id} anos)` : ''}` : null],
    ['Data do atendimento', fmtData(a.data_atendimento)],
    ['Setor', a.setor],
    ['Apoio de especialista', (a.especialidades || []).join(', ') || 'Nenhum'],
    ['CID', a.cid],
    ['Exames solicitados', [(a.exames_grupos || []).join(', '), a.exames].filter(Boolean).join(' — ')],
    ['Medicações', [(a.medicacoes_classes || []).join(', '), a.medicacoes].filter(Boolean).join(' — ')],
    ['Desfecho', a.desfecho || 'Pendente'],
    ['Observações', a.observacoes],
    ['Médico', a.medico_nome],
    ['Registrado em', `${fmtData(a.created_at)} às ${fmtHora(a.created_at)}`],
    ['Última edição', a.updated_at ? `${fmtData(a.updated_at)} às ${fmtHora(a.updated_at)}` : null],
  ]
  const podeEditar = profile.role === 'admin' || a.medico_id === profile.id

  async function excluir() {
    try { await api.deleteAtendimento(a.id); toast('Registro excluído.'); onExcluido?.() } catch (e) { toast(e.message, 'erro') }
    setConfirmar(false)
  }

  return (
    <>
      <Sheet open={!!a} onClose={onClose} title="Atendimento"
        footer={podeEditar && <>
          {profile.role === 'admin' && <button className="btn btn-ghost btn-danger-txt" onClick={() => setConfirmar(true)}><Icon name="trash" size={18} />Excluir</button>}
          <button className="btn btn-primary btn-grow" onClick={() => onEditar(a)}><Icon name="edit" size={18} />Editar</button>
        </>}>
        <div className="det-head" style={{ '--c': corRisco(a.risco) || '#94A3B8' }}>
          <RiscoTag nome={a.risco} cor={corRisco(a.risco)} />
        </div>
        <dl className="det-list">
          {linhas.filter(([, v]) => v).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </Sheet>
      <Confirm open={confirmar} titulo="Excluir atendimento?" perigo okLabel="Excluir"
        texto="Esta ação não pode ser desfeita." onOk={excluir} onCancel={() => setConfirmar(false)} />
    </>
  )
}
