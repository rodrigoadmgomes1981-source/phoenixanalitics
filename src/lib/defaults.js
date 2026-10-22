// Parâmetros e configurações padrão — espelham a aba "Listas de seleção" da planilha original.

export const TIPOS_PARAMETRO = [
  { tipo: 'risco', titulo: 'Classificação de risco', usaCor: true },
  { tipo: 'setor', titulo: 'Setor' },
  { tipo: 'especialidade', titulo: 'Apoio de especialista' },
  { tipo: 'exame', titulo: 'Exames (famílias)' },
  { tipo: 'medicacao', titulo: 'Medicações (classes)' },
  { tipo: 'desfecho', titulo: 'Desfecho' },
]

export const EXAMES_PADRAO = ['Exames Laboratoriais', 'RX', 'TC', 'USG', 'ECG']
export const MEDICACOES_PADRAO = [
  'Analgésicos e antitérmicos',
  'Anti-inflamatórios não esteroides (AINEs)',
  'Opioides',
  'Antimicrobianos',
  'Corticosteroides',
  'Antialérgicos / anti-histamínicos',
  'Broncodilatadores',
  'Antieméticos',
  'Antiespasmódicos',
  'Medicamentos para doenças relacionadas à acidez',
  'Laxantes',
  'Anti-hipertensivos e vasodilatadores',
  'Diuréticos',
  'Antiarrítmicos',
  'Vasopressores e inotrópicos',
  'Antiagregantes plaquetários',
  'Anticoagulantes',
  'Fibrinolíticos',
  'Hemostáticos e antifibrinolíticos',
  'Anticonvulsivantes',
  'Sedativos e ansiolíticos',
  'Anestésicos',
  'Bloqueadores neuromusculares',
  'Antipsicóticos',
  'Insulinas e medicamentos para hipoglicemia',
  'Soluções intravenosas e eletrólitos',
]

export const PARAMETROS_PADRAO = [
  { tipo: 'risco', nome: 'Vermelho – Emergência', cor: '#D92D20' },
  { tipo: 'risco', nome: 'Laranja – Muito urgente', cor: '#F2730C' },
  { tipo: 'risco', nome: 'Amarelo – Urgente', cor: '#E3B008' },
  { tipo: 'risco', nome: 'Verde – Pouco urgente', cor: '#16A34A' },
  { tipo: 'risco', nome: 'Azul – Não urgente', cor: '#2563EB' },
  { tipo: 'setor', nome: 'Observação' },
  { tipo: 'setor', nome: 'Internação' },
  { tipo: 'especialidade', nome: 'Infectologia' },
  { tipo: 'especialidade', nome: 'Cardiologia' },
  { tipo: 'especialidade', nome: 'Urologia' },
  { tipo: 'especialidade', nome: 'Ginecologia e Obstetrícia' },
  { tipo: 'especialidade', nome: 'Cirurgia Geral' },
  { tipo: 'especialidade', nome: 'Neurologia' },
  { tipo: 'especialidade', nome: 'Ortopedia' },
  { tipo: 'especialidade', nome: 'Cirurgia Vascular' },
  { tipo: 'desfecho', nome: 'Alta a pedido' },
  { tipo: 'desfecho', nome: 'Evasão' },
  { tipo: 'desfecho', nome: 'Alta médica' },
  { tipo: 'desfecho', nome: 'Transferência' },
  { tipo: 'desfecho', nome: 'Internação' },
  ...EXAMES_PADRAO.map((nome) => ({ tipo: 'exame', nome })),
  ...MEDICACOES_PADRAO.map((nome) => ({ tipo: 'medicacao', nome })),
].map((p, i) => ({ ...p, ordem: i, ativo: true }))

// Campos do checklist (colunas da aba "Checklist de Atendimento")
export const CAMPOS = [
  { key: 'prontuario', label: 'Prontuário' },
  { key: 'iniciais', label: 'Iniciais do paciente' },
  { key: 'data_nascimento', label: 'Data de nascimento' },
  { key: 'data_atendimento', label: 'Data do atendimento', fixo: true },
  { key: 'risco', label: 'Classificação de risco' },
  { key: 'setor', label: 'Setor' },
  { key: 'especialidades', label: 'Apoio de especialista' },
  { key: 'cid', label: 'CID do paciente' },
  { key: 'exames', label: 'Exames solicitados' },
  { key: 'medicacoes', label: 'Medicações' },
  { key: 'desfecho', label: 'Desfecho' },
  { key: 'observacoes', label: 'Observações' },
]

export const CONFIG_PADRAO = {
  hospital: 'Hospital Cirúrgico de Camboriú',
  empresa: 'Phoenix Serviços Médicos',
  especialidadesMultiplas: true,
  campos: {
    prontuario: { visivel: true, obrigatorio: true },
    iniciais: { visivel: true, obrigatorio: true },
    data_nascimento: { visivel: true, obrigatorio: false },
    data_atendimento: { visivel: true, obrigatorio: true },
    risco: { visivel: true, obrigatorio: true },
    setor: { visivel: true, obrigatorio: true },
    especialidades: { visivel: true, obrigatorio: false },
    cid: { visivel: true, obrigatorio: false },
    exames: { visivel: true, obrigatorio: false },
    medicacoes: { visivel: true, obrigatorio: false },
    desfecho: { visivel: true, obrigatorio: false },
    observacoes: { visivel: true, obrigatorio: false },
  },
}

export function mergeConfig(c) {
  const base = structuredClone(CONFIG_PADRAO)
  if (!c) return base
  return { ...base, ...c, campos: { ...base.campos, ...(c.campos || {}) } }
}
