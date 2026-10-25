import { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../context'
import { api, DEMO } from '../../lib/api'
import { fmtData, fmtHora } from '../../lib/utils'
import Icon from '../../components/Icon'
import { Confirm, Field, Sheet, Spinner, Segmented } from '../../components/ui'

const VALIDADES = [
  { value: '7', label: '7 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '0', label: 'Sem validade' },
]

export const urlDoLink = (token) => `${window.location.origin}/v/${token}`

function status(l) {
  if (!l.ativo) return { txt: 'Revogado', cls: 'tag-muted' }
  if (l.expires_at && l.expires_at < new Date().toISOString()) return { txt: 'Expirado', cls: 'tag-warn' }
  return { txt: 'Ativo', cls: 'tag-teal' }
}

export default function LinksPage() {
  return (
    <div className="page">
      <h1 className="page-title">Compartilhar painel</h1>
      <Links />
    </div>
  )
}

export function Links() {
  const { toast } = useApp()
  const [lista, setLista] = useState(null)
  const [novo, setNovo] = useState(null)
  const [criado, setCriado] = useState(null)
  const [excluir, setExcluir] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try { setLista(await api.listLinks()) } catch (e) { toast(e.message, 'erro'); setLista([]) }
  }, [toast])
  useEffect(() => { carregar() }, [carregar])

  async function copiar(l) {
    const url = urlDoLink(l.token)
    try { await navigator.clipboard.writeText(url); toast('Link copiado.') } catch { window.prompt('Copie o link:', url) }
  }
  async function compartilhar(l) {
    const url = urlDoLink(l.token)
    if (navigator.share) {
      try { await navigator.share({ title: 'Painel · Checklist Médico', text: `Painel de monitoramento — ${l.nome}`, url }) } catch { /* cancelado */ }
    } else copiar(l)
  }
  async function criar() {
    if (!novo.nome.trim()) return toast('Dê um nome ao link (ex.: Secretaria de Saúde).', 'erro')
    setSalvando(true)
    try {
      const l = await api.createLink({ nome: novo.nome.trim(), dias: Number(novo.dias) || null })
      setNovo(null); setCriado(l); carregar()
    } catch (e) { toast(e.message, 'erro') } finally { setSalvando(false) }
  }
  const alternar = async (l) => {
    try { await api.updateLink(l.id, { ativo: !l.ativo }); toast(l.ativo ? 'Link revogado.' : 'Link reativado.'); carregar() } catch (e) { toast(e.message, 'erro') }
  }

  return (
    <div className="stack">
      <div className="card links-intro">
        <div>
          <h2 className="card-title"><Icon name="eye" size={18} />Links de visualização</h2>
          <p className="muted small">Quem recebe o link vê apenas o <strong>Painel</strong> e o <strong>Analytics</strong>, sem login e sem poder alterar nada. Prontuário, iniciais, data de nascimento e observações não são exibidos.</p>
          {DEMO && <p className="small warn-txt mt-s">No modo demonstração o link só abre neste mesmo navegador.</p>}
        </div>
        <button className="btn btn-primary" onClick={() => setNovo({ nome: '', dias: '30' })}><Icon name="plus" size={18} />Novo link</button>
      </div>

      {!lista ? <Spinner /> : lista.length === 0 ? (
        <p className="muted small">Nenhum link criado ainda.</p>
      ) : (
        <ul className="link-list">
          {lista.map((l) => {
            const st = status(l)
            const ok = st.txt === 'Ativo'
            return (
              <li key={l.id} className={'card link-item' + (ok ? '' : ' link-off')}>
                <div className="link-top">
                  <strong>{l.nome}</strong>
                  <span className={'tag ' + st.cls}>{st.txt}</span>
                </div>
                <code className="link-url">{urlDoLink(l.token)}</code>
                <p className="muted small">
                  Criado em {fmtData(l.created_at)} · {l.expires_at ? `válido até ${fmtData(l.expires_at)}` : 'sem validade'}
                  {' · '}{l.ultimo_acesso ? `último acesso ${fmtData(l.ultimo_acesso)} ${fmtHora(l.ultimo_acesso)}` : 'nunca acessado'}
                </p>
                <div className="link-acts">
                  <button className="btn btn-soft" disabled={!ok} onClick={() => copiar(l)}><Icon name="copy" size={16} />Copiar</button>
                  <button className="btn btn-ghost" disabled={!ok} onClick={() => compartilhar(l)}><Icon name="share" size={16} />Enviar</button>
                  <a className={'btn btn-ghost' + (ok ? '' : ' disabled')} href={ok ? urlDoLink(l.token) : undefined} target="_blank" rel="noreferrer"><Icon name="eye" size={16} />Abrir</a>
                  <span className="grow" />
                  <button className="btn btn-link" onClick={() => alternar(l)}>{l.ativo ? 'Revogar' : 'Reativar'}</button>
                  <button className="icon-btn sm" onClick={() => setExcluir(l)} aria-label="Excluir link"><Icon name="trash" size={16} /></button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={!!novo} onClose={() => setNovo(null)} title="Novo link de visualização"
        footer={<><button className="btn btn-ghost" onClick={() => setNovo(null)}>Cancelar</button><button className="btn btn-primary btn-grow" disabled={salvando} onClick={criar}>{salvando ? 'Criando…' : 'Criar link'}</button></>}>
        {novo && (
          <div className="stack">
            <Field label="Para quem é o link?" obrigatorio hint="Só para você identificar. Ex.: Secretaria de Saúde, Diretoria do hospital, TV da sala">
              <input autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex.: Secretaria Municipal de Saúde" />
            </Field>
            <Field label="Validade">
              <Segmented value={novo.dias} onChange={(dias) => setNovo({ ...novo, dias })} options={VALIDADES} />
            </Field>
            <p className="muted small">Você pode revogar o link a qualquer momento, e ele para de funcionar na hora.</p>
          </div>
        )}
      </Sheet>

      <Sheet open={!!criado} onClose={() => setCriado(null)} title="Link criado"
        footer={<><button className="btn btn-ghost" onClick={() => copiar(criado)}><Icon name="copy" size={16} />Copiar</button><button className="btn btn-primary btn-grow" onClick={() => compartilhar(criado)}><Icon name="share" size={16} />Enviar</button></>}>
        {criado && (
          <div className="stack">
            <p>Envie este endereço para <strong>{criado.nome}</strong>:</p>
            <code className="link-url link-url-lg">{urlDoLink(criado.token)}</code>
            <p className="muted small">{criado.expires_at ? `Válido até ${fmtData(criado.expires_at)}.` : 'Sem data de validade.'} Qualquer pessoa com o link consegue ver o painel, então envie só para quem deve ter acesso.</p>
          </div>
        )}
      </Sheet>

      <Confirm open={!!excluir} titulo="Excluir link?" perigo okLabel="Excluir"
        texto={`O link “${excluir?.nome}” deixará de funcionar imediatamente.`}
        onOk={async () => { try { await api.deleteLink(excluir.id); toast('Link excluído.'); carregar() } catch (e) { toast(e.message, 'erro') } setExcluir(null) }}
        onCancel={() => setExcluir(null)} />
    </div>
  )
}
