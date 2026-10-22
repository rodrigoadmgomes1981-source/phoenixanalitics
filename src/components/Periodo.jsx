import { addDias, hojeISO } from '../lib/utils'

export function intervalo(p) {
  const h = hojeISO()
  if (p.tipo === 'hoje') return { de: h, ate: h }
  if (p.tipo === '7') return { de: addDias(h, -6), ate: h }
  if (p.tipo === '30') return { de: addDias(h, -29), ate: h }
  if (p.tipo === 'mes') return { de: h.slice(0, 8) + '01', ate: h }
  return { de: p.de || addDias(h, -6), ate: p.ate || h }
}

export default function Periodo({ value, onChange }) {
  const ops = [['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['mes', 'Mês'], ['custom', 'Período']]
  const iv = intervalo(value)
  return (
    <div className="periodo">
      <div className="chips chips-scroll">
        {ops.map(([v, l]) => (
          <button key={v} className={'chip' + (value.tipo === v ? ' on' : '')}
            onClick={() => onChange(v === 'custom' ? { tipo: v, ...iv } : { tipo: v })}>{l}</button>
        ))}
      </div>
      {value.tipo === 'custom' && (
        <div className="grid-2 periodo-datas">
          <label className="field"><span className="field-label">De</span>
            <input type="date" value={value.de} max={value.ate} onChange={(e) => onChange({ ...value, de: e.target.value })} /></label>
          <label className="field"><span className="field-label">Até</span>
            <input type="date" value={value.ate} min={value.de} max={hojeISO()} onChange={(e) => onChange({ ...value, ate: e.target.value })} /></label>
        </div>
      )}
    </div>
  )
}
