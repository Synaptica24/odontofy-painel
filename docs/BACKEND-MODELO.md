# Modelo de dados — Fase 1, para aprovação

Proposta final de estrutura, ainda não aplicada. Nenhuma migração, rota, autenticação ou integração real foi criada. A aprovação deste documento libera a Fase 2. As configurações operacionais pendentes estão em `PENDENCIAS.md`.

## Convenções e contrato

IDs são `uuid PRIMARY KEY DEFAULT gen_random_uuid()`. Colunas são `NOT NULL` salvo indicação explícita de `NULL`. Datas de eventos são `timestamptz`, padrão `now()` quando indicado. Postgres armazena instantes; banco e sessões usam `America/Sao_Paulo` para calendário, semana e apresentação. Semana começa na segunda-feira. Intervalos de agenda são `[inicio, fim)`; horários adjacentes não conflitam.

Enums são `text` com `CHECK` e têm exatamente as alternativas de `lib/contratos.ts`. Telefone persistido em E.164, sem pontuação (`+5511900000001` na fixture corresponde a `+55 11 90000-0001`). Strings ausentes de campos opcionais do domínio usam `NULL`; observações/texto livre usam `''` quando aplicável.

`lib/api.ts` exporta 22 funções com `ResultadoApi<T>` discriminado por `sucesso`: sucesso traz `dados` e `erro: null`; falha traz `dados: null` e `{ codigo, mensagem }` em português. Inscrições retornam cancelamento síncrono idempotente; seus callbacks recebem o mesmo envelope com uma lista completa, inicialmente e após alterações. `salvarConfig` aceita atualização parcial, substituindo integralmente o valor de cada chave informada. `salvarConhecimento` cria sem `id` e atualiza com `id`.

Fixture em memória por instância do módulo, não compartilhada entre abas/servidor e perdida ao recarregar. Todas as operações assíncronas aguardam 250 ms. `FIXTURE_ATIVA = true` deve sinalizar demonstração na interface. Não há envio, persistência, relógio de expiração automático ou regra real de agenda nessa fase. A confirmação da sugestão fictícia funciona mesmo com agenda desativada, exclusivamente para testar a interface. Não usar esse comportamento como validação de negócio.

## Tabelas

| Tabela | Colunas (além de `id`, salvo config) |
| --- | --- |
| `pacientes` | `nome text`, `telefone_e164 text`, `origem text CHECK IN ('whatsapp','site','campanha','indicacao')`, `codental_id text NULL`, `primeiro_contato timestamptz DEFAULT now()`, `ultimo_contato timestamptz DEFAULT now()`, `status text DEFAULT 'novo' CHECK IN ('novo','em_conversa','agendado','paciente','fora_da_base')`, `observacoes text DEFAULT ''`, `nao_perturbe boolean DEFAULT false` |
| `conversas` | `paciente_id uuid REFERENCES pacientes`, `iniciada_em timestamptz DEFAULT now()`, `encerrada_em timestamptz NULL`, `status text DEFAULT 'ativa' CHECK IN ('ativa','escalada','assumida','encerrada')`, `motivo_escalonamento text NULL`, `resumo_gerado text NULL`, `agente_pausado_ate timestamptz NULL`, `urgente boolean DEFAULT false` |
| `mensagens` | `conversa_id uuid REFERENCES conversas`, `direcao text CHECK IN ('entrada','saida')`, `autor text CHECK IN ('paciente','agente','dentista')`, `texto text DEFAULT ''`, `tipo text CHECK IN ('texto','audio','imagem','documento')`, `transcricao text NULL`, `midia_url text NULL`, `wa_message_id text NULL`, `criada_em timestamptz DEFAULT now()` |
| `agendamentos` | `paciente_id uuid REFERENCES pacientes`, `tipo text`, `inicio timestamptz`, `fim timestamptz`, `status text DEFAULT 'sugerido' CHECK IN ('sugerido','confirmado','cancelado','faltou')`, `confirmado_em timestamptz NULL`, `origem text CHECK IN ('agente','painel')`, `observacao text DEFAULT ''`, `paciente_novo boolean`, `campanha_envio_id uuid NULL REFERENCES campanha_envios` |
| `bloqueios` | `inicio timestamptz`, `fim timestamptz` |
| `campanha_envios` | `paciente_id uuid REFERENCES pacientes`, `leva integer`, `enviada_em timestamptz NULL`, `status text DEFAULT 'fila' CHECK IN ('fila','enviada','respondida','erro','bloqueada')`, `respondida_em timestamptz NULL`, `erro text NULL` |
| `base_conhecimento` | `pergunta text`, `resposta text`, `palavras_chave text[] DEFAULT '{}'`, `ativo boolean DEFAULT true` |
| `regras_escalonamento` | `gatilho text`, `acao text`, `ativo boolean DEFAULT true` |
| `config` | Sem `id`: `chave text PRIMARY KEY`, `valor jsonb NOT NULL`. Chaves permitidas e validação descritas abaixo. |
| `eventos` | `tipo text`, `payload jsonb DEFAULT '{}'`, `criado_em timestamptz DEFAULT now()` |
| `consumo_ia` | `referencia_externa text UNIQUE`, `periodo_inicio timestamptz`, `periodo_fim timestamptz`, `gasto_usd numeric(18,6)`, `cambio_usd_brl numeric(18,6) NULL`, `fonte_consumo text`, `fonte_cambio text NULL`, `atualizado_em timestamptz DEFAULT now()` |
| `conta_autorizada` | `id uuid PRIMARY KEY REFERENCES auth.users(id)` sem default aleatório; registro único, constraint via índice único na expressão constante `(true)`. Somente administração pode alterar. |

Adições ao brief: `bloqueios` atende `criarBloqueio`; `urgente` preserva `p_urgente`; `paciente_novo` conserva a classificação histórica para o teto; `campanha_envio_id` dá atribuição verificável; `consumo_ia` registra consumo sem conteúdo de paciente; `conta_autorizada` restringe a conta única no próprio banco. Nenhuma integração especulativa com Codental: só referência textual opcional.

## Constraints, índices e transações

- `pacientes`: UNIQUE `telefone_e164`, CHECK `^\+[1-9][0-9]{7,14}$`, nome não vazio, `ultimo_contato >= primeiro_contato`; índices `(status, ultimo_contato DESC)` e `codental_id` parcial não nulo.
- `conversas`: UNIQUE parcial `(paciente_id) WHERE status <> 'encerrada'`; índice `(status, iniciada_em DESC)`; encerramento exige data e vice-versa, `encerrada_em >= iniciada_em`; assumida exige prazo não nulo; escalada exige motivo não vazio. Nunca usar `now()` em predicado de índice de pausa.
- `mensagens`: UNIQUE parcial `wa_message_id WHERE wa_message_id IS NOT NULL`, rejeitar identificador vazio; índice `(conversa_id, criada_em, id)`. Entrada exige autor paciente; saída exige agente/dentista. Mensagem de texto exige texto não vazio, outros tipos exigem mídia; não registrar URLs públicas permanentes de mídia sensível.
- `agendamentos` e `bloqueios`: CHECK `fim > inicio`. EXCLUDE GiST `tstzrange(inicio,fim,'[)') WITH &&`, parcial para agendamentos sugeridos/confirmados e integral para bloqueios. Índices `(paciente_id, inicio DESC)`, `(inicio)`, `(campanha_envio_id)` parcial; confirmação exige `confirmado_em`; tipo não vazio. FK composta `(campanha_envio_id,paciente_id)` contra UNIQUE `(id,paciente_id)` de campanha garante mesma pessoa.
- Conflito entre tabelas e teto: todas as escritas de agenda adquirem a mesma trava transacional do consultório, inclusive alterações/cancelamentos/bloqueios/configuração de agenda. Trigger de validação protege também escrita service role. Sob a trava revalidar horários, duração, antecedência, bloqueios, reservas e teto; isso impede corrida entre n8n e painel. Escrita autenticada direta em agenda é revogada: usar RPC.
- Teto conta reservas de pacientes novos não canceladas na semana civil de início, incluindo sugeridos, confirmados e faltas; regra proposta para aprovação. `paciente_novo` calculado no banco e não aceito do chamador. Classificação inicial proposta: paciente ainda sem atendimento prévio registrado; confirmar base histórica com Gabriel.
- `campanha_envios`: UNIQUE `(paciente_id, leva)`, `leva > 0`, índice `(status, leva)`; enviada/respondida exige `enviada_em`, respondida exige `respondida_em >= enviada_em`, erro exige descrição. Bloquear quem tem `nao_perturbe`; pausar impede novos disparos, sem desfazer os já entregues. Contagens do painel são status atual; `agendadas` conta pessoas distintas com confirmação atribuída à campanha e é subconjunto independente.
- Conhecimento: pergunta/resposta não vazias; GIN em `to_tsvector('portuguese', pergunta || ' ' || resposta)` e em `palavras_chave`; busca somente ativa, ordenação por rank, desempate por id. Regras: gatilho/ação não vazios, vocabulário operacional pendente; não executar código armazenado em `acao`.
- `eventos`: índices `(criado_em DESC)` e `(tipo, criado_em DESC)`; append-only. Triggers de conhecimento e config registram edição e exclusão na mesma transação (inclusive via n8n), com referência, chaves alteradas, ator e data; sem copiar conversa, segredos ou observação clínica para payload.
- `consumo_ia`: valores não negativos; câmbio, se conhecido, estritamente positivo; fim posterior ao início; índice `(periodo_inicio, periodo_fim)`. Referência externa deduplica importação. Proposta: registros incrementais não sobrepostos por fonte; fonte real e política de reconciliação pendentes. Somar USD e converter cada registro pela cotação registrada; sem fonte/cotação confiável retorna indisponível, nunca gasto zero inventado. Mês em São Paulo.
- Todas as FKs usam `ON DELETE RESTRICT`; exclusão/retenção de dados sensíveis exige política aprovada, sem cascata silenciosa.

## Config: todas as chaves e padrões

Uma linha por chave; `valor` sempre JSON válido para o tipo. O banco hidrata chaves ausentes com os mesmos padrões do contrato, mas rejeita chaves desconhecidas e valores nulos. Não armazenar credenciais em config. Alterações atômicas, auditadas e validadas no banco. Valores zero/vazio abaixo indicam não configurado, sem inferir valores reais do consultório.

| Chave | Tipo do valor JSON | Padrão |
| --- | --- | --- |
| `fuso_horario` | string literal | `"America/Sao_Paulo"` |
| `horarios_atendimento` | objeto de arrays de `{inicio,fim}` HH:mm | `{"segunda":[],"terca":[],"quarta":[],"quinta":[],"sexta":[],"sabado":[],"domingo":[]}` |
| `duracoes_por_tipo` | objeto tipo → minutos inteiros positivos | `{}` |
| `teto_pacientes_novos_semana` | inteiro não negativo | `0` |
| `antecedencia_minima_minutos` | inteiro não negativo | `0` |
| `confirmacao_ativa` | boolean | `false` |
| `confirmacao_antecedencia_horas` | inteiro não negativo | `0` |
| `confirmacao_horario` | string HH:mm ou vazio desativado | `""` |
| `pausa_agente_minutos` | inteiro positivo | `30` (padrão técnico proposto, confirmar) |
| `agente_ativo` | boolean | `false` |
| `agenda_ativa` | boolean | `false` |
| `campanha_pausada` | boolean | `true` |
| `canal_urgencia` | objeto com tipo e destino | `{"tipo":"nao_configurado","destino":""}` |
| `teto_gasto_ia_brl` | número não negativo | `0` |
| `consumo_fonte` | string | `""` |
| `cambio_fonte` | string | `""` |
| `cambio_usd_brl` | número não negativo; zero indisponível | `0` |

Validar faixas ordenadas, sem sobreposição, fim posterior ao início; proibir ativação da agenda sem catálogo e horários. Teto zero significa nenhuma vaga nova. Não ativar confirmação sem antecedência/horário válidos. Ativar agente exige canal de urgência e política de gasto configurados; teto de gasto zero não significa ilimitado. A cotação configurada só poderá ser fallback manual explícito, com auditoria; não representa cotação atual. Nenhuma dessas regras é duplicada no front ou no n8n.

## RPCs n8n — assinaturas SQL propostas

Nomes/parâmetros do brief preservados. Tipos `text` de enum são validados no banco. Datas em `timestamptz`, nunca texto ambíguo. Retornos JSON incluem campos documentados, sem erros SQL crus expostos ao painel.

```sql
contexto_paciente(p_telefone text) RETURNS jsonb
registrar_mensagem(p_telefone text, p_direcao text, p_autor text,
  p_texto text, p_tipo text, p_transcricao text, p_midia_url text,
  p_wa_message_id text) RETURNS public.mensagens
buscar_conhecimento(p_pergunta text) RETURNS SETOF public.base_conhecimento
horarios_livres(p_tipo text, p_a_partir_de timestamptz, p_limite integer)
  RETURNS jsonb
criar_agendamento(p_telefone text, p_tipo text, p_inicio timestamptz,
  p_origem text, p_observacao text) RETURNS public.agendamentos
escalar_conversa(p_telefone text, p_motivo text, p_urgente boolean)
  RETURNS jsonb
```

`contexto_paciente`: `{paciente, conversa, agente_pausado, mensagens, proximo_agendamento, config}`. Cria paciente (nome técnico `Contato sem nome`, origem whatsapp) e conversa se necessário, sob lock por telefone/constraints únicas. Devolve últimas 20 mensagens em ordem cronológica; próximo agendamento sugerido/confirmado futuro ou null. Pausa efetiva se prazo futuro ou bloqueio global do agente. Ao expirar, normaliza status assumida/escalada para ativa; n8n decide pelo boolean retornado, jamais por relógio próprio. Configuração global desativada continua impedindo respostas.

`registrar_mensagem`: `wa_message_id` obrigatório nessa RPC, deduplica por identificador e retorna a mensagem existente sem novo efeito; payload incompatível com identificador já usado causa conflito. Atualiza contato, cria contexto quando necessário e preserva autoria. Painel registra mensagem pendente antes de pedir envio; após confirmação, n8n associa o identificador WhatsApp ao mesmo registro (sem duplicar). Protocolo de correlação pendente.

`horarios_livres`: `{horarios: [{inicio,fim}], motivo: null | 'teto_semanal' | 'nao_configurado' | 'sem_horarios'}`; limite inteiro entre 1 e 100. Busca na semana civil de `p_a_partir_de`; se teto dessa semana esgotou, lista vazia e motivo `teto_semanal`. Por não receber paciente, assume vaga para paciente novo; consultas futuras mudam a semana explicitamente. Toda criação revalida regras e calcula fim no banco.

`escalar_conversa`: `{conversa, canal_urgencia, notificar}`; marca urgência, status e prazo segundo config. Canal ausente: retorna destino não configurado e `notificar: false`, sem inventar destino. O disparo ao canal é responsabilidade do n8n.

RPCs internas adicionais para o painel: `assumir_conversa(p_conversa_id uuid, p_ate timestamptz DEFAULT NULL) RETURNS public.conversas`, `devolver_para_ia(p_conversa_id uuid) RETURNS public.conversas`, `criar_bloqueio(p_inicio timestamptz,p_fim timestamptz) RETURNS public.bloqueios`, `confirmar_sugestao(p_agendamento_id uuid) RETURNS public.agendamentos`, `marcar_falta(p_agendamento_id uuid) RETURNS public.agendamentos`, `salvar_config(p_alteracoes jsonb) RETURNS jsonb`. Escrever config e conhecimento sempre aciona auditoria.

## Rotas previstas em app/api/

Todas são propostas para Fase 2; cada caminho corresponde a `app/api/<caminho>/route.ts`. GETs privados sem cache compartilhado; mutações validam origem, sessão, corpo e erros.

| Método e rota | Contrato/efeito |
| --- | --- |
| GET `/api/conversas` | `listarConversas`, filtros e paginação |
| GET `/api/conversas/[id]` | `abrirConversa` |
| POST `/api/conversas/[id]/assumir` | `assumirConversa`, prazo opcional derivado de config |
| POST `/api/conversas/[id]/devolver` | `devolverParaIA` |
| POST `/api/conversas/[id]/mensagens` | `enviarMensagem`, único webhook n8n de saída |
| GET `/api/pacientes/[id]` | `buscarPaciente` |
| PATCH `/api/pacientes/[id]/observacao` | `salvarObservacao` |
| GET `/api/agenda/dia`, `/api/agenda/semana` | agenda e bloqueios, contador semanal |
| POST `/api/agenda/bloqueios` | `criarBloqueio` |
| POST `/api/agendamentos/[id]/confirmar`, `/api/agendamentos/[id]/falta` | confirmar sugestão / falta |
| GET, POST `/api/conhecimento` | listar / criar conhecimento |
| PUT `/api/conhecimento/[id]` | editar/ativar/desativar conhecimento |
| GET `/api/campanha` | `statusCampanha` |
| POST `/api/campanha/pausar`, `/api/campanha/retomar` | alterar config auditada |
| GET, PATCH `/api/config` | ler / salvar config |
| GET `/api/consumo` | `consumoDoMes` |
| POST `/api/auth/magic-link` | solicitar link para conta autorizada, resposta genérica |
| GET `/api/auth/callback` | validar troca do código, gravar cookies e redirecionar localmente |
| POST `/api/auth/sair` | encerrar sessão |

Realtime de mensagens/conversas encapsulado dentro de `lib/api.ts`, com cliente autenticado e RLS; componentes nunca importam Supabase. Cada evento provoca obtenção de retrato atualizado para manter o contrato de callbacks. Sem canal público ou service role no navegador. Na troca de sessão/saída, cancelar inscrições.

Envio: rota autentica e valida posse da conversa/pausa, persiste mensagem e chave de correlação, chama webhook privado n8n com segredo e timeout. Só n8n acessa WhatsApp. Para retries usar a mesma chave de correlação; retorno de sucesso exige confirmação de gravação/envio, e resposta ambígua exige reconciliação no fluxo. O acordo de ACK, deduplicação e associação de `wa_message_id` deve ser aprovado antes da implementação.

## Autenticação e proteção

Magic link Supabase Auth, usuário único previamente provisionado, cadastro público desativado (`shouldCreateUser: false`). E-mail permitido só no servidor; tabela privada `conta_autorizada` contém UUID dessa conta. Proteção de sessão na camada de middleware e nova verificação em cada rota. Na versão instalada do Next.js 16, a convenção indicada pelos guias locais é `proxy.ts` (substitui `middleware.ts`); a mudança de nome está avisada em PEDIDOS, sem criar nenhum arquivo nesta fase. Usar runtime Node e cookies SSR, validar identidade com Supabase, não confiar apenas no cookie.

RLS em todas as tabelas, inclusive config, eventos, consumo e conta autorizada. Políticas exigem `auth.uid()` igual à conta registrada, via função de autorização com search_path fixo e permissões mínimas; sem política genérica para qualquer usuário authenticated. `anon` sem acesso aos dados. Eventos somente leitura para o painel; conta autorizada não editável pelo painel. Funções privilegiadas têm EXECUTE revogado de PUBLIC/anon, search_path fixo e checagem explícita do chamador. RPCs n8n restritas a service_role; RPCs do painel restritas à conta autorizada. n8n usa service role apenas no servidor. Publicação Realtime limitada a mensagens/conversas e protegida por RLS.

Segredos em ambiente; nenhum corpo de mensagem, token, observação clínica ou mídia vai para logs/analytics externos. Logs técnicos, se necessários, limitados a código e correlação opaca. Auditoria fica no Postgres. Retenção e backup aguardam definição. A lista de pendências também inclui aprovação das adições ao esquema e políticas propostas.
