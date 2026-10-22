import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './lib/api'
import { mergeConfig } from './lib/defaults'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ profile, onLogout, children }) {
  const [parametros, setParametros] = useState([])
  const [config, setConfig] = useState(mergeConfig())
  const [toasts, setToasts] = useState([])
  const [pronto, setPronto] = useState(false)

  const toast = useCallback((msg, tipo = 'ok') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, tipo }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  const recarregarParametros = useCallback(async () => setParametros(await api.listParametros()), [])
  const recarregarConfig = useCallback(async () => setConfig(await api.getConfig()), [])

  useEffect(() => {
    Promise.all([recarregarParametros(), recarregarConfig()])
      .catch((e) => toast(e.message, 'erro'))
      .finally(() => setPronto(true))
  }, [recarregarParametros, recarregarConfig, toast])

  const value = useMemo(() => {
    const ativos = (tipo) => parametros.filter((p) => p.tipo === tipo && p.ativo).sort((a, b) => a.ordem - b.ordem)
    const corRisco = (nome) => parametros.find((p) => p.tipo === 'risco' && p.nome === nome)?.cor
    return { profile, onLogout, parametros, ativos, corRisco, config, toast, toasts, recarregarParametros, recarregarConfig, pronto }
  }, [profile, onLogout, parametros, config, toast, toasts, recarregarParametros, recarregarConfig, pronto])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
