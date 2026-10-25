import { useEffect, useState } from 'react'
import { useApp } from '../context'
import { DEMO } from '../lib/api'
import Icon from './Icon'
import { Spinner, Toasts } from './ui'
import { iniciaisNome } from '../lib/utils'
import Hoje from '../pages/medico/Hoje'
import Historico from '../pages/medico/Historico'
import Perfil from '../pages/Perfil'
import Painel from '../pages/admin/Painel'
import Analytics from '../pages/admin/Analytics'
import Registros from '../pages/admin/Registros'
import Parametros from '../pages/admin/Parametros'
import Usuarios from '../pages/admin/Usuarios'
import LinksPage from '../pages/admin/Links'

const ABAS = {
  medico: [
    { id: 'hoje', label: 'Plantão', icon: 'home', C: Hoje },
    { id: 'historico', label: 'Histórico', icon: 'list', C: Historico },
    { id: 'perfil', label: 'Perfil', icon: 'user', C: Perfil },
  ],
  admin: [
    { id: 'painel', label: 'Painel', icon: 'home', C: Painel },
    { id: 'analytics', label: 'Analytics', icon: 'trend', C: Analytics },
    { id: 'registros', label: 'Registros', icon: 'list', C: Registros },
    { id: 'parametros', label: 'Parâmetros', icon: 'sliders', C: Parametros },
    { id: 'usuarios', label: 'Usuários', icon: 'users', C: Usuarios },
    { id: 'links', label: 'Compartilhar', icon: 'share', C: LinksPage, soDesktop: true },
    { id: 'perfil', label: 'Perfil', icon: 'user', C: Perfil, soDesktop: true },
  ],
  viewer: [
    { id: 'painel', label: 'Painel', icon: 'home', C: Painel },
    { id: 'analytics', label: 'Analytics', icon: 'trend', C: Analytics },
  ],
}

const lerHash = () => window.location.hash.replace('#/', '')

export default function Shell({ onAtualizar }) {
  const { profile, config, toasts, pronto } = useApp()
  const viewer = profile.role === 'viewer'
  const abas = ABAS[profile.role] || ABAS.medico
  const [aba, setAba] = useState(() => (abas.some((a) => a.id === lerHash()) ? lerHash() : abas[0].id))

  useEffect(() => {
    const f = () => { const h = lerHash(); if (abas.some((a) => a.id === h)) setAba(h) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [abas])

  const ir = (id) => { window.location.hash = '/' + id; setAba(id); window.scrollTo({ top: 0 }) }
  const Atual = abas.find((a) => a.id === aba)?.C || abas[0].C

  return (
    <div className={'app' + (viewer ? ' viewer' : '')}>
      <header className="topbar">
        <div className="brand">
          <img src="/logo-mark-white.png" alt="" className="brand-mark" />
          <div className="brand-txt">
            <strong>{config.hospital}</strong>
            <span>{viewer ? 'Somente visualização' : profile.role === 'admin' ? 'Gestão · Checklist Médico' : 'Checklist Médico'}</span>
          </div>
        </div>
        {viewer ? (
          <button className="icon-btn icon-btn-light" onClick={onAtualizar} title="Atualizar dados" aria-label="Atualizar dados"><Icon name="refresh" /></button>
        ) : (
          <button className="avatar" onClick={() => ir('perfil')} title={profile.nome} aria-label="Meu perfil">
            {iniciaisNome(profile.nome)}
          </button>
        )}
      </header>

      <nav className="sidenav" aria-label="Navegação">
        <div className="sidenav-brand">
          <img src="/logo-full.png" alt="Phoenix Serviços Médicos" />
          <img src="/logo-camboriu.png" alt="Prefeitura de Camboriú" className="sidenav-pref" />
        </div>
        {abas.map((a) => (
          <button key={a.id} className={'nav-item' + (aba === a.id ? ' on' : '')} onClick={() => ir(a.id)}>
            <Icon name={a.icon} />{a.label}
          </button>
        ))}
        {viewer && (
          <div className="sidenav-viewer">
            <span><Icon name="eye" size={16} />Somente visualização</span>
            <small>{profile.nome}</small>
            <button className="btn btn-soft btn-block" onClick={onAtualizar}><Icon name="refresh" size={16} />Atualizar dados</button>
          </div>
        )}
        {DEMO && <div className="sidenav-demo">Modo demonstração</div>}
      </nav>

      <main className="content">
        {DEMO && <div className="demo-strip">Modo demonstração — dados salvos apenas neste navegador</div>}
        <div className="cobrand">
          <img src="/logo-full.png" alt="Phoenix Serviços Médicos" />
          <span className="cobrand-sep" />
          <img src="/logo-camboriu.png" alt="Prefeitura de Camboriú" />
        </div>
        {pronto ? <Atual ir={ir} /> : <Spinner />}
      </main>

      <nav className="bottomnav" aria-label="Navegação">
        {abas.filter((a) => !a.soDesktop).map((a) => (
          <button key={a.id} className={aba === a.id ? 'on' : ''} onClick={() => ir(a.id)}>
            <Icon name={a.icon} size={22} /><span>{a.label}</span>
          </button>
        ))}
      </nav>
      <Toasts itens={toasts} />
    </div>
  )
}
