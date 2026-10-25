import { useState } from 'react'
import { api, DEMO } from '../lib/api'
import Icon from '../components/Icon'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e, em = email, se = senha) {
    e?.preventDefault()
    setErro(''); setCarregando(true)
    try { onLogin(await api.signIn(em, se)) } catch (err) { setErro(err.message) } finally { setCarregando(false) }
  }

  return (
    <div className="login">
      <div className="login-bg" aria-hidden="true" />
      <main className="login-card">
        <img src="/logo-full.png" alt="Phoenix Serviços Médicos" className="login-logo" />
        <div className="login-title">
          <span className="eyebrow">Checklist Médico</span>
          <h1>Hospital Cirúrgico de Camboriú</h1>
          <p className="muted">Monitoramento diário de atendimentos</p>
        </div>
        <form onSubmit={entrar} className="stack">
          <label className="field">
            <span className="field-label">E-mail</span>
            <input type="email" inputMode="email" autoComplete="username" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
          </label>
          <label className="field">
            <span className="field-label">Senha</span>
            <div className="input-affix">
              <input type={ver ? 'text' : 'password'} autoComplete="current-password" required value={senha}
                onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" />
              <button type="button" className="affix-btn" onClick={() => setVer(!ver)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </label>
          {erro && <div className="alert alert-erro"><Icon name="alert" size={18} />{erro}</div>}
          <button className="btn btn-primary btn-lg btn-block" disabled={carregando}>
            {carregando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        {DEMO && (
          <div className="demo-box">
            <strong>Modo demonstração</strong>
            <p>Dados ficam apenas neste navegador. Entre com um perfil de teste:</p>
            <div className="demo-btns">
              <button className="btn btn-soft" onClick={() => entrar(null, 'admin@demo.com', 'admin123')}>
                <Icon name="sliders" size={18} />Administrador
              </button>
              <button className="btn btn-soft" onClick={() => entrar(null, 'medico@demo.com', 'medico123')}>
                <Icon name="user" size={18} />Médico
              </button>
            </div>
          </div>
        )}
        <img src="/logo-camboriu.png" alt="Prefeitura de Camboriú" className="login-pref" />
        <p className="login-foot">Uso restrito. Dados de saúde protegidos pela LGPD — registre apenas iniciais do paciente.</p>
      </main>
    </div>
  )
}
