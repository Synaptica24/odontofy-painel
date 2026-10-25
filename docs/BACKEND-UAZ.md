# WhatsApp do consultório via UAZ-API

Fase 1 entregue em 2026-10-25. Substitui gradualmente o transporte n8n.

## O que existe

- **Tabela** `whatsapp_conexoes` (migração `202610250001`): uma instância por consultório. `instance_token` só é legível pelo `service_role` (privilégio por coluna); a sessão do painel lê o resto via RLS e não escreve nada. Trilha em `eventos` (`whatsapp.conectou`, `whatsapp.desconectou` e o `auditar()` da tabela, que registra só os nomes das colunas alteradas).
- **Servidor** `lib/servidor/whatsapp.ts`: `whatsappStatus`, `whatsappIniciar({ metodo: 'qr' | 'pair', telefone? })`, `whatsappAtualizarStatus`, `whatsappDesconectar`, `whatsappEnviarTeste` (1 por minuto, para o próprio número pareado). Entra por `executarOperacao` (prefixo `whatsapp`). Endpoints UAZ usados, conferidos no `openapi-bundled.json` oficial: `POST /instance/create` (admintoken), `POST /instance/connect`, `GET /instance/status`, `POST /instance/disconnect`, `POST /send/text` (token da instância).
- **Transporte único** `enviarTextoWhatsapp(consultorioId, telefoneE164, texto, chaveIdempotencia, { pacienteId? })`: (1) UAZ se `status = connected`; (2) n8n se `N8N_ENVIO_PROTOCOLO = correlacao-v1`; (3) dry-run. Respeita `nao_perturbe`. Já existe; o cron e o chat ainda não o chamam.
- **Fachada** `lib/api.ts` e tipo `WhatsappConexao` em `lib/contratos.ts`. Nenhum token chega ao navegador.
- **UI** `components/telas/ajustes-whatsapp.tsx`, primeiro bloco de Ajustes: desconectado → QR ou código; conectando → QR/código com contagem regressiva (2 min / 5 min) e poll a cada 2,5 s; conectado → número mascarado, teste, desconectar (arraste para confirmar); hibernado/erro → mensagem e reconectar.
- **Proxy** libera `/api/cron/*` só com `Authorization: Bearer CRON_SECRET` (antes o cron da Vercel levava 401 antes de chegar à rota).
- **Env** (servidor): `UAZ_BASE_URL` (https), `UAZ_ADMIN_TOKEN`; opcional `UAZ_WEBHOOK_SECRET`.

## Expiração

QR ~2 min e código ~5 min: a UI mostra a contagem e o servidor, no próximo poll após o prazo, chama `/instance/disconnect` e volta a `disconnected` com mensagem para gerar outro.

## Fase 2 (não implementada)

1. **Chat**: `enviarMensagem` em `lib/servidor/painel.ts` passa a usar `enviarTextoWhatsapp` quando a conexão está `connected`, gravando `wa_message_id` devolvido por `/send/text` (campo `messageid`) na mensagem preparada por `preparar_envio`. Recebimento: webhook UAZ `messages` → rota `app/api/uaz/webhook` validando `UAZ_WEBHOOK_SECRET`, inserindo em `mensagens` pela RPC existente do n8n (`receber_mensagem`), sem logar texto.
2. **Cron de confirmações**: `app/api/cron/confirmacoes/route.ts` troca o fetch direto ao n8n por `enviarTextoWhatsapp(c.id, p.telefone_e164, texto, 'confirmacao-' + a.id, { pacienteId })` e marca `confirmacao_enviada_em` quando `enviado = true`.
3. **Webhook de conexão**: `POST /webhook` na UAZ com `events: ['connection']` apontando para `app/api/uaz/webhook`, para o status mudar sem poll.
4. **Criptografia do token em repouso** (pgsodium/Vault) quando o projeto adotar um padrão.
5. Templates de pós-consulta e campanha pelo mesmo transporte.
