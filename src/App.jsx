import { useCallback, useEffect, useState } from 'react'
import { api, usarVisualizacao } from './lib/api'
import { supabase } from './lib/supabase'
import { AppProvider } from './context'
import Login from './pages/Login'
import Shell from './components/Shell'
import { Spinner } from './components/ui'
import Icon from './components/Icon'

const TOKEN_VIEW = (window.location.pathname.match(/^\/v\/([\w-]{16,})\/?$/) || [])[1]

export default function App() {
  return TOKEN_VIEW ? <Visualizador token={TOKEN_VIEW} /> : <AppLogado />
}

function Visualizador({ token }) {
  const [estado, setEstado] = useState({ fase: 'carregando' })
  const [versao, setVersao] = useState(0)

  useEffect(() => {
    const v = usarVisualizacao(token)
    v.init()
      .then((link) => setEstado({ fase: 'ok', link, v }))
      .catch((e) => setEstado({ fase: 'erro', msg: e.message }))
  }, [token])

  if (estado.fase === 'carregando') return <div className="boot"><img src="/logo-mark.png" alt="" /><Spinner label="Abrindo painel…" /></div>
  if (estado.fase === 'erro') {
    const invalido = estado.msg === 'link_invalido'
    return (
      <div className="login">
        <div className="login-bg" aria-hidden="true" />
        <main className="login-card">
          <img src="/logo-full.png" alt="Phoenix Serviços Médicos" className="login-logo" />
          <div className="login-title">
            <span className="eyebrow">Link de visualização</span>
            <h1>{invalido ? 'Link inválido ou expirado' : 'Não foi possível abrir o painel'}</h1>
            <p className="muted">{invalido ? 'Este link foi revogado, expirou ou está incorreto. Peça um novo link à coordenação.' : estado.msg}</p>
          </div>
          {!invalido && <button className="btn btn-primary btn-block" onClick={() => window.location.reload()}><Icon name="refresh" size={18} />Tentar novamente</button>}
          <img src="/logo-camboriu.png" alt="Prefeitura de Camboriú" className="login-pref" />
        </main>
      </div>
    )
  }
  const atualizar = () => { estado.v.limparCache(); setVersao((x) => x + 1) }
  return (
    <AppProvider key={versao} profile={{ id: 'viewer', nome: estado.link.nome, role: 'viewer' }} onLogout={null}>
      <Shell onAtualizar={atualizar} />
    </AppProvider>
  )
}

function AppLogado() {
  const [profile, setProfile] = useState(undefined)

  useEffect(() => {
    api.currentProfile().then(setProfile).catch(() => setProfile(null))
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT') setProfile(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const sair = useCallback(async () => {
    await api.signOut()
    history.replaceState(null, '', window.location.pathname)
    setProfile(null)
  }, [])

  if (profile === undefined) return <div className="boot"><img src="/logo-mark.png" alt="" /><Spinner /></div>
  if (!profile) return <Login onLogin={setProfile} />

  return (
    <AppProvider profile={profile} onLogout={sair}>
      <Shell />
    </AppProvider>
  )
}
