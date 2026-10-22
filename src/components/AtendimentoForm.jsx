import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { api } from '../lib/api'
import { CAMPOS } from '../lib/defaults'
import { hojeISO, idade } from '../lib/utils'
import { Field, Sheet } from './ui'
import Icon from './Icon'

const VAZIO = {
  prontuario: '', iniciais: '', data_nascimento: '', data_atendimento: '', risco: null, setor: null,
  especialidades: [], cid: '', exames: '', medicacoes: '', desfecho: null, observacoes: '',
}

export default function AtendimentoForm({ open, inicial, dataPadrao, onClose, onSaved }) {
  const { ativos, config, toast } = useApp()
  const [f, setF] = useState(VAZIO)
  const [erros, setErros] = useState({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setErros({})
    setF(inicial
      ? { ...VAZIO, ...Object.fromEntries(Object.entries(inicial).map(([k, v]) => [k, v ?? VAZIO[k] ?? ''])) }
      : { ...VAZIO, data_atendimento: dataPadrao || hojeISO() })
  }, [open, inicial, dataPadrao])

  const campo = (k) => config.campos[k] || { visivel: true, obrigatorio: false }
  const vis = (k) => campo(k).visivel !== false || k === 'data_atendimento'
  const obr = (k) => !!campo(k).obrigatorio || k === 'data_atendimento'
  const label = (k) => CAMPOS.find((c) => c.key === k)?.label
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); if (erros[k]) setErros((e) => ({ ...e, [k]: null })) }

  // Garante que valores antigos (parâmetros desativados) continuem aparecendo na edição
  const opcoes = (tipo, atual) => {
    const l = ativos(tipo)
    const extras = [].concat(atual || []).filter((v) => v && !l.some((p) => p.nome === v)).map((nome) => ({ id: nome, nome, inativo: true }))
    return [...l, ...extras]
  }
  const riscos = useMemo(() => opcoes('risco', f.risco), [ativos, f.risco]) // eslint-disable-line react-hooks/exhaustive-deps
  const idadeCalc = idade(f.data_nascimento, f.data_atendimento)

  function validar() {
    const e = {}
    for (const { key } of CAMPOS) {
      if (!vis(key) || !obr(key)) continue
      const v = f[key]
      if (Array.isArray(v) ? v.length === 0 : !String(v ?? '').trim()) e[key] = 'Campo obrigatório'
    }
    if (f.data_nascimento && f.data_atendimento && f.data_nascimento > f.data_atendimento) e.data_nascimento = 'Data posterior ao atendimento'
    if (f.data_atendimento && f.data_atendimento > hojeISO()) e.data_atendimento = 'Data futura não permitida'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function salvar(continuar) {
    if (!validar()) {
      toast('Revise os campos destacados.', 'erro')
      setTimeout(() => document.querySelector('.sheet .has-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30)
      return
    }
    setSalvando(true)
    try {
      await api.saveAtendimento(f)
      toast(inicial?.id ? 'Atendimento atualizado.' : 'Atendimento registrado.')
      onSaved?.()
      if (continuar) {
        setF({ ...VAZIO, data_atendimento: f.data_atendimento })
        document.querySelector('.sheet-body')?.scrollTo({ top: 0, behavior: 'smooth' })
      } else onClose()
    } catch (err) { toast(err.message, 'erro') } finally { setSalvando(false) }
  }

  const toggleEsp = (nome) => {
    const atual = f.especialidades || []
    if (!config.especialidadesMultiplas) return set('especialidades', atual.includes(nome) ? [] : [nome])
    set('especialidades', atual.includes(nome) ? atual.filter((x) => x !== nome) : [...atual, nome])
  }

  return (
    <Sheet open={open} onClose={onClose} title={inicial?.id ? 'Editar atendimento' : 'Novo atendimento'}
      footer={<>
        {!inicial?.id && <button className="btn btn-ghost" disabled={salvando} onClick={() => salvar(true)}>Salvar e novo</button>}
        <button className="btn btn-primary btn-grow" disabled={salvando} onClick={() => salvar(false)}>
          <Icon name="check" size={18} />{salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </>}>
      <div className="form">
        <section className="form-sec">
          <h3><span>1</span>Paciente</h3>
          <div className="grid-2">
            {vis('prontuario') && (
              <Field label={label('prontuario')} obrigatorio={obr('prontuario')} erro={erros.prontuario}>
                <input inputMode="numeric" value={f.prontuario} onChange={(e) => set('prontuario', e.target.value)} placeholder="Nº do prontuário" />
              </Field>
            )}
            {vis('iniciais') && (
              <Field label={label('iniciais')} obrigatorio={obr('iniciais')} erro={erros.iniciais} hint="Apenas iniciais (LGPD)">
                <input value={f.iniciais} maxLength={12} autoCapitalize="characters"
                  onChange={(e) => set('iniciais', e.target.value.toUpperCase())} placeholder="Ex.: J.S.P." />
              </Field>
            )}
            {vis('data_nascimento') && (
              <Field label={label('data_nascimento')} obrigatorio={obr('data_nascimento')} erro={erros.data_nascimento}
                hint={idadeCalc != null ? `${idadeCalc} ano${idadeCalc === 1 ? '' : 's'}` : null}>
                <input type="date" value={f.data_nascimento} max={hojeISO()} onChange={(e) => set('data_nascimento', e.target.value)} />
              </Field>
            )}
            <Field label={label('data_atendimento')} obrigatorio erro={erros.data_atendimento}>
              <input type="date" value={f.data_atendimento} max={hojeISO()} onChange={(e) => set('data_atendimento', e.target.value)} />
            </Field>
          </div>
        </section>

        <section className="form-sec">
          <h3><span>2</span>Classificação e setor</h3>
          {vis('risco') && (
            <Field label={label('risco')} obrigatorio={obr('risco')} erro={erros.risco}>
              <div className="risco-opts" role="radiogroup">
                {riscos.map((r) => (
                  <button type="button" key={r.id} role="radio" aria-checked={f.risco === r.nome}
                    className={'risco-opt' + (f.risco === r.nome ? ' on' : '')} style={{ '--c': r.cor || '#64748B' }}
                    onClick={() => set('risco', f.risco === r.nome ? null : r.nome)}>
                    <i /><span>{r.nome}</span>{f.risco === r.nome && <Icon name="check" size={16} />}
                  </button>
                ))}
              </div>
            </Field>
          )}
          {vis('setor') && (
            <Field label={label('setor')} obrigatorio={obr('setor')} erro={erros.setor}>
              <div className="chips">
                {opcoes('setor', f.setor).map((s) => (
                  <button type="button" key={s.id} className={'chip' + (f.setor === s.nome ? ' on' : '')}
                    onClick={() => set('setor', f.setor === s.nome ? null : s.nome)}>{s.nome}</button>
                ))}
              </div>
            </Field>
          )}
        </section>

        <section className="form-sec">
          <h3><span>3</span>Conduta</h3>
          {vis('especialidades') && (
            <Field label={label('especialidades')} obrigatorio={obr('especialidades')} erro={erros.especialidades}
              hint={config.especialidadesMultiplas ? 'Toque para selecionar uma ou mais' : 'Selecione uma opção'}>
              <div className="chips">
                {opcoes('especialidade', f.especialidades).map((s) => (
                  <button type="button" key={s.id} className={'chip' + (f.especialidades?.includes(s.nome) ? ' on' : '')}
                    onClick={() => toggleEsp(s.nome)}>{f.especialidades?.includes(s.nome) && <Icon name="check" size={14} />}{s.nome}</button>
                ))}
              </div>
            </Field>
          )}
          {vis('cid') && (
            <Field label={label('cid')} obrigatorio={obr('cid')} erro={erros.cid}>
              <input value={f.cid} autoCapitalize="characters" onChange={(e) => set('cid', e.target.value.toUpperCase())} placeholder="Ex.: R10.4" />
            </Field>
          )}
          {vis('exames') && (
            <Field label={label('exames')} obrigatorio={obr('exames')} erro={erros.exames}>
              <textarea rows={2} value={f.exames} onChange={(e) => set('exames', e.target.value)} placeholder="Ex.: Hemograma, PCR, TC de abdome" />
            </Field>
          )}
          {vis('medicacoes') && (
            <Field label={label('medicacoes')} obrigatorio={obr('medicacoes')} erro={erros.medicacoes}>
              <textarea rows={2} value={f.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} placeholder="Ex.: Dipirona 1g EV, Ondansetrona 8mg EV" />
            </Field>
          )}
        </section>

        <section className="form-sec">
          <h3><span>4</span>Desfecho</h3>
          {vis('desfecho') && (
            <Field label={label('desfecho')} obrigatorio={obr('desfecho')} erro={erros.desfecho}
              hint={!obr('desfecho') ? 'Pode ficar pendente e ser preenchido depois' : null}>
              <div className="chips">
                {!obr('desfecho') && (
                  <button type="button" className={'chip chip-pend' + (!f.desfecho ? ' on' : '')} onClick={() => set('desfecho', null)}>
                    <Icon name="clock" size={14} />Pendente
                  </button>
                )}
                {opcoes('desfecho', f.desfecho).map((s) => (
                  <button type="button" key={s.id} className={'chip' + (f.desfecho === s.nome ? ' on' : '')}
                    onClick={() => set('desfecho', s.nome)}>{s.nome}</button>
                ))}
              </div>
            </Field>
          )}
          {vis('observacoes') && (
            <Field label={label('observacoes')} obrigatorio={obr('observacoes')} erro={erros.observacoes}>
              <textarea rows={2} value={f.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Informações adicionais (opcional)" />
            </Field>
          )}
        </section>
      </div>
    </Sheet>
  )
}
