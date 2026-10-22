import { fmtData, fmtHora } from './utils'

const COLUNAS = [
  ['Prontuário', (a) => a.prontuario],
  ['Iniciais do paciente', (a) => a.iniciais],
  ['Data de nascimento', (a) => fmtDataOuVazio(a.data_nascimento)],
  ['Data do atendimento', (a) => fmtDataOuVazio(a.data_atendimento)],
  ['Classificação de risco', (a) => a.risco],
  ['Setor', (a) => a.setor],
  ['Apoio de especialista', (a) => (a.especialidades || []).join('; ')],
  ['CID do paciente', (a) => a.cid],
  ['Exames solicitados', (a) => (a.exames_grupos || []).join('; ')],
  ['Medicações (classes)', (a) => (a.medicacoes_classes || []).join('; ')],
  ['Desfecho', (a) => a.desfecho],
  ['Observações', (a) => a.observacoes],
  ['Médico', (a) => a.medico_nome],
  ['Registrado em', (a) => `${fmtData(a.created_at)} ${fmtHora(a.created_at)}`],
]
const fmtDataOuVazio = (v) => (v ? fmtData(v) : '')

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportarCSV(lista, nome) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const linhas = [COLUNAS.map((c) => c[0]).join(';'), ...lista.map((a) => COLUNAS.map((c) => esc(c[1](a))).join(';'))]
  baixar(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }), nome + '.csv')
}

export async function exportarXLSX(lista, nome, titulo) {
  const XLSX = await import('xlsx-js-style')
  const navy = '043159', teal = '0E8383'
  const borda = { style: 'thin', color: { rgb: 'D5DEE8' } }
  const b = { top: borda, bottom: borda, left: borda, right: borda }
  const aoa = [[titulo], COLUNAS.map((c) => c[0]), ...lista.map((a) => COLUNAS.map((c) => c[1](a) ?? ''))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUNAS.length - 1 } }]
  ws['!cols'] = COLUNAS.map(([h]) => ({ wch: Math.max(14, h.length + 2) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: aoa.length - 1, c: COLUNAS.length - 1 } }) }
  ws['A1'].s = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: navy } }, alignment: { horizontal: 'center' } }
  COLUNAS.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 1, c })
    ws[ref].s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: teal } }, alignment: { wrapText: true, vertical: 'center' }, border: b }
    for (let r = 2; r < aoa.length; r++) {
      const rr = XLSX.utils.encode_cell({ r, c })
      if (ws[rr]) ws[rr].s = { border: b, alignment: { vertical: 'top', wrapText: true } }
    }
  })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Checklist de Atendimento')
  XLSX.writeFile(wb, nome + '.xlsx')
}
