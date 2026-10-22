import { fmtData } from '../lib/utils'

/** Barras horizontais com rótulo e valor em texto (uma série; cor = identidade da categoria quando houver). */
export function BarList({ itens, total, vazio = 'Sem dados no período' }) {
  const max = Math.max(1, ...itens.map((i) => i.valor))
  if (!itens.some((i) => i.valor)) return <p className="muted small">{vazio}</p>
  return (
    <ul className="barlist">
      {itens.map((i) => {
        const pct = total ? Math.round((i.valor / total) * 100) : null
        return (
          <li key={i.nome} title={`${i.nome}: ${i.valor}${pct != null ? ` (${pct}%)` : ''}`}>
            <div className="bl-row">
              <span className="bl-name">{i.cor && <i style={{ background: i.cor }} />}{i.nome}</span>
              <span className="bl-val">{i.valor.toLocaleString('pt-BR')}{pct != null && <em>{pct}%</em>}</span>
            </div>
            <div className="bl-track"><div className="bl-bar" style={{ width: `${(i.valor / max) * 100}%`, background: i.cor || 'var(--teal)' }} /></div>
          </li>
        )
      })}
    </ul>
  )
}

/** Volume diário em colunas, com tooltip nativo por coluna e rótulos esparsos no eixo. */
export function Colunas({ dias }) {
  const max = Math.max(1, ...dias.map((d) => d.valor))
  const passo = Math.ceil(dias.length / 7)
  return (
    <div className="cols" role="img" aria-label="Atendimentos por dia">
      <div className="cols-plot">
        {dias.map((d) => (
          <div key={d.dia} className="col" title={`${fmtData(d.dia)}: ${d.valor} atendimento(s)`}>
            {dias.length <= 14 && d.valor > 0 && <span className="col-val">{d.valor}</span>}
            <div className="col-bar" style={{ height: `${(d.valor / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="cols-axis">
        {dias.map((d, i) => (
          <span key={d.dia}>{i % passo === 0 || i === dias.length - 1 ? fmtData(d.dia, { day: '2-digit', month: '2-digit' }) : ''}</span>
        ))}
      </div>
    </div>
  )
}
