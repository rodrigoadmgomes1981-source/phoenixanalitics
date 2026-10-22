import { useEffect, useRef, useState } from 'react'
import { fmtData } from '../lib/utils'

function useLargura() {
  const ref = useRef(null)
  const [w, setW] = useState(300)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const fmtN = (v, d = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 }))

function ticks(max) {
  const passo = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : max <= 60 ? 10 : 20
  const top = Math.ceil(max / passo) * passo || passo
  const out = []
  for (let v = 0; v <= top; v += passo) out.push(v)
  return { top, out }
}

/** Linha diária + média móvel 7 dias, com crosshair e tooltip. */
export function LinhaTendencia({ dados }) {
  const [ref, W] = useLargura()
  const [hover, setHover] = useState(null)
  const H = 210, m = { t: 12, r: 12, b: 26, l: 34 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const { top, out } = ticks(Math.max(1, ...dados.map((d) => d.y)))
  const x = (i) => m.l + (dados.length <= 1 ? iw / 2 : (i / (dados.length - 1)) * iw)
  const y = (v) => m.t + ih - (v / top) * ih
  const path = (k) => dados.map((d, i) => (d[k] == null ? null : `${x(i)},${y(d[k])}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join('')
  const passoLbl = Math.ceil(dados.length / Math.max(2, Math.floor(iw / 70)))

  function mover(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
    const i = Math.round(((px - m.l) / iw) * (dados.length - 1))
    setHover(Math.max(0, Math.min(dados.length - 1, i)))
  }
  const h = hover != null ? dados[hover] : null

  return (
    <div ref={ref} className="chart-box">
      <div className="legend">
        <span><i className="lg-line" />Atendimentos/dia</span>
        <span><i className="lg-dash" />Média móvel 7 dias</span>
      </div>
      <svg width={W} height={H} onMouseMove={mover} onTouchMove={mover} onMouseLeave={() => setHover(null)} role="img" aria-label="Tendência de atendimentos por dia">
        {out.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={m.l - 8} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
          </g>
        ))}
        {dados.map((d, i) => (i % passoLbl === 0 ? (
          <text key={d.x} x={x(i)} y={H - 6} className="axis" textAnchor="middle">{fmtData(d.x, { day: '2-digit', month: '2-digit' })}</text>
        ) : null))}
        <path d={path('y')} className="ln-main" />
        <path d={path('mm')} className="ln-avg" />
        {h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={m.t} y2={m.t + ih} className="crosshair" />
            <circle cx={x(hover)} cy={y(h.y)} r="4.5" className="pt-main" />
            {h.mm != null && <circle cx={x(hover)} cy={y(h.mm)} r="4" className="pt-avg" />}
          </g>
        )}
      </svg>
      {h && (
        <div className="tip" style={{ left: Math.min(Math.max(x(hover), 70), W - 70) }}>
          <strong>{fmtData(h.x, { weekday: 'short', day: '2-digit', month: '2-digit' })}</strong>
          <span>{h.y} atendimento(s)</span>
          {h.mm != null && <span className="muted">Média 7d: {fmtN(h.mm)}</span>}
        </div>
      )}
    </div>
  )
}

/** Colunas 100% empilhadas: mix de risco por semana. */
export function MixRisco({ semanas, riscos }) {
  const [hover, setHover] = useState(null)
  const h = hover != null ? semanas[hover] : null
  return (
    <div className="chart-box">
      <div className="legend">{riscos.map((r) => <span key={r.nome}><i style={{ background: r.cor }} />{r.nome.split(/\s[–-]\s/)[0]}</span>)}</div>
      <div className="mix" onMouseLeave={() => setHover(null)}>
        {semanas.map((s, i) => (
          <button key={s.semana} className={'mix-col' + (hover === i ? ' on' : '')} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => setHover(i)}
            aria-label={`Semana de ${fmtData(s.semana)}`}>
            <div className="mix-stack">
              {s.partes.filter((p) => p.valor).map((p) => <div key={p.nome} style={{ flex: p.valor, background: p.cor }} />)}
            </div>
            <span className="mix-lbl">{fmtData(s.semana, { day: '2-digit', month: '2-digit' })}</span>
          </button>
        ))}
      </div>
      <div className="mix-tip">
        {h ? (
          <>
            <strong>Semana de {fmtData(h.semana)} · {h.total} atend.</strong>
            <div className="mix-tip-row">
              {h.partes.map((p) => <span key={p.nome}><i style={{ background: p.cor }} />{p.nome.split(/\s[–-]\s/)[0]} {h.total ? Math.round((p.valor / h.total) * 100) : 0}%</span>)}
            </div>
          </>
        ) : <span className="muted small">Toque ou passe o mouse sobre uma semana para ver a composição.</span>}
      </div>
    </div>
  )
}

/** Matriz (heatmap sequencial em teal) com % na linha. */
export function Matriz({ linhas, colunas, rotuloLinha }) {
  const max = Math.max(1, ...linhas.flatMap((l) => l.celulas.map((c) => (l.total ? c.valor / l.total : 0))))
  return (
    <div className="table-wrap matriz-wrap">
      <table className="matriz">
        <thead><tr><th>{rotuloLinha}</th>{colunas.map((c) => <th key={c.nome}>{c.nome}</th>)}<th>Total</th></tr></thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.nome}>
              <th>{l.cor && <i style={{ background: l.cor }} />}{l.nome.split(/\s[–-]\s/)[0]}</th>
              {l.celulas.map((c) => {
                const p = l.total ? c.valor / l.total : 0
                const forte = p / max > 0.55
                return (
                  <td key={c.nome} title={`${l.nome} → ${c.nome}: ${c.valor} (${Math.round(p * 100)}%)`}
                    style={{ background: `color-mix(in srgb, var(--teal) ${Math.round((p / max) * 85)}%, #fff)`, color: forte ? '#fff' : 'var(--ink)' }}>
                    {c.valor ? `${Math.round(p * 100)}%` : '–'}
                  </td>
                )
              })}
              <td className="mt-total">{l.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Delta({ atual, anterior, tipo = 'pct', bomQuandoSobe = null }) {
  if (atual == null || anterior == null || (tipo === 'rel' && !anterior)) return <span className="delta delta-neutro">sem base</span>
  const diff = tipo === 'rel' ? (atual - anterior) / anterior : atual - anterior
  const txt = tipo === 'rel' ? `${Math.abs(diff * 100).toFixed(0)}%` : tipo === 'pp' ? `${Math.abs(diff * 100).toFixed(1).replace('.', ',')} p.p.` : fmtN(Math.abs(diff))
  const neutro = Math.abs(diff) < (tipo === 'rel' ? 0.02 : tipo === 'pp' ? 0.005 : 0.05)
  const sobe = diff > 0
  const cls = neutro || bomQuandoSobe == null ? 'delta-neutro' : sobe === bomQuandoSobe ? 'delta-bom' : 'delta-ruim'
  return <span className={'delta ' + cls}>{neutro ? '≈ estável' : `${sobe ? '▲' : '▼'} ${txt}`}</span>
}
