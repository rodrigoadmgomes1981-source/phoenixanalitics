import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { api } from '../lib/api'
import { diasPermanencia, fmtData, fmtHora, hojeISO, idade, nomeCurto, rotuloPermanencia } from '../lib/utils'
import { Confirm, Field, RiscoTag, Sheet } from './ui'
import Icon from './Icon'

/**
 * Cartão do paciente. "dia" é o dia que está sendo visto no plantão:
 * a permanência é contada até ele (ou até a saída, se o paciente já teve alta).
 */
export function AtendimentoCard({ a, onOpen, mostrarMedico, mostrarData, dia: refDia }) {
  const { corRisco } = useApp()
  const cor = corRisco(a.risco) || '#94A3B8'
  const id = a.idade ?? idade(a.data_nascimento, a.data_atendimento)
  const dias = diasPermanencia(a, refDia)
  const saiuNoDia = a.data_desfecho && (!refDia || a.data_desfecho <= refDia)
  return (
    <button className={'atd-card' + (saiuNoDia ? ' atd-saiu' : '')} style={{ '--c': cor }} onClick={() => onOpen(a)}>
      <div className="atd-main">
        <div className="atd-top">
          {/* No link de visualização não há iniciais nem prontuário (dados anonimizados) */}
          <strong className="atd-ini">{a.iniciais || (a.prontuario ? '—' : 'Paciente')}</strong>
          {id != null && <span className="atd-meta">{id} anos</span>}
          {a.prontuario && <span className="atd-meta">· Pront. {a.prontuario}</span>}
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
          {saiuNoDia
            ? <span className="desf"><Icon name="check" size={14} />{a.desfecho} · {fmtData(a.data_desfecho, { day: '2-digit', month: '2-digit' })}</span>
            : <span className="desf desf-int"><span className="pulse" />Internado · {rotuloPermanencia(dias)}</span>}
          <span className="atd-hora">
            {mostrarData ? `entrada ${fmtData(a.data_atendimento, { day: '2-digit', month: '2-digit' })}` : `desde ${fmtData(a.data_atendimento, { day: '2-digit', month: '2-digit' })}`}
            {mostrarMedico && ` · ${nomeCurto(a.medico_nome)}`}
          </span>
        </div>
      </div>
      <Icon name="right" size={18} className="atd-chev" />
    </button>
  )
}

/** Folha para registrar a alta/desfecho de um paciente internado. */
export function AltaSheet({ a, onClose, onDone }) {
  const { ativos, toast } = useApp()
  const [desfecho, setDesfecho] = useState(null)
  const [data, setData] = useState(hojeISO())
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { if (a) { setDesfecho(null); setData(hojeISO() < a.data_atendimento ? a.data_atendimento : hojeISO()) } }, [a])
  if (!a) return null

  async function salvar() {
    if (!desfecho) return toast('Selecione o desfecho.', 'erro')
    if (!data || data < a.data_atendimento || data > hojeISO()) return toast('Data da alta inválida.', 'erro')
    setSalvando(true)
    try { await api.darAlta(a.id, desfecho, data); toast(`Alta registrada: ${a.iniciais || 'paciente'} — ${desfecho}.`); onDone?.() }
    catch (e) { toast(e.message, 'erro') } finally { setSalvando(false) }
  }

  return (
    <Sheet open={!!a} onClose={onClose} title={`Dar alta · ${a.iniciais || 'Paciente'}`}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary btn-grow" disabled={salvando} onClick={salvar}><Icon name="check" size={18} />{salvando ? 'Salvando…' : 'Confirmar alta'}</button></>}>
      <div className="stack">
        <p className="muted small">Internado desde {fmtData(a.data_atendimento)} ({rotuloPermanencia(diasPermanencia(a, data))}). Depois da alta o paciente sai da lista diária do plantão.</p>
        <Field label="Desfecho" obrigatorio>
          <div className="chips">
            {ativos('desfecho').map((d) => (
              <button type="button" key={d.id} className={'chip' + (desfecho === d.nome ? ' on' : '')} onClick={() => setDesfecho(d.nome)}>
                {desfecho === d.nome && <Icon name="check" size={14} />}{d.nome}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Data da alta" obrigatorio>
          <input type="date" value={data} min={a.data_atendimento} max={hojeISO()} onChange={(e) => setData(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}

export function AtendimentoDetalhe({ a, onClose, onEditar, onExcluido, onAlterado }) {
  const { corRisco, profile, toast } = useApp()
  const [confirmar, setConfirmar] = useState(false)
  const [alta, setAlta] = useState(null)
  const [reabrir, setReabrir] = useState(false)
  if (!a) return null
  const id = idade(a.data_nascimento, a.data_atendimento)
  const dias = diasPermanencia(a)
  const linhas = [
    ['Situação', a.desfecho ? `Alta em ${fmtData(a.data_desfecho)} — ${a.desfecho}` : `Internado · ${rotuloPermanencia(dias)}`],
    ['Prontuário', a.prontuario],
    ['Iniciais', a.iniciais],
    ['Nascimento', a.data_nascimento ? `${fmtData(a.data_nascimento)}${id != null ? ` (${id} anos)` : ''}` : null],
    ['Data de internação', fmtData(a.data_atendimento)],
    ['Permanência', a.desfecho ? rotuloPermanencia(dias).replace('entrou hoje', 'mesmo dia') : null],
    ['Setor', a.setor],
    ['Apoio de especialista', (a.especialidades || []).join(', ') || 'Nenhum'],
    ['CID', a.cid],
    ['Exames solicitados', [(a.exames_grupos || []).join(', '), a.exames].filter(Boolean).join(' — ')],
    ['Medicações', [(a.medicacoes_classes || []).join(', '), a.medicacoes].filter(Boolean).join(' — ')],
    ['Observações', a.observacoes],
    ['Incluído por', `${a.medico_nome || '—'} · ${fmtData(a.created_at)} às ${fmtHora(a.created_at)}`],
    ['Alta registrada por', a.alta_por_nome],
    ['Última edição', a.updated_at ? `${fmtData(a.updated_at)} às ${fmtHora(a.updated_at)}` : null],
  ]
  const podeEditar = profile.role === 'admin' || profile.role === 'medico'

  async function excluir() {
    try { await api.deleteAtendimento(a.id); toast('Registro excluído.'); onExcluido?.() } catch (e) { toast(e.message, 'erro') }
    setConfirmar(false)
  }
  async function desfazerAlta() {
    try { await api.darAlta(a.id, null, null); toast('Alta desfeita: paciente voltou para a lista de internados.'); onAlterado?.() } catch (e) { toast(e.message, 'erro') }
    setReabrir(false)
  }

  return (
    <>
      <Sheet open={!!a && !alta} onClose={onClose} title="Paciente"
        footer={podeEditar && <>
          {profile.role === 'admin' && <button className="icon-btn btn-danger-txt" onClick={() => setConfirmar(true)} aria-label="Excluir"><Icon name="trash" size={18} /></button>}
          <button className="btn btn-ghost" onClick={() => onEditar(a)}><Icon name="edit" size={18} />Editar</button>
          {a.desfecho
            ? <button className="btn btn-soft btn-grow" onClick={() => setReabrir(true)}><Icon name="refresh" size={18} />Desfazer alta</button>
            : <button className="btn btn-primary btn-grow" onClick={() => setAlta(a)}><Icon name="check" size={18} />Dar alta</button>}
        </>}>
        <div className="det-head" style={{ '--c': corRisco(a.risco) || '#94A3B8' }}>
          <RiscoTag nome={a.risco} cor={corRisco(a.risco)} />
          {a.desfecho ? <span className="tag tag-muted">Alta</span> : <span className="tag tag-teal"><span className="pulse" />Internado</span>}
        </div>
        <dl className="det-list">
          {linhas.filter(([, v]) => v).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
        </dl>
      </Sheet>
      <AltaSheet a={alta} onClose={() => setAlta(null)} onDone={() => { setAlta(null); onAlterado?.() }} />
      <Confirm open={reabrir} titulo="Desfazer alta?" okLabel="Desfazer alta"
        texto="O paciente volta para a lista diária de internados e o desfecho é apagado." onOk={desfazerAlta} onCancel={() => setReabrir(false)} />
      <Confirm open={confirmar} titulo="Excluir registro?" perigo okLabel="Excluir"
        texto="Esta ação não pode ser desfeita." onOk={excluir} onCancel={() => setConfirmar(false)} />
    </>
  )
}
