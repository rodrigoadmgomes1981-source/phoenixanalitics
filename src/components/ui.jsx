import { useEffect } from 'react'
import Icon from './Icon'

export function Sheet({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'sheet' + (wide ? ' sheet-wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="x" /></button>
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function Confirm({ open, titulo, texto, onOk, onCancel, perigo, okLabel = 'Confirmar' }) {
  return (
    <Sheet open={open} onClose={onCancel} title={titulo}
      footer={<>
        <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
        <button className={'btn ' + (perigo ? 'btn-danger' : 'btn-primary')} onClick={onOk}>{okLabel}</button>
      </>}>
      <p className="muted">{texto}</p>
    </Sheet>
  )
}

export function Field({ label, obrigatorio, erro, children, hint }) {
  return (
    <label className={'field' + (erro ? ' has-error' : '')}>
      <span className="field-label">{label}{obrigatorio && <b className="req" aria-label="obrigatório">*</b>}</span>
      {children}
      {erro ? <span className="field-error">{erro}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Empty({ icon = 'file', titulo, texto, children }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={26} /></div>
      <strong>{titulo}</strong>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  )
}

export function Spinner({ label = 'Carregando…' }) {
  return <div className="spinner-wrap"><span className="spinner" aria-hidden="true" />{label}</div>
}

export function RiscoTag({ nome, cor, compact }) {
  if (!nome) return <span className="tag tag-muted">Sem risco</span>
  const curto = nome.split(/\s[–-]\s/)[0]
  return (
    <span className="risco-tag" style={{ '--c': cor || '#64748B' }} title={nome}>
      <i />{compact ? curto : nome}
    </span>
  )
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Toasts({ itens }) {
  return (
    <div className="toasts" aria-live="polite">
      {itens.map((t) => (
        <div key={t.id} className={'toast toast-' + t.tipo}>
          <Icon name={t.tipo === 'erro' ? 'alert' : 'check'} size={18} />{t.msg}
        </div>
      ))}
    </div>
  )
}
