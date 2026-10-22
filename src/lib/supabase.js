import { createClient } from '@supabase/supabase-js'

const env = import.meta.env
const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null

// Sem variáveis de ambiente o sistema roda em MODO DEMONSTRAÇÃO (dados no navegador).
export const DEMO = !supabase
