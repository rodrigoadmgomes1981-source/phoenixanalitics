import { useEffect, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { CAMPOS, TIPOS_PARAMETRO } from '../../lib/defaults'
import Icon from '../../components/Icon'
import { Confirm, Field, Sheet } from '../../components/ui'

const ABAS = [...TIPOS_PARAMETRO.map((t) => ({ id: t.tipo, label: t.titulo })), { id: 'campos', label: 'Formulário' }, { id: 'unidade', label: 'Unidade' }]

export default function Parametros() {
  const [aba, setAba] = useState('risco')
  return (
    <div className="page">
      <h1 className="page-title">Parâmetros</h1>
      <p className="muted mb">Organize as listas de seleção e as regras do formulário preenchido pelos médicos.</p>
      <div className="chips chips-scroll tabs-line">
        {ABAS.map((a) => <button key={a.id} className={'chip' + (aba === a.id ? ' on' : '')} onClick={() => setAba(a.id)}>{a.label}</button>)}
      </div>
      {aba === 'campos' ? <Campos /> : aba === 'unidade' ? <Unidade /> : <Lista tipo={aba} />}
    </div>
  )
}

function Lista({ tipo }) {
  const { parametros, recarregarParametros, toast } = useApp()
  const meta = TIPOS_PARAMETRO.find((t) => t.tipo === tipo)
  const itens = parametros.filter((p) => p.tipo === tipo).sort((a, b) => a.ordem - b.ordem)
  const [edit, setEdit] = useState(null)
  const [excluir, setExcluir] = useState(null)

  const run = async (fn, msg) => {
    try { await fn(); await recarregarParametros(); if (msg) toast(msg) } catch (e) { toast(e.message, 'erro') }
  }
  const mover = (i, d) => {
    const ids = itens.map((x) => x.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    run(() => api.reordenarParametros(ids))
  }
  async function salvar() {
    const nome = edit.nome.trim()
    if (!nome) return toast('Informe o nome.', 'erro')
    if (itens.some((x) => x.id !== edit.id && x.nome.toLowerCase() === nome.toLowerCase())) return toast('Já existe um item com esse nome.', 'erro')
    const dados = { tipo, nome, ...(meta.usaCor ? { cor: edit.cor || '#64748B' } : {}) }
    await run(() => api.saveParametro(edit.id ? { id: edit.id, ...dados } : dados), edit.id ? 'Item atualizado.' : 'Item adicionado.')
    setEdit(null)
  }

  return (
    <div className="card card-flush">
      <div className="card-pad row-between">
        <div>
          <h2 className="card-title">{meta.titulo}</h2>
          <p className="muted small">{itens.filter((x) => x.ativo).length} ativo(s). Itens inativos não aparecem para o médico, mas continuam nos registros antigos.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEdit({ nome: '', cor: '#64748B' })}><Icon name="plus" size={18} />Adicionar</button>
      </div>
      <ul className="param-list">
        {itens.map((p, i) => (
          <li key={p.id} className={p.ativo ? '' : 'inativo'}>
            <div className="param-order">
              <button className="icon-btn sm" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Subir"><Icon name="up" size={16} /></button>
              <button className="icon-btn sm" disabled={i === itens.length - 1} onClick={() => mover(i, 1)} aria-label="Descer"><Icon name="down" size={16} /></button>
            </div>
            {meta.usaCor && <span className="swatch" style={{ background: p.cor }} />}
            <button className="param-name" onClick={() => setEdit({ ...p })}>{p.nome}</button>
            <label className="switch" title={p.ativo ? 'Ativo' : 'Inativo'}>
              <input type="checkbox" checked={p.ativo} onChange={() => run(() => api.saveParametro({ id: p.id, ativo: !p.ativo }), p.ativo ? 'Item desativado.' : 'Item ativado.')} />
              <span />
            </label>
            <button className="icon-btn sm" onClick={() => setExcluir(p)} aria-label="Excluir"><Icon name="trash" size={16} /></button>
          </li>
        ))}
      </ul>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar item' : `Novo item — ${meta.titulo}`}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary btn-grow" onClick={salvar}>Salvar</button></>}>
        {edit && (
          <div className="stack">
            <Field label="Nome" obrigatorio><input autoFocus value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            {meta.usaCor && (
              <Field label="Cor" hint="Usada nos cartões e no painel">
                <div className="color-row">
                  <input type="color" value={edit.cor || '#64748B'} onChange={(e) => setEdit({ ...edit, cor: e.target.value })} />
                  {['#D92D20', '#F2730C', '#E3B008', '#16A34A', '#2563EB', '#64748B'].map((c) => (
                    <button key={c} type="button" className={'swatch swatch-btn' + (edit.cor === c ? ' on' : '')} style={{ background: c }} onClick={() => setEdit({ ...edit, cor: c })} aria-label={c} />
                  ))}
                </div>
              </Field>
            )}
            {edit.id && <p className="muted small">Renomear não altera registros já gravados com o nome anterior.</p>}
          </div>
        )}
      </Sheet>
      <Confirm open={!!excluir} titulo="Excluir item?" perigo okLabel="Excluir"
        texto={`“${excluir?.nome}” deixará de aparecer nas listas. Registros antigos mantêm o valor. Se preferir apenas ocultar, use o botão de ativo/inativo.`}
        onOk={async () => { await run(() => api.deleteParametro(excluir.id), 'Item excluído.'); setExcluir(null) }} onCancel={() => setExcluir(null)} />
    </div>
  )
}

function Campos() {
  const { config, recarregarConfig, toast } = useApp()
  const [c, setC] = useState(config)
  useEffect(() => setC(config), [config])
  const set = (k, prop, v) => setC({ ...c, campos: { ...c.campos, [k]: { ...c.campos[k], [prop]: v, ...(prop === 'visivel' && !v ? { obrigatorio: false } : {}) } } })
  const salvar = async () => { try { await api.saveConfig(c); await recarregarConfig(); toast('Formulário atualizado.') } catch (e) { toast(e.message, 'erro') } }

  return (
    <div className="card card-flush">
      <div className="card-pad">
        <h2 className="card-title">Campos do formulário</h2>
        <p className="muted small">Defina quais campos o médico vê e quais são obrigatórios.</p>
      </div>
      <div className="campos-head"><span>Campo</span><span>Exibir</span><span>Obrigatório</span></div>
      <ul className="campos-list">
        {CAMPOS.map(({ key, label, fixo }) => (
          <li key={key}>
            <span>{label}{fixo && <small className="muted"> · fixo</small>}</span>
            <label className="switch"><input type="checkbox" disabled={fixo} checked={fixo || c.campos[key]?.visivel !== false} onChange={(e) => set(key, 'visivel', e.target.checked)} /><span /></label>
            <label className="switch"><input type="checkbox" disabled={fixo || c.campos[key]?.visivel === false} checked={fixo || !!c.campos[key]?.obrigatorio} onChange={(e) => set(key, 'obrigatorio', e.target.checked)} /><span /></label>
          </li>
        ))}
      </ul>
      <div className="card-pad stack">
        <label className="check-row">
          <input type="checkbox" checked={!!c.especialidadesMultiplas} onChange={(e) => setC({ ...c, especialidadesMultiplas: e.target.checked })} />
          <span>Permitir mais de um especialista por atendimento</span>
        </label>
        <button className="btn btn-primary" onClick={salvar}>Salvar formulário</button>
      </div>
    </div>
  )
}

function Unidade() {
  const { config, recarregarConfig, toast } = useApp()
  const [c, setC] = useState(config)
  useEffect(() => setC(config), [config])
  const salvar = async () => { try { await api.saveConfig(c); await recarregarConfig(); toast('Dados da unidade salvos.') } catch (e) { toast(e.message, 'erro') } }
  return (
    <div className="card stack">
      <h2 className="card-title">Dados da unidade</h2>
      <Field label="Hospital / unidade"><input value={c.hospital} onChange={(e) => setC({ ...c, hospital: e.target.value })} /></Field>
      <Field label="Empresa responsável"><input value={c.empresa} onChange={(e) => setC({ ...c, empresa: e.target.value })} /></Field>
      <button className="btn btn-primary" onClick={salvar}>Salvar</button>
    </div>
  )
}
