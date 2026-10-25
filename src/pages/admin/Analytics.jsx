import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context'
import { api } from '../../lib/api'
import { contar, fmtData, idadeAtd, nomeCurto } from '../../lib/utils'
import {
  FAIXAS, diasEntre, ehGrave, matriz, mixPorSemana,
  periodoAnterior, porDiaSemana, resumo, serieDiaria,
} from '../../lib/indicadores'
import Periodo, { intervalo } from '../../components/Periodo'
import { BarList } from '../../components/Charts'
import { Delta, LinhaTendencia, Matriz, MixRisco } from '../../components/ChartsPro'
import { Empty, Spinner } from '../../components/ui'
import Icon from '../../components/Icon'

const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d).replace('.', ',')}%`)
const num = (v, d = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: d }))

export default function Analytics({ ir }) {
  const { ativos, toast, profile } = useApp()
  const [periodo, setPeriodo] = useState({ tipo: '30' })
  const [bruto, setBruto] = useState(null)
  const iv = intervalo(periodo)
  const ant = periodoAnterior(iv.de, iv.ate)

  useEffect(() => {
    setBruto(null)
    api.listAtendimentos({ de: ant.de, ate: iv.ate }).then(setBruto).catch((e) => { toast(e.message, 'erro'); setBruto([]) })
  }, [ant.de, iv.ate, toast])

  const riscos = ativos('risco'), desfechos = ativos('desfecho'), especialidades = ativos('especialidade'), setores = ativos('setor')
  const examesP = ativos('exame'), medsP = ativos('medicacao')

  const A = useMemo(() => {
    if (!bruto) return null
    const atual = bruto.filter((a) => a.data_atendimento >= iv.de && a.data_atendimento <= iv.ate)
    const anterior = bruto.filter((a) => a.data_atendimento >= ant.de && a.data_atendimento <= ant.ate)
    const r = resumo(atual, iv.de, iv.ate, riscos)
    const p = resumo(anterior, ant.de, ant.ate, riscos)
    const grave = ehGrave(riscos)

    const espAt = contar(atual, (a) => a.especialidades), espAn = contar(anterior, (a) => a.especialidades)
    const esp = [...new Set([...especialidades.map((e) => e.nome), ...espAt.keys()])]
      .map((nome) => ({ nome, valor: espAt.get(nome) || 0, antes: espAn.get(nome) || 0 }))
      .sort((a, b) => b.valor - a.valor)

    // Exames por família e classes de medicação (% dos atendimentos, com variação)
    const porLista = (campo, params) => {
      const cAt = contar(atual, (a) => a[campo]), cAn = contar(anterior, (a) => a[campo])
      return [...new Set([...params.map((e) => e.nome), ...cAt.keys()])]
        .map((nome) => ({ nome, valor: cAt.get(nome) || 0, antes: cAn.get(nome) || 0 }))
        .sort((a, b) => b.valor - a.valor)
    }
    const exames = porLista('exames_grupos', examesP)
    const meds_ = porLista('medicacoes_classes', medsP)
    const media = (l, campo) => (l.length ? l.reduce((s, a) => s + (a[campo]?.length || 0), 0) / l.length : null)
    const comExame = atual.filter((a) => a.exames_grupos?.length).length
    const mtzExame = riscos.map((rk) => {
      const l = atual.filter((a) => a.risco === rk.nome)
      return { ...rk, total: l.length, celulas: examesP.map((e) => ({ nome: e.nome, valor: l.filter((a) => a.exames_grupos?.includes(e.nome)).length })) }
    })
    const cids = [...contar(atual, (a) => a.cid).entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([nome, valor]) => ({ nome, valor }))
    const idades = atual.map(idadeAtd)
    const faixas = FAIXAS.map(([nome, lo, hi]) => ({ nome, valor: idades.filter((x) => x != null && x >= lo && x <= hi).length }))
    const semIdade = idades.filter((x) => x == null).length

    const dow = porDiaSemana(atual, iv.de, iv.ate)
    const medDow = dow.reduce((s, d) => s + d.valor, 0) / 7

    const meds = [...new Set(atual.map((a) => a.medico_nome).filter(Boolean))].map((nome) => {
      const l = atual.filter((a) => a.medico_nome === nome)
      const dias = new Set(l.map((a) => a.data_atendimento)).size
      return {
        nome, total: l.length, dias, porDia: l.length / dias,
        graves: l.filter(grave).length / l.length,
        esp: l.filter((a) => a.especialidades?.length).length / l.length,
        exames: media(l, 'exames_grupos'),
        pend: l.filter((a) => !a.desfecho).length / l.length,
      }
    }).sort((a, b) => b.total - a.total)

    const mtzRisco = matriz(atual.filter((a) => a.desfecho), riscos, desfechos, (a) => a.risco, (a) => a.desfecho)
    const mtzSetor = matriz(atual.filter((a) => a.desfecho), setores, desfechos, (a) => a.setor, (a) => a.desfecho)

    // ---------- Insights automáticos ----------
    const ins = []
    if (p.total) {
      const v = (r.total - p.total) / p.total
      ins.push({ tom: Math.abs(v) < 0.05 ? 'info' : v > 0 ? 'alerta' : 'info', txt: `Volume ${Math.abs(v) < 0.05 ? 'estável' : v > 0 ? `cresceu ${pct(v)}` : `caiu ${pct(-v)}`} em relação ao período anterior (${p.total} → ${r.total} atendimentos).` })
    }
    if (r.graves != null) ins.push({ tom: p.graves != null && r.graves - p.graves > 0.03 ? 'alerta' : 'info', txt: `${pct(r.graves, 1)} dos casos foram classificados como Vermelho ou Laranja${p.graves != null ? ` (antes: ${pct(p.graves, 1)})` : ''}.` })
    if (esp[0]?.valor) {
      const e = esp[0]; const cres = e.antes ? (e.valor - e.antes) / e.antes : null
      ins.push({ tom: 'info', txt: `${e.nome} é a especialidade mais acionada (${e.valor} apoios${cres != null && Math.abs(cres) >= 0.1 ? `, ${cres > 0 ? '+' : ''}${pct(cres)} vs. anterior` : ''}).` })
    }
    if (r.evasao != null && r.evasao >= 0.05) ins.push({ tom: 'alerta', txt: `Evasão + alta a pedido em ${pct(r.evasao, 1)} dos desfechos — acima da referência de 5%. Vale revisar tempo de espera e comunicação.` })
    if (r.completude != null && r.completude < 0.95) ins.push({ tom: 'alerta', txt: `${pct(1 - r.completude, 1)} dos registros ainda estão sem desfecho. Reforce o fechamento do checklist ao fim do plantão.` })
    if (exames[0]?.valor) ins.push({ tom: 'info', txt: `${pct(comExame / atual.length)} dos atendimentos solicitaram exames (média de ${num(media(atual, 'exames_grupos'))} famílias por paciente); ${exames[0].nome} é a mais solicitada (${pct(exames[0].valor / atual.length)}).` })
    const img = atual.filter((a) => (a.exames_grupos || []).some((x) => /^(RX|TC|USG)$/i.test(x))).length
    if (img) ins.push({ tom: 'info', txt: `Exames de imagem (RX, TC ou USG) em ${pct(img / atual.length)} dos atendimentos.` })
    if (meds_[0]?.valor) ins.push({ tom: 'info', txt: `Classes de medicação mais usadas: ${meds_.slice(0, 3).filter((m) => m.valor).map((m) => `${m.nome} (${pct(m.valor / atual.length)})`).join(', ')}.` })
    const pico = [...dow].sort((a, b) => b.valor - a.valor)[0]
    if (pico?.valor && medDow) ins.push({ tom: 'info', txt: `${pico.nome} é o dia de maior demanda (média de ${num(pico.valor)} atendimentos, ${pct(pico.valor / medDow - 1)} acima da média semanal) — considere reforço de escala.` })
    const rInt = mtzRisco.map((l) => ({ nome: l.nome, t: l.total, v: l.total ? l.celulas.filter((c) => /interna|transfer/i.test(c.nome)).reduce((s, c) => s + c.valor, 0) / l.total : 0 })).filter((x) => x.t >= 5).sort((a, b) => b.v - a.v)[0]
    if (rInt?.v) ins.push({ tom: 'info', txt: `Pacientes ${rInt.nome.split(/\s[–-]\s/)[0]} têm a maior taxa de internação/transferência (${pct(rInt.v)}).` })
    const mPend = meds.filter((m) => m.pend > 0.1).sort((a, b) => b.pend - a.pend)[0]
    if (mPend) ins.push({ tom: 'alerta', txt: `${nomeCurto(mPend.nome)} tem ${pct(mPend.pend)} dos registros sem desfecho.` })

    return {
      atual, r, p, esp, exames, meds_, mtzExame, comExame, mediaExames: media(atual, 'exames_grupos'), mediaMeds: media(atual, 'medicacoes_classes'), cids, faixas, semIdade, dow, medDow, meds, mtzRisco, mtzSetor, ins,
      serie: serieDiaria(atual, iv.de, iv.ate),
      mix: mixPorSemana(atual, riscos),
    }
  }, [bruto, iv.de, iv.ate, ant.de, ant.ate, riscos, desfechos, especialidades, setores])

  const n = diasEntre(iv.de, iv.ate)

  return (
    <div className="page page-wide">
      <div className="page-head">
        <div>
          <span className="eyebrow">Inteligência assistencial</span>
          <h1 className="page-title">Analytics estratégico</h1>
          <p className="muted small">{fmtData(iv.de)} a {fmtData(iv.ate)} ({n} dias) · comparado a {fmtData(ant.de)} a {fmtData(ant.ate)}</p>
        </div>
        {profile.role === 'admin' && <button className="btn btn-ghost" onClick={() => ir('links')}><Icon name="share" size={18} />Compartilhar</button>}
      </div>
      <Periodo value={periodo} onChange={setPeriodo} />

      {!A ? <Spinner label="Calculando indicadores…" /> : A.atual.length === 0 ? <Empty icon="chart" titulo="Sem dados no período" texto="Escolha outro intervalo." /> : (
        <>
          <div className="kpis kpis-8">
            <Kpi hero titulo="Atendimentos" valor={A.r.total} sub={`${num(A.r.mediaDia)} por dia`}><Delta atual={A.r.total} anterior={A.p.total} tipo="rel" /></Kpi>
            <Kpi titulo="Casos graves" valor={pct(A.r.graves, 1)} sub="Vermelho + Laranja"><Delta atual={A.r.graves} anterior={A.p.graves} tipo="pp" bomQuandoSobe={false} /></Kpi>
            <Kpi titulo="Internação / transferência" valor={pct(A.r.internacao, 1)} sub="sobre desfechos"><Delta atual={A.r.internacao} anterior={A.p.internacao} tipo="pp" /></Kpi>
            <Kpi titulo="Evasão + alta a pedido" valor={pct(A.r.evasao, 1)} sub="referência ≤ 5%" alerta={A.r.evasao >= 0.05}><Delta atual={A.r.evasao} anterior={A.p.evasao} tipo="pp" bomQuandoSobe={false} /></Kpi>
            <Kpi titulo="Apoio de especialista" valor={pct(A.r.especialista, 1)} sub="dos atendimentos"><Delta atual={A.r.especialista} anterior={A.p.especialista} tipo="pp" /></Kpi>
            <Kpi titulo="Completude do checklist" valor={pct(A.r.completude, 1)} sub="com desfecho registrado" alerta={A.r.completude < 0.95}><Delta atual={A.r.completude} anterior={A.p.completude} tipo="pp" bomQuandoSobe /></Kpi>
            <Kpi titulo="Idade média" valor={A.r.idadeMedia == null ? '—' : `${num(A.r.idadeMedia, 0)} anos`} sub="pacientes atendidos"><Delta atual={A.r.idadeMedia} anterior={A.p.idadeMedia} tipo="abs" /></Kpi>
            <Kpi titulo="Média diária" valor={num(A.r.mediaDia)} sub="atendimentos/dia"><Delta atual={A.r.mediaDia} anterior={A.p.mediaDia} tipo="rel" /></Kpi>
          </div>

          {A.ins.length > 0 && (
            <section className="card insights">
              <h2 className="card-title"><Icon name="alert" size={18} />Destaques do período</h2>
              <ul>{A.ins.map((i, k) => <li key={k} className={'ins-' + i.tom}><span className="ins-dot" />{i.txt}</li>)}</ul>
            </section>
          )}

          <div className="dash-grid">
            <section className="card span-2">
              <h2 className="card-title">Tendência de demanda</h2>
              {A.serie.length > 1 ? <LinhaTendencia dados={A.serie} /> : <p className="muted small">Selecione mais de um dia.</p>}
            </section>
            <section className="card">
              <h2 className="card-title">Demanda por dia da semana</h2>
              <p className="muted small mb-s">Média de atendimentos por dia</p>
              <BarList itens={A.dow.map((d) => ({ ...d, valor: Math.round(d.valor * 10) / 10 }))} />
            </section>

            <section className="card span-2">
              <h2 className="card-title">Perfil de gravidade por semana</h2>
              <MixRisco semanas={A.mix} riscos={riscos} />
            </section>
            <section className="card">
              <h2 className="card-title">Faixa etária</h2>
              <BarList itens={A.faixas} total={A.atual.length - A.semIdade} />
              {A.semIdade > 0 && <p className="muted small mt-s">{A.semIdade} registro(s) sem data de nascimento.</p>}
            </section>

            <section className="card span-2">
              <h2 className="card-title">Classificação de risco × desfecho</h2>
              <p className="muted small mb-s">Distribuição dos desfechos dentro de cada classificação (% da linha)</p>
              <Matriz linhas={A.mtzRisco} colunas={desfechos} rotuloLinha="Risco" />
            </section>
            <section className="card">
              <h2 className="card-title">Demanda de especialistas</h2>
              <ul className="barlist">
                {A.esp.filter((e) => e.valor || e.antes).map((e) => {
                  const max = Math.max(1, ...A.esp.map((x) => x.valor))
                  return (
                    <li key={e.nome}>
                      <div className="bl-row">
                        <span className="bl-name">{e.nome}</span>
                        <span className="bl-val">{e.valor} {e.antes >= 5 && <Delta atual={e.valor} anterior={e.antes} tipo="rel" />}</span>
                      </div>
                      <div className="bl-track"><div className="bl-bar" style={{ width: `${(e.valor / max) * 100}%` }} /></div>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="card span-2">
              <h2 className="card-title">Setor × desfecho</h2>
              <Matriz linhas={A.mtzSetor} colunas={desfechos} rotuloLinha="Setor" />
            </section>
            <section className="card">
              <h2 className="card-title">CIDs mais frequentes</h2>
              <BarList itens={A.cids} total={A.atual.length} vazio="Nenhum CID informado" />
            </section>

            <section className="card">
              <h2 className="card-title">Exames por família</h2>
              <p className="muted small mb-s">% dos atendimentos · média de {num(A.mediaExames)} família(s) por paciente</p>
              <ListaDelta itens={A.exames} total={A.atual.length} vazio="Nenhum exame registrado" />
            </section>
            <section className="card span-2">
              <h2 className="card-title">Uso de exames por classificação de risco</h2>
              <p className="muted small mb-s">% dos pacientes de cada classificação que solicitaram a família de exame</p>
              <Matriz linhas={A.mtzExame} colunas={examesP} rotuloLinha="Risco" />
            </section>

            <section className="card span-3">
              <h2 className="card-title">Classes de medicação mais utilizadas</h2>
              <p className="muted small mb-s">% dos atendimentos · média de {num(A.mediaMeds)} classe(s) por paciente</p>
              <div className="cols-2-list">
                <ListaDelta itens={A.meds_.filter((m) => m.valor || m.antes)} total={A.atual.length} vazio="Nenhuma medicação registrada" />
              </div>
            </section>

            <section className="card span-3">
              <h2 className="card-title">Desempenho por médico</h2>
              <div className="table-wrap flat">
                <table className="table">
                  <thead><tr><th>Médico</th><th className="num">Atend.</th><th className="num">Plantões</th><th className="num">Média/plantão</th><th className="num">% graves</th><th className="num">% especialista</th><th className="num">Exames/atend.</th><th className="num">% sem desfecho</th></tr></thead>
                  <tbody>
                    {A.meds.map((m) => (
                      <tr key={m.nome} className="no-click">
                        <td><strong>{m.nome}</strong></td>
                        <td className="num">{m.total}</td>
                        <td className="num">{m.dias}</td>
                        <td className="num">{num(m.porDia)}</td>
                        <td className="num">{pct(m.graves)}</td>
                        <td className="num">{pct(m.esp)}</td>
                        <td className="num">{num(m.exames)}</td>
                        <td className="num">{m.pend > 0.1 ? <span className="tag tag-warn">{pct(m.pend)}</span> : pct(m.pend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small mt-s">“Plantões” = dias distintos com ao menos um registro do médico no período.</p>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ titulo, valor, sub, children, hero, alerta }) {
  return (
    <div className={'kpi' + (hero ? ' kpi-hero' : '') + (alerta ? ' kpi-warn' : '')}>
      <span>{titulo}</span>
      <strong>{valor}</strong>
      <div className="kpi-foot"><small>{sub}</small>{children}</div>
    </div>
  )
}

function ListaDelta({ itens, total, vazio }) {
  if (!itens.some((i) => i.valor)) return <p className="muted small">{vazio}</p>
  const max = Math.max(1, ...itens.map((x) => x.valor))
  return (
    <ul className="barlist">
      {itens.map((e) => (
        <li key={e.nome} title={`${e.nome}: ${e.valor} (${total ? Math.round((e.valor / total) * 100) : 0}% dos atendimentos)`}>
          <div className="bl-row">
            <span className="bl-name">{e.nome}</span>
            <span className="bl-val">{e.valor}<em>{total ? Math.round((e.valor / total) * 100) : 0}%</em> {e.antes >= 5 && <Delta atual={e.valor} anterior={e.antes} tipo="rel" />}</span>
          </div>
          <div className="bl-track"><div className="bl-bar" style={{ width: `${(e.valor / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
