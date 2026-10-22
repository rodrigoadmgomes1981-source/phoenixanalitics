import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context'
import { api, DEMO } from '../../lib/api'
import { iniciaisNome } from '../../lib/utils'
import Icon from '../../components/Icon'
import { Field, Sheet, Spinner, Segmented } from '../../components/ui'

const NOVO = { nome: '', email: '', crm: '', role: 'medico', senha: '' }

export default function Usuarios() {
  const { profile, toast } = useApp()
  const [lista, setLista] = useState(null)
  const [filtro, setFiltro] = useState('medico')
  const [novo, setNovo] = useState(null)
  const [edit, setEdit] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try { setLista(await api.listUsuarios()) } catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])

  async function criar() {
    const { nome, email, senha } = novo
    if (!nome.trim() || !/^\S+@\S+\.\S+$/.test(email) || senha.length < 6) return toast('Preencha nome, e-mail válido e senha (mín. 6).', 'erro')
    setSalvando(true)
    try { await api.createUsuario({ ...novo, nome: nome.trim(), email: email.trim().toLowerCase() }); toast('Usuário criado.'); setNovo(null); carregar() }
    catch (e) { toast(e.message, 'erro') } finally { setSalvando(false) }
  }
  async function salvarEdicao() {
    setSalvando(true)
    try {
      await api.updateUsuario(edit.id, { nome: edit.nome.trim(), crm: edit.crm, role: edit.role, ativo: edit.ativo })
      if (edit.novaSenha) {
        if (edit.novaSenha.length < 6) throw new Error('A nova senha deve ter pelo menos 6 caracteres.')
        await api.resetSenha(edit.id, edit.novaSenha)
      }
      toast('Usuário atualizado.'); setEdit(null); carregar()
    } catch (e) { toast(e.message, 'erro') } finally { setSalvando(false) }
  }

  const vis = (lista || []).filter((u) => (filtro === 'todos' ? true : filtro === 'inativos' ? !u.ativo : u.role === filtro && u.ativo))

  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Usuários</h1><p className="muted">Médicos preenchem o checklist; administradores gerenciam parâmetros e acompanham o painel.</p></div>
        <button className="btn btn-primary" onClick={() => setNovo({ ...NOVO })}><Icon name="plus" size={18} />Novo usuário</button>
      </div>
      <Segmented value={filtro} onChange={setFiltro}
        options={[{ value: 'medico', label: 'Médicos' }, { value: 'admin', label: 'Admins' }, { value: 'inativos', label: 'Inativos' }, { value: 'todos', label: 'Todos' }]} />

      {!lista ? <Spinner /> : (
        <ul className="user-list">
          {vis.length === 0 && <li className="muted small">Nenhum usuário nesta lista.</li>}
          {vis.map((u) => (
            <li key={u.id}>
              <button className="user-row" onClick={() => setEdit({ ...u, novaSenha: '' })}>
                <span className={'avatar' + (u.role === 'admin' ? ' avatar-navy' : '')}>{iniciaisNome(u.nome)}</span>
                <span className="user-info">
                  <strong>{u.nome}{u.id === profile.id && <small className="muted"> (você)</small>}</strong>
                  <span className="muted small">{u.email}{u.crm ? ` · ${u.crm}` : ''}</span>
                </span>
                <span className={'tag ' + (!u.ativo ? 'tag-muted' : u.role === 'admin' ? 'tag-navy' : 'tag-teal')}>{!u.ativo ? 'Inativo' : u.role === 'admin' ? 'Admin' : 'Médico'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!novo} onClose={() => setNovo(null)} title="Novo usuário"
        footer={<><button className="btn btn-ghost" onClick={() => setNovo(null)}>Cancelar</button><button className="btn btn-primary btn-grow" disabled={salvando} onClick={criar}>{salvando ? 'Criando…' : 'Criar usuário'}</button></>}>
        {novo && (
          <div className="stack">
            <Segmented value={novo.role} onChange={(role) => setNovo({ ...novo, role })} options={[{ value: 'medico', label: 'Médico' }, { value: 'admin', label: 'Administrador' }]} />
            <Field label="Nome completo" obrigatorio><input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Dr(a). Nome Sobrenome" /></Field>
            <Field label="E-mail (login)" obrigatorio><input type="email" inputMode="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Field>
            {novo.role === 'medico' && <Field label="CRM"><input value={novo.crm} onChange={(e) => setNovo({ ...novo, crm: e.target.value })} placeholder="CRM/SC 00000" /></Field>}
            <Field label="Senha inicial" obrigatorio hint="Mínimo 6 caracteres. O usuário pode trocar no Perfil.">
              <input type="text" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} />
            </Field>
            {!DEMO && <p className="muted small">O acesso é liberado imediatamente, sem e-mail de confirmação.</p>}
          </div>
        )}
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title="Editar usuário"
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancelar</button><button className="btn btn-primary btn-grow" disabled={salvando} onClick={salvarEdicao}>Salvar</button></>}>
        {edit && (
          <div className="stack">
            <p className="muted small">{edit.email}</p>
            <Field label="Nome completo"><input value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} /></Field>
            <Field label="CRM"><input value={edit.crm || ''} onChange={(e) => setEdit({ ...edit, crm: e.target.value })} /></Field>
            <Field label="Perfil">
              <Segmented value={edit.role} onChange={(role) => edit.id !== profile.id && setEdit({ ...edit, role })}
                options={[{ value: 'medico', label: 'Médico' }, { value: 'admin', label: 'Administrador' }]} />
            </Field>
            <label className="check-row">
              <input type="checkbox" checked={edit.ativo} disabled={edit.id === profile.id} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} />
              <span>Usuário ativo (pode acessar o sistema)</span>
            </label>
            <Field label="Redefinir senha" hint="Deixe em branco para manter a atual">
              <input type="text" value={edit.novaSenha} onChange={(e) => setEdit({ ...edit, novaSenha: e.target.value })} />
            </Field>
            {edit.id === profile.id && <p className="muted small">Você não pode alterar o próprio perfil de acesso nem se desativar.</p>}
          </div>
        )}
      </Sheet>
    </div>
  )
}
