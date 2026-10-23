# Backend — entrega da Fase 2

O modelo foi aprovado em 17/09/2026. Migrações em ordem: modelo/RLS, config/agenda, seis RPCs n8n, operações do painel e reforços de integridade. Não há dados fictícios no banco; apenas os padrões técnicos de `config` são semeados.

## Contrato e decisões

- `lib/api.ts` conserva as assinaturas existentes e o envelope `ResultadoApi`. `FIXTURE_ATIVA` depende exclusivamente da ausência de `NEXT_PUBLIC_SUPABASE_URL`; configuração incompleta nunca cai silenciosamente em fixture.
- `lib/fixture.ts` mantém estado fictício em memória. As novas operações têm fixture e agenda inclui `paciente`. `listarPacientes` acrescenta `contagem_conversas`; o campo é opcional nos demais retratos de `Paciente`.
- `resumoDoDia(data?)` usa uma chamada do front a uma Server Action e uma RPC agregadora `resumo_do_dia`. A autenticação faz suas próprias verificações; não há uma chamada por paciente. `data` determina agenda e mensagens do dia; contatos nas últimas 24 horas são relativos ao momento da consulta.
- Operações gerais usam Server Actions autenticadas e também estão disponíveis nas rotas REST previstas, implementadas por `app/api/[...caminho]/route.ts`. Envio do navegador usa `POST /api/conversas/:id/mensagens`. Novas rotas: `GET /api/resumo`, `GET /api/pacientes`, `POST /api/agendamentos/:id/remarcar` (`novoInicio`), `POST /api/agendamentos/:id/cancelar`, `DELETE /api/conhecimento/:id`, `PATCH /api/conhecimento/:id` (`ativo`).
- POST/PUT/PATCH recebem os campos do contrato em JSON; PATCH config recebe o objeto parcial diretamente; conhecimento recebe pergunta, resposta, palavras_chave e ativo. Agenda usa query `data` e filtros opcionais `status` e `paciente_id`. Mutações REST exigem `Origin` igual à origem de `APP_URL`; Server Actions usam a proteção de origem do Next.js e repetem a autorização.
- Cliente SSR público, cookies renovados pelo proxy, `getUser` e comparação de `AUTH_EMAIL_PERMITIDO`; RLS exige ainda UUID em `conta_autorizada`. Service role não participa da sessão do painel e não é enviada ao navegador. Base: [documentação oficial de SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs) e [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- Inscrições Realtime entregam retratos completos, refazem leitura após reconexão e removem canais ao sair/cancelar. A lista de conversas também reage a mensagens novas. Falhas não imprimem conteúdo nem erros SQL crus.
- Agenda: trava transacional comum em todas as escritas, validação em trigger inclusive para service role, intervalos `[inicio,fim)`, semanas de segunda a domingo em São Paulo, teto inclui sugestões/confirmados/faltas de novos e exclui cancelamentos. Busca cobre só a semana solicitada e assume paciente novo. Enum continua `text + CHECK`, como aprovado.
- Remarcar mantém status e classificação histórica, calcula nova duração pelo catálogo e revalida. Cancelamento libera reserva/teto. Falta só parte de confirmado; confirmação só de sugerido. Antecedência é revalidada ao criar/remarcar, não ao marcar falta ou confirmar horário já reservado. Não se reabre um cancelado/falta.
- Consumo permanece desconhecido sem registros da fonte configurada; BRL exige câmbio registrado com fonte. Períodos sobrepostos por fonte são rejeitados. Importe intervalos incrementais inteiramente contidos no mês civil; divida registros que cruzem meses. Não há importador especulativo de provedores ou Codental.

## Envio n8n: proposta implementada, ainda sem homologação

Habilite `N8N_ENVIO_PROTOCOLO=correlacao-v1` somente após o fluxo adotar este acordo. Também são obrigatórios URL HTTPS e segredo. Sem isso, a rota retorna indisponível antes de persistir ou enviar.

1. A rota valida sessão e conversa assumida com pausa vigente. `preparar_envio` grava a mensagem com `wa_message_id=null` e UUID de correlação antes do webhook.
2. Webhook recebe `Authorization: Bearer <segredo>`, `Idempotency-Key: <mensagem_id>` e `{ versao: 'correlacao-v1', mensagem_id, conversa_id, texto }`. O telefone deve ser obtido pelo n8n no contexto da conversa; não aceitar destino arbitrário do front.
3. n8n autentica o segredo, verifica a mensagem persistida e deduplica de forma durável pelo UUID antes de usar WhatsApp. Só n8n envia. Depois chama `confirmar_envio(p_mensagem_id,p_wa_message_id)` com service role, associando o identificador ao MESMO registro. Não chamar `registrar_mensagem` para criar outra cópia da saída do dentista.
4. Só após persistir, responder `{ status: 'enviada', mensagem_id, wa_message_id }`. A rota verifica o ACK e relê a mensagem; sucesso exige coincidência no banco.
5. Timeout de 15 segundos, erro ou ACK incompleto deixam a mensagem pendente. Não há retry automático. Nova tentativa na mesma aba reutiliza UUID. Após recarregar, tentativa idêntica ainda pendente é bloqueada no banco: reconciliar pelo UUID original no n8n antes de outro envio. Não apagar registro pendente para tentar novamente.

`registrar_mensagem` continua idempotente por WhatsApp ID para entradas e saídas da IA; payload divergente é conflito. Mídias devem usar referência privada/temporária, não URL pública permanente. Política de mídia, tratamento de falhas e reconciliação operacional continuam em PENDENCIAS.

## Validação SQL

Em um projeto descartável/local com migrações aplicadas, execute `supabase/tests/backend.sql` como administrador (por exemplo, `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/backend.sql`). O teste abre transação e faz rollback; usa somente dados obviamente fictícios. Nunca reutilize a URL real em logs.

Para concorrência, em duas sessões service role, configure uma única vaga nova na semana. Na sessão A abra transação, crie reserva e mantenha a transação aberta. Na B tente outra reserva na mesma semana: deve aguardar A e falhar com `teto_semanal` após commit de A. Repita reserva versus bloqueio sobreposto e duas reservas iguais (uma única deve persistir). Use isolamento padrão READ COMMITTED. Repita idempotência do mesmo WhatsApp ID simultaneamente.

Auth/magic link, eventos Realtime, corrida entre sessões e webhook real exigem Supabase/n8n provisionados. Teste também anon, segundo usuário, callback expirado, logout e atualização de token. Nenhuma chave real ou conteúdo de paciente faz parte dos testes.

## Verificações desta entrega

- `npx next typegen`: passou, regenerando referências de rotas alteradas pelo front.
- `npx tsc --noEmit`: passou.
- `npx eslint lib app/api proxy.ts`: passou.
- `node supabase/tests/fixture.cjs`: passou (novas funções, agenda, envio fictício, erros e cancelamento de inscrição).
- SQL: scripts escritos e revisados, ainda não executados. Não há PostgreSQL local acessível e o Docker não respondeu, inclusive após tentativa de iniciar o aplicativo instalado. Migrações não foram aplicadas em projeto remoto; não foram fornecidas credenciais para homologação.
