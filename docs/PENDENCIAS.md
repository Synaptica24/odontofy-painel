# Pendências com o dono do projeto (Gabriel)

Cada agente adiciona aqui o que precisa e não está no brief. Não inventar.

## Backend (Codex)

- [x] Aprovar `BACKEND-MODELO.md` antes de qualquer migração ou integração (Fase 2), incluindo tabelas auxiliares e campos adicionais. Aprovado explicitamente pelo dono em 2026-09-17.
- [ ] Informar URL/projeto Supabase, região e chaves pelos ambientes seguros; nunca colar service role neste documento. Confirmar acesso administrativo para provisionar a conta e configurar Auth.
- [ ] Informar e-mail da conta única, URL definitiva do painel e URLs de callback permitidas (desenvolvimento e produção); definir remetente/entrega de magic link.
- [ ] Informar URL do webhook n8n de envio e mecanismo de autenticação; fornecer segredo apenas por variável de ambiente. Definir payload, ACK, timeout, chave de correlação/idempotência, retries e associação ao `wa_message_id` sem duplicar mensagens.
- [ ] Definir canal de urgência (WhatsApp/e-mail), destino real, atendimento fora do expediente e fallback quando a notificação falhar.
- [ ] Informar horários reais por dia, intervalos, feriados/exceções e catálogo de tipos com duração em minutos. Fixture `ATENDIMENTO_TESTE`, 10h–10h30, é somente cenário visual.
- [ ] Informar teto semanal de pacientes novos e definição de “novo”; aprovar se sugestões e faltas consomem o teto, a classificação histórica e a busca de vagas por semana. Confirmar disponibilidade para pacientes já existentes quando o teto de novos foi atingido.
- [ ] Informar antecedência mínima de agendamento, antecedência/horário da confirmação e regra de confirmação automática versus aprovação humana; confirmar regras de falta/cancelamento/remarcação.
- [ ] Aprovar duração da pausa ao assumir/escalar (30 min é apenas proposta técnica), possibilidade de prazo personalizado e tratamento de urgência após expiração.
- [ ] Informar teto de gasto de IA, provedores/contas, fonte/API de consumo, periodicidade, granularidade e reconciliação; definir fonte de câmbio, data da cotação, fallback e comportamento ao atingir teto ou perder atualização. Até lá consumo/câmbio desconhecidos, sem gasto inventado.
- [ ] Confirmar origem autorizada da base da campanha, consentimento/opt-out, levas, intervalo, limite diário, horário permitido e critério de atribuição a agendamento. Não importar dados nem iniciar disparos nesta fase.
- [ ] Fornecer perguntas/respostas reais, gatilhos e ações de escalonamento, limites do atendimento automatizado e critérios de urgência.
- [ ] Definir política de retenção/exclusão, acesso a mídias, backup/recuperação e auditoria. Confirmar como importar histórico e referências Codental sem API especulativa.
- [x] Incluir `resumoDoDia()` e agenda com nome do paciente: autorizados e implementados na Fase 2.
- [ ] Aplicar migrações em projeto Supabase de homologação e executar `supabase/tests/backend.sql`, incluindo os testes concorrentes de `BACKEND-FASE2.md`. Docker local estava indisponível nesta sessão.
- [ ] Adotar e homologar o protocolo proposto `correlacao-v1` de `BACKEND-FASE2.md`. O código de envio existe, mas permanece desabilitado sem `N8N_ENVIO_PROTOCOLO`, URL e segredo. Nenhum envio real foi realizado.

## Front-end (Claude)

- [x] Direção visual escolhida na página do impeccable: Quadro branco com ímãs (branco, redondo, divertido). — 2026-09-17
- [x] Nome: Dr. Mateus Peixoto (dentista e consultório). Logo: não informado; se existir, mandar o arquivo. — 2026-09-17
- [x] (decidido por padrão, 2026-10-25) Onde cada toque da tela Hoje leva: "Assumir" abre a conversa ou assume direto da lista? (assumi: assume direto, com Desfazer, e abre a thread em seguida)
- [x] Prazo da pausa mostrado no toast de "Assumir" vem de `config.pausa_agente_minutos` (tela Conversa lê a config; tela Hoje não cita minutos). — fechado 2026-10-25


## OdontoFy (landing do produto) e migração do prontuário (Claude, 2026-10-24)

- [ ] WhatsApp comercial para o botão "Pedir uma demonstração" da landing (`OdontoFy-site/config/site.ts`); enquanto vazio, o botão abre e-mail para gabrieltomaz442@gmail.com.
- [x] Nome do produto: **OdontoFy** (definido pelo Gabriel em 2026-10-25; substitui Incisivo e Marfim). Landing renomeada e publicada em https://odontofy.vercel.app (pasta `OdontoFy-site`, projeto Vercel `odontofy`; o projeto `incisivo` continua existindo e pode ser apagado no painel da Vercel).
- [ ] Domínio: **odontofy.com.br já está registrado** (desde 2019, pessoa física, vence 2027-05) e odontofy.com responde a um site. Existe risco de marca homônima; decidir se mantém o nome ou negocia o domínio. Grafia adotada: "OdontoFy" (Fy em azul no logo).
- [ ] Consultas passadas do Codental marcadas como "Agendada/Confirmada" entraram como "concluída" (o Codental não registra presença em tudo); faltas e cancelamentos vieram como estão. Confirmar se a regra serve.
- [ ] Receitas e atestados do Codental entraram só como registro (tipo + resumo), sem PDF; o PDF continua no Codental.
