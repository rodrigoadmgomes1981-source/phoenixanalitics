# Checklist Médico · Hospital Cirúrgico de Camboriú

Sistema web responsivo (React + Vite) para o monitoramento diário dos atendimentos, baseado na planilha
*Checklist_Medico_Acompanhamento.xlsx*. Identidade visual: Phoenix Serviços Médicos.

## Perfis

| Perfil | O que faz |
|---|---|
| **Médico** | Registra os atendimentos do plantão (prontuário, iniciais, nascimento, data, classificação de risco, setor, apoio de especialista, CID, exames, medicações, desfecho e observações). Vê o plantão do dia, os desfechos pendentes e o próprio histórico. Edita os próprios registros. |
| **Administrador** | Painel com indicadores do período (risco, setor, desfecho, especialistas, volume diário, produção por médico e quem já preencheu hoje). Consulta, filtra, edita, exclui e exporta registros (Excel/CSV). Gerencia parâmetros (listas de seleção com cor e ordem, campos visíveis/obrigatórios, dados da unidade) e usuários. |

## Link de visualização (Painel + Analytics)

Em **Compartilhar** (menu lateral ou botão no Painel/Analytics), o admin cria links como `https://seusite.vercel.app/v/<código>`.
Quem abre vê só o Painel e o Analytics, sem login e sem editar nada. Prontuário, iniciais, data de nascimento e observações
não saem do banco (a função `view_dados` devolve só a idade e os campos agregáveis). Os links podem ter validade e ser revogados na hora.

## Atualizações de banco (para quem já rodou o schema antes)

1. `supabase/atualizacao-01-exames-medicacoes.sql`
2. `supabase/atualizacao-02-links-visualizacao.sql`

## Rodar localmente

```bash
npm install
npm run dev
```

Sem variáveis de ambiente, o sistema abre em **modo demonstração**: dados ficam no navegador e há dois logins de teste
(`admin@demo.com` / `admin123` e `medico@demo.com` / `medico123`).

## Colocar em produção (Supabase + Vercel)

1. **Supabase** — crie um projeto em supabase.com.
   - SQL Editor → cole e rode `supabase/schema.sql` (tabelas, segurança RLS e listas iniciais).
   - Authentication → Providers → Email: **desative "Allow new users to sign up"** (só o admin cria contas).
   - Authentication → Users → *Add user* com seu e-mail (marque *Auto Confirm*). Depois rode:
     `update public.profiles set role = 'admin' where email = 'seu@email';`
2. **GitHub** — suba esta pasta para um repositório.
3. **Vercel** — *Add New Project* → importe o repositório (framework Vite é detectado) e cadastre em *Environment Variables*:

| Variável | Valor (Supabase → Project Settings → API) |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**secreta**, usada só pela função `/api/users`) |

4. Deploy. Entre com o admin, cadastre os médicos em **Usuários** e ajuste os **Parâmetros**.

No celular, use "Adicionar à tela inicial" para abrir como aplicativo.

## Estrutura

```
api/users.js              Função Vercel: criar usuário / redefinir senha (somente admin)
supabase/schema.sql       Banco, RLS e dados iniciais
src/lib/api.js            Camada de dados (Supabase ou modo demonstração)
src/lib/defaults.js       Listas e campos padrão (espelham a planilha)
src/pages/medico/*        Plantão do dia e histórico
src/pages/admin/*         Painel, registros, parâmetros, usuários
```

## LGPD

Registre apenas **iniciais** do paciente. O acesso aos registros é restrito por RLS: cada médico só lê os próprios
atendimentos; apenas administradores veem todos e podem excluir.
