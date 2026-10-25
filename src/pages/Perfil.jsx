import { useState } from 'react'
import { useApp } from '../context'
import { api, DEMO } from '../lib/api'
import Icon from '../components/Icon'
import { Field } from '../components/ui'
import { iniciaisNome } from '../lib/utils'

export default function Perfil() {
  const { profile, onLogout, toast, config } = useApp()
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')

  async function trocar(e) {
    e.preventDefault()
    if (senha.length < 6) return toast('A senha deve ter pelo menos 6 caracteres.', 'erro')
    if (senha !== senha2) return toast('As senhas não conferem.', 'erro')
    try { await api.alterarSenha(senha); setSenha(''); setSenha2(''); toast('Senha alterada.') } catch (err) { toast(err.message, 'erro') }
  }

  return (
    <div className="page page-narrow">
      <div className="profile-card">
        <div className="avatar avatar-lg">{iniciaisNome(profile.nome)}</div>
        <div>
          <h1>{profile.nome}</h1>
          <p className="muted">{profile.email}</p>
          <div className="row-gap">
            <span className={'tag ' + (profile.role === 'admin' ? 'tag-navy' : 'tag-teal')}>{profile.role === 'admin' ? 'Administrador' : 'Médico'}</span>
            {profile.crm && <span className="tag">{profile.crm}</span>}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title"><Icon name="hospital" size={18} />Unidade</h2>
        <p><strong>{config.hospital}</strong></p>
        <p className="muted">{config.empresa}</p>
        <div className="perfil-logos">
          <img src="/logo-full.png" alt="Phoenix Serviços Médicos" />
          <img src="/logo-camboriu.png" alt="Prefeitura de Camboriú" />
        </div>
      </div>

      <form className="card stack" onSubmit={trocar}>
        <h2 className="card-title"><Icon name="key" size={18} />Alterar senha</h2>
        <Field label="Nova senha"><input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} /></Field>
        <Field label="Confirmar nova senha"><input type="password" autoComplete="new-password" value={senha2} onChange={(e) => setSenha2(e.target.value)} /></Field>
        <button className="btn btn-soft">Salvar nova senha</button>
      </form>

      <button className="btn btn-ghost btn-block btn-danger-txt" onClick={onLogout}><Icon name="logout" size={18} />Sair</button>
      {DEMO && (
        <button className="btn btn-ghost btn-block" onClick={async () => { await api.resetDemo(); window.location.reload() }}>
          <Icon name="refresh" size={18} />Restaurar dados de demonstração
        </button>
      )}
    </div>
  )
}
