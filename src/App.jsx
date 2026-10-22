import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import { supabase } from './lib/supabase'
import { AppProvider } from './context'
import Login from './pages/Login'
import Shell from './components/Shell'
import { Spinner } from './components/ui'

export default function App() {
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
