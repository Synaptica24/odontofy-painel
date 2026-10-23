Você é o CODEX, dono do backend. O dono do projeto APROVOU docs/BACKEND-MODELO.md. Esta é a FASE 2. Releia AGENTS.md, docs/BRIEF-BACKEND.md e docs/PEDIDOS.md antes de começar. A direção visual escolhida foi a A; o front (Claude) está construindo todas as telas em app/(painel)/ em paralelo, em cima de lib/api.ts. NÃO edite app/(painel)/, components/, styles/, app/layout.tsx, app/globals.css.

Entregue nesta ordem, commitando nada (sem git):

1) supabase/migrations/ versionadas com o modelo aprovado: tabelas, enums, índices, constraints, RLS em tudo (service role para o n8n, usuário logado para o painel), Realtime publicado em mensagens e conversas, seed de `config` com todos os padrões, triggers que gravam em `eventos` toda edição em base_conhecimento e config.
2) As 6 RPCs do n8n com os nomes exatos da seção 4 do brief (contexto_paciente, registrar_mensagem, buscar_conhecimento, horarios_livres, criar_agendamento, escalar_conversa). Toda regra de agenda mora no banco. horarios_livres devolve vazio com motivo 'teto_semanal' quando o teto estoura. criar_agendamento revalida teto e conflito.
3) lib/supabase/ (clientes server e browser via @supabase/ssr), proxy.ts (proteção de sessão, conta única por AUTH_EMAIL_PERMITIDO), app/(auth)/entrar/page.tsx mínimo para magic link (pode ser feio; o front polirá depois em components/ — apenas exponha a server action de envio do magic link em lib/auth.ts), app/api/ com a rota de envio que chama o webhook do n8n (segredo em env), e as rotas de callback de auth.
4) lib/api.ts: implementação real de cada função SEM mudar assinatura. REGRA: se NEXT_PUBLIC_SUPABASE_URL não estiver definido, lib/api.ts continua devolvendo a fixture (FIXTURE_ATIVA vira derivado do ambiente). O front precisa continuar rodando sem .env.local.
5) Novas funções pedidas pelo front, adicionadas em lib/api.ts e lib/contratos.ts:
   - `resumoDoDia(data?: DataCivil)` → `{ data; escaladas: ResumoConversa[]; agenda: AgendamentoComPaciente[]; bloqueios: Bloqueio[]; contatos_novos_24h: number; mensagens_ia_hoje: number; pacientes_novos_semana: number; teto_pacientes_novos_semana: number }` em UMA chamada.
   - `AgendamentoComPaciente = Agendamento & { paciente: Paciente }`; agendaDoDia e agendaDaSemana passam a devolver agendamentos com paciente (adicione o campo, não mude o resto).
   - `listarPacientes(busca?: string)` → Paciente[] com contagem de conversas.
   - `remarcarAgendamento(id, novoInicio)` e `cancelarAgendamento(id)`.
   - `excluirConhecimento(id)` e `alternarConhecimento(id, ativo)`.
   - `enviarMagicLink(email)` em lib/auth.ts.
   Atualize a fixture para cobrir todas elas (dados obviamente fictícios: "Paciente Teste NN", +55 11 90000-00NN).
6) README.md curto em português: como rodar, como criar o projeto Supabase e aplicar migrações, como mexer no config, o que ficou pendente (aponte para docs/PENDENCIAS.md).
7) `npx tsc --noEmit` e `npx eslint lib app/api proxy.ts` limpos. Não rode npm install; se precisar de dependência, anote em docs/PEDIDOS.md.

Marque em docs/PEDIDOS.md o pedido do resumoDoDia como atendido. Ao terminar, resuma em português: arquivos, decisões, e o que NÃO foi possível sem as pendências.
