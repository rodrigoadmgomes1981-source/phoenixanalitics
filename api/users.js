/* global process */
// Função serverless (Vercel) para o administrador criar usuários e redefinir senhas.
// Usa a SERVICE ROLE KEY do Supabase, que nunca é exposta ao navegador.
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !service) return res.status(500).json({ error: 'Servidor sem SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY configuradas.' })
  if (!['POST', 'PATCH'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' })

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1) Quem está chamando precisa ser administrador ativo
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const { data: u, error: eu } = await admin.auth.getUser(token)
  if (eu || !u?.user) return res.status(401).json({ error: 'Sessão inválida. Entre novamente.' })
  const { data: quem } = await admin.from('profiles').select('role, ativo').eq('id', u.user.id).single()
  if (!quem || quem.role !== 'admin' || !quem.ativo) return res.status(403).json({ error: 'Apenas administradores.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}

  try {
    if (req.method === 'POST') {
      const nome = String(body.nome || '').trim()
      const email = String(body.email || '').trim().toLowerCase()
      const senha = String(body.senha || '')
      const role = body.role === 'admin' ? 'admin' : 'medico'
      if (!nome || !email || senha.length < 6) return res.status(400).json({ error: 'Nome, e-mail e senha (mín. 6) são obrigatórios.' })

      const { data, error } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      })
      if (error) {
        const msg = /already been registered|already exists/i.test(error.message) ? 'Já existe um usuário com este e-mail.' : error.message
        return res.status(400).json({ error: msg })
      }
      const { error: ep } = await admin.from('profiles').upsert({
        id: data.user.id, nome, email, crm: body.crm || null, role, ativo: true,
      })
      if (ep) return res.status(400).json({ error: ep.message })
      return res.status(200).json({ id: data.user.id })
    }

    // PATCH: redefinir senha
    const { id, senha } = body
    if (!id || String(senha || '').length < 6) return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres.' })
    const { error } = await admin.auth.admin.updateUserById(id, { password: senha })
    if (error) return res.status(400).json({ error: error.message })
    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erro inesperado.' })
  }
}
