import { supabase, DEMO } from './supabase'
import { PARAMETROS_PADRAO, mergeConfig } from './defaults'
import { uid, hojeISO, addDias } from './utils'

/* =====================================================================
   Camada de dados única para o app.
   - Produção: Supabase (Auth + Postgres com RLS) + função /api/users na Vercel
   - Demonstração: localStorage (quando VITE_SUPABASE_* não estão definidas)
   ===================================================================== */

const CAMPOS_ATD = [
  'prontuario', 'iniciais', 'data_nascimento', 'data_atendimento', 'risco', 'setor',
  'especialidades', 'cid', 'exames_grupos', 'exames', 'medicacoes_classes', 'medicacoes', 'desfecho', 'observacoes',
]
const CAMPOS_LISTA = new Set(['especialidades', 'exames_grupos', 'medicacoes_classes'])

function limparAtendimento(a) {
  const o = {}
  for (const k of CAMPOS_ATD) {
    let v = a[k]
    if (CAMPOS_LISTA.has(k)) v = Array.isArray(v) ? v : []
    else if (typeof v === 'string') v = v.trim() || null
    else if (v === undefined || v === '') v = null
    o[k] = v
  }
  if (o.iniciais) o.iniciais = o.iniciais.toUpperCase()
  if (o.cid) o.cid = o.cid.toUpperCase()
  return o
}

/* ---------------------- Links de visualização ---------------------- */
export function novoToken() {
  const b = new Uint8Array(24)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const expiraEm = (dias) => (dias ? new Date(Date.now() + dias * 86400000).toISOString() : null)
const idadeEm = (nasc, ref) => {
  if (!nasc) return null
  const n = new Date(nasc + 'T12:00:00'), d = new Date(ref + 'T12:00:00')
  let x = d.getFullYear() - n.getFullYear()
  if (d.getMonth() < n.getMonth() || (d.getMonth() === n.getMonth() && d.getDate() < n.getDate())) x--
  return x
}
// Só os campos necessários para Painel e Analytics — sem prontuário, iniciais, nascimento ou observações
const anonimizar = (a) => ({
  id: a.id, data_atendimento: a.data_atendimento, risco: a.risco, setor: a.setor,
  especialidades: a.especialidades || [], exames_grupos: a.exames_grupos || [], medicacoes_classes: a.medicacoes_classes || [],
  cid: a.cid, desfecho: a.desfecho, idade: idadeEm(a.data_nascimento, a.data_atendimento),
  medico_id: a.medico_id, medico_nome: a.medico_nome, created_at: a.created_at,
})

/* ----------------------------- MODO DEMO ----------------------------- */
const DB_KEY = 'phoenix_checklist_demo_v4'
const SESSAO_KEY = 'phoenix_checklist_demo_sessao'

function seed() {
  const users = [
    { id: 'u-admin', nome: 'Coordenação Médica', email: 'admin@demo.com', senha: 'admin123', crm: '', role: 'admin', ativo: true },
    { id: 'u-med1', nome: 'Dra. Ana Ribeiro', email: 'medico@demo.com', senha: 'medico123', crm: 'CRM/SC 12345', role: 'medico', ativo: true },
    { id: 'u-med2', nome: 'Dr. Carlos Menezes', email: 'carlos@demo.com', senha: 'medico123', crm: 'CRM/SC 23456', role: 'medico', ativo: true },
    { id: 'u-med3', nome: 'Dr. Paulo Martins', email: 'paulo@demo.com', senha: 'medico123', crm: 'CRM/SC 34567', role: 'medico', ativo: true },
  ]
  const parametros = PARAMETROS_PADRAO.map((p) => ({ ...p, id: uid() }))
  const by = (t) => parametros.filter((p) => p.tipo === t).map((p) => p.nome)
  const riscos = by('risco'), setores = by('setor'), esp = by('especialidade'), desf = by('desfecho')
  const pesoRisco = [0.06, 0.16, 0.38, 0.32, 0.08]
  const pick = (arr, w) => {
    if (!w) return arr[Math.floor(Math.random() * arr.length)]
    let r = Math.random(), i = 0
    for (; i < w.length; i++) { r -= w[i]; if (r <= 0) break }
    return arr[Math.min(i, arr.length - 1)]
  }
  const letras = 'ABCDEFGHIJLMNOPRSTV'
  const cids = ['R10.4', 'J18.9', 'N39.0', 'I10', 'K35.8', 'S82.2', 'R51', 'A09', 'I20.0', 'N20.0', 'K80.2', 'O20.0']
  const examesG = by('exame'), medsC = by('medicacao')
  // sorteia de 1 a max itens (sem repetir), com probabilidade "chance" de ter ao menos um
  const sorteioVarios = (arr, max, chance) => {
    if (!arr.length || Math.random() > chance) return []
    const n = 1 + Math.floor(Math.random() * max)
    const pool = arr.slice(), out = []
    for (let i = 0; i < n && pool.length; i++) {
      const j = Math.floor(Math.pow(Math.random(), 1.8) * pool.length)
      out.push(pool.splice(j, 1)[0])
    }
    return arr.filter((x) => out.includes(x))
  }
  const atendimentos = []
  const hoje = hojeISO()
  const agora = Date.now()
  const DIAS = 120
  // Fator por dia da semana (dom..sáb) e leve tendência de alta para o histórico parecer real
  const fatorSemana = [1.25, 0.95, 0.9, 0.9, 0.95, 1.1, 1.3]
  for (let d = DIAS - 1; d >= 0; d--) {
    const dia = addDias(hoje, -d)
    const dow = new Date(dia + 'T12:00:00').getDay()
    const tendencia = 0.8 + 0.35 * ((DIAS - d) / DIAS)
    const n = d === 0 ? 7 : Math.max(2, Math.round((7 + Math.random() * 6) * fatorSemana[dow] * tendencia))
    for (let i = 0; i < n; i++) {
      const med = users[1 + (d === 0 ? i % 2 : Math.floor(Math.random() * 3))]
      const idade = Math.random() < 0.08 ? 12 + Math.floor(Math.random() * 6) : 18 + Math.floor(Math.random() * 72)
      const ano = new Date().getFullYear() - idade
      const risco = pick(riscos, pesoRisco)
      const grave = riscos.indexOf(risco) <= 1
      const temEsp = Math.random() < (grave ? 0.6 : 0.25)
      const setor = grave ? pick(setores, [0.4, 0.6]) : pick(setores, [0.8, 0.2])
      const desfecho = grave ? pick(desf, [0.02, 0.01, 0.27, 0.2, 0.5]) : pick(desf, [0.06, 0.04, 0.72, 0.05, 0.13])
      const criado = d === 0
        ? new Date(agora - (n - i) * 35 * 60000)
        : new Date(`${dia}T${String(7 + Math.floor((i / n) * 15)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`)
      atendimentos.push({
        id: uid(),
        prontuario: String(100000 + Math.floor(Math.random() * 899999)),
        iniciais: pick(letras.split('')) + '.' + pick(letras.split('')) + '.' + pick(letras.split('')) + '.',
        data_nascimento: `${ano}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')}`,
        data_atendimento: dia,
        risco,
        setor,
        especialidades: temEsp ? [pick(esp, [0.08, 0.2, 0.1, 0.07, 0.22, 0.12, 0.15, 0.06])] : [],
        cid: pick(cids),
        exames_grupos: sorteioVarios(examesG, grave ? 3 : 2, grave ? 0.97 : 0.85),
        exames: null,
        medicacoes_classes: sorteioVarios(medsC.slice(0, grave ? 26 : 12), grave ? 4 : 2, 0.92),
        medicacoes: null,
        desfecho: d === 0 && i > 3 ? null : (d < 3 && Math.random() < 0.06 ? null : desfecho),
        observacoes: null,
        medico_id: med.id,
        medico_nome: med.nome,
        created_at: criado.toISOString(),
        updated_at: null,
      })
    }
  }
  return { users, parametros, config: mergeConfig(), atendimentos }
}

function lerDB() {
  try {
    const s = localStorage.getItem(DB_KEY)
    if (s) return JSON.parse(s)
  } catch { /* ignora */ }
  const db = seed()
  salvarDB(db)
  return db
}
function salvarDB(db) {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)) } catch { /* ignora */ }
}
const semSenha = (u) => { const c = { ...u }; delete c.senha; return c }
const espera = (v) => new Promise((r) => setTimeout(() => r(v), 120))

const demo = {
  async currentProfile() {
    const id = (() => { try { return localStorage.getItem(SESSAO_KEY) } catch { return null } })()
    if (!id) return null
    const u = lerDB().users.find((x) => x.id === id && x.ativo)
    return u ? semSenha(u) : null
  },
  async signIn(email, senha) {
    const u = lerDB().users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || u.senha !== senha) throw new Error('E-mail ou senha inválidos.')
    if (!u.ativo) throw new Error('Usuário inativo. Procure a coordenação.')
    try { localStorage.setItem(SESSAO_KEY, u.id) } catch { /* ignora */ }
    return semSenha(u)
  },
  async signOut() { try { localStorage.removeItem(SESSAO_KEY) } catch { /* ignora */ } },
  async alterarSenha(nova) {
    const db = lerDB(); const p = await demo.currentProfile()
    const u = db.users.find((x) => x.id === p.id); u.senha = nova; salvarDB(db)
  },

  async listParametros() { return espera(lerDB().parametros.slice().sort((a, b) => a.ordem - b.ordem)) },
  async saveParametro(p) {
    const db = lerDB()
    if (p.id) Object.assign(db.parametros.find((x) => x.id === p.id), p)
    else {
      const max = Math.max(-1, ...db.parametros.filter((x) => x.tipo === p.tipo).map((x) => x.ordem))
      db.parametros.push({ ativo: true, ...p, id: uid(), ordem: max + 1 })
    }
    salvarDB(db)
  },
  async reordenarParametros(ids) {
    const db = lerDB()
    ids.forEach((id, i) => { const p = db.parametros.find((x) => x.id === id); if (p) p.ordem = i })
    salvarDB(db)
  },
  async deleteParametro(id) {
    const db = lerDB(); db.parametros = db.parametros.filter((x) => x.id !== id); salvarDB(db)
  },

  async getConfig() { return mergeConfig(lerDB().config) },
  async saveConfig(c) { const db = lerDB(); db.config = c; salvarDB(db) },

  async listAtendimentos({ de, ate, medicoId } = {}) {
    const p = await demo.currentProfile()
    let l = lerDB().atendimentos
    if (p.role !== 'admin') l = l.filter((a) => a.medico_id === p.id)
    if (medicoId) l = l.filter((a) => a.medico_id === medicoId)
    if (de) l = l.filter((a) => a.data_atendimento >= de)
    if (ate) l = l.filter((a) => a.data_atendimento <= ate)
    return espera(l.slice().sort((a, b) => (b.data_atendimento + b.created_at).localeCompare(a.data_atendimento + a.created_at)))
  },
  async saveAtendimento(a) {
    const db = lerDB(); const p = await demo.currentProfile(); const dados = limparAtendimento(a)
    if (a.id) {
      const x = db.atendimentos.find((y) => y.id === a.id)
      if (p.role !== 'admin' && x.medico_id !== p.id) throw new Error('Sem permissão.')
      Object.assign(x, dados, { updated_at: new Date().toISOString() })
    } else {
      db.atendimentos.push({ ...dados, id: uid(), medico_id: p.id, medico_nome: p.nome, created_at: new Date().toISOString(), updated_at: null })
    }
    salvarDB(db)
  },
  async deleteAtendimento(id) {
    const db = lerDB(); db.atendimentos = db.atendimentos.filter((x) => x.id !== id); salvarDB(db)
  },

  async listUsuarios() { return espera(lerDB().users.map(semSenha).sort((a, b) => a.nome.localeCompare(b.nome))) },
  async createUsuario({ nome, email, senha, crm, role }) {
    const db = lerDB()
    if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('Já existe um usuário com este e-mail.')
    db.users.push({ id: uid(), nome, email, senha, crm, role, ativo: true }); salvarDB(db)
  },
  async updateUsuario(id, patch) {
    const db = lerDB(); Object.assign(db.users.find((u) => u.id === id), patch); salvarDB(db)
  },
  async resetSenha(id, senha) { return demo.updateUsuario(id, { senha }) },
  async resetDemo() { try { localStorage.removeItem(DB_KEY); localStorage.removeItem(SESSAO_KEY) } catch { /* ignora */ } },

  async listLinks() { return espera((lerDB().links || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))) },
  async createLink({ nome, dias }) {
    const db = lerDB(); db.links = db.links || []
    const l = { id: uid(), token: novoToken(), nome, ativo: true, expires_at: expiraEm(dias), created_at: new Date().toISOString(), ultimo_acesso: null }
    db.links.push(l); salvarDB(db); return l
  },
  async updateLink(id, patch) { const db = lerDB(); Object.assign(db.links.find((l) => l.id === id), patch); salvarDB(db) },
  async deleteLink(id) { const db = lerDB(); db.links = db.links.filter((l) => l.id !== id); salvarDB(db) },
  async viewDados(token, de, ate) {
    const db = lerDB()
    const l = (db.links || []).find((x) => x.token === token && x.ativo && (!x.expires_at || x.expires_at > new Date().toISOString()))
    if (!l) throw new Error('link_invalido')
    l.ultimo_acesso = new Date().toISOString(); salvarDB(db)
    return {
      link: { nome: l.nome, expires_at: l.expires_at },
      config: db.config, parametros: db.parametros,
      medicos: db.users.filter((u) => u.role === 'medico' && u.ativo).map(({ id, nome, role, ativo }) => ({ id, nome, role, ativo })),
      atendimentos: db.atendimentos.filter((a) => a.data_atendimento >= de && a.data_atendimento <= ate).map(anonimizar),
    }
  },
}

/* ------------------------------ SUPABASE ------------------------------ */
function traduzErro(e) {
  const m = e?.message || String(e)
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha inválidos.'
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado.'
  if (/row-level security/i.test(m)) return 'Sem permissão para esta ação.'
  if (/duplicate key/i.test(m)) return 'Registro duplicado.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.'
  return m
}
const ok = ({ data, error }) => { if (error) throw new Error(traduzErro(error)); return data }

async function chamarApiUsuarios(method, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch('/api/users', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Falha na operação.')
  return j
}

const sb = {
  async currentProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null
    const p = ok(await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle())
    if (!p || !p.ativo) { await supabase.auth.signOut(); return null }
    return p
  },
  async signIn(email, senha) {
    ok(await supabase.auth.signInWithPassword({ email: email.trim(), password: senha }))
    const p = await sb.currentProfile()
    if (!p) throw new Error('Usuário sem perfil ativo. Procure a coordenação.')
    return p
  },
  async signOut() { await supabase.auth.signOut() },
  async alterarSenha(nova) { ok(await supabase.auth.updateUser({ password: nova })) },

  async listParametros() { return ok(await supabase.from('parametros').select('*').order('tipo').order('ordem')) },
  async saveParametro(p) {
    if (p.id) {
      const { id, ...resto } = p
      ok(await supabase.from('parametros').update(resto).eq('id', id))
    } else {
      const atuais = ok(await supabase.from('parametros').select('ordem').eq('tipo', p.tipo).order('ordem', { ascending: false }).limit(1))
      ok(await supabase.from('parametros').insert({ ativo: true, ...p, ordem: (atuais[0]?.ordem ?? -1) + 1 }))
    }
  },
  async reordenarParametros(ids) {
    await Promise.all(ids.map((id, i) => supabase.from('parametros').update({ ordem: i }).eq('id', id)))
  },
  async deleteParametro(id) { ok(await supabase.from('parametros').delete().eq('id', id)) },

  async getConfig() {
    const r = ok(await supabase.from('config').select('dados').eq('id', 1).maybeSingle())
    return mergeConfig(r?.dados)
  },
  async saveConfig(c) { ok(await supabase.from('config').upsert({ id: 1, dados: c })) },

  async listAtendimentos({ de, ate, medicoId } = {}) {
    let q = supabase.from('atendimentos').select('*')
    if (de) q = q.gte('data_atendimento', de)
    if (ate) q = q.lte('data_atendimento', ate)
    if (medicoId) q = q.eq('medico_id', medicoId)
    q = q.order('data_atendimento', { ascending: false }).order('created_at', { ascending: false }).limit(5000)
    return ok(await q)
  },
  async saveAtendimento(a) {
    const dados = limparAtendimento(a)
    if (a.id) ok(await supabase.from('atendimentos').update({ ...dados, updated_at: new Date().toISOString() }).eq('id', a.id))
    else {
      const p = await sb.currentProfile()
      ok(await supabase.from('atendimentos').insert({ ...dados, medico_id: p.id, medico_nome: p.nome }))
    }
  },
  async deleteAtendimento(id) { ok(await supabase.from('atendimentos').delete().eq('id', id)) },

  async listUsuarios() { return ok(await supabase.from('profiles').select('*').order('nome')) },
  async createUsuario(dados) { return chamarApiUsuarios('POST', dados) },
  async updateUsuario(id, patch) { ok(await supabase.from('profiles').update(patch).eq('id', id)) },
  async resetSenha(id, senha) { return chamarApiUsuarios('PATCH', { id, senha }) },
  async resetDemo() {},

  async listLinks() { return ok(await supabase.from('view_links').select('*').order('created_at', { ascending: false })) },
  async createLink({ nome, dias }) {
    return ok(await supabase.from('view_links').insert({ nome, token: novoToken(), expires_at: expiraEm(dias) }).select().single())
  },
  async updateLink(id, patch) { ok(await supabase.from('view_links').update(patch).eq('id', id)) },
  async deleteLink(id) { ok(await supabase.from('view_links').delete().eq('id', id)) },
  async viewDados(token, de, ate) {
    const { data, error } = await supabase.rpc('view_dados', { p_token: token, p_de: de, p_ate: ate })
    if (error) throw new Error(/link_invalido/.test(error.message) ? 'link_invalido' : traduzErro(error))
    return data
  },
}

const base = DEMO ? demo : sb
let impl = base

/** Modo somente leitura acessado por link: expõe apenas o necessário para Painel e Analytics. */
function criarVisualizador(token) {
  const cache = new Map()
  let meta = null
  const buscar = (de, ate) => {
    const k = de + '|' + ate
    if (!cache.has(k)) cache.set(k, base.viewDados(token, de, ate).catch((e) => { cache.delete(k); throw e }))
    return cache.get(k)
  }
  const negar = async () => { throw new Error('Somente visualização.') }
  return {
    async init() { meta = await buscar(hojeISO(), hojeISO()); return meta.link },
    limparCache() { cache.clear() },
    async currentProfile() { return null },
    async listParametros() { return (meta?.parametros || []).slice().sort((a, b) => a.ordem - b.ordem) },
    async getConfig() { return mergeConfig(meta?.config) },
    async listAtendimentos({ de, ate } = {}) {
      const a = ate || hojeISO()
      const d = de || addDias(a, -365)
      const r = await buscar(d, a)
      return r.atendimentos.slice().sort((x, y) => (y.data_atendimento + y.created_at).localeCompare(x.data_atendimento + x.created_at))
    },
    async listUsuarios() { return meta?.medicos || [] },
    saveAtendimento: negar, deleteAtendimento: negar, saveParametro: negar, saveConfig: negar,
    createUsuario: negar, updateUsuario: negar, listLinks: negar, createLink: negar,
  }
}

export function usarVisualizacao(token) {
  impl = criarVisualizador(token)
  return impl
}

// Proxy: as telas importam "api" normalmente; no link de visualização a implementação é trocada.
export const api = new Proxy({}, { get: (_, k) => impl[k] })
export { DEMO }
