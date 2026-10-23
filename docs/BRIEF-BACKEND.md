# Prompt para o CODEX — backend, banco e contrato

Você é responsável pelo BACKEND do painel de gestão de um consultório
odontológico de um dentista só. Outro agente (Claude Code) constrói o
front-end em paralelo, contra o contrato que você publica. Leia tudo antes da
primeira linha. Onde estiver [PREENCHER], não invente: pare e pergunte.

=====================================================================
0. SUA PRIMEIRA ENTREGA, ANTES DE QUALQUER OUTRA COISA
=====================================================================
Na primeira hora, publique `lib/contratos.ts` (tipos) e `lib/api.ts` (funções
com implementação stub devolvendo fixture óbvia de mentira). O front-end
começa a trabalhar em cima disso imediatamente e não pode ficar esperando o
banco existir.

Depois disso, troque os stubs por implementação real SEM mudar assinatura. Se
uma assinatura precisar mudar, avise antes — tem gente construindo em cima.

DONO DE PASTA
Sua: supabase/, lib/, app/api/, middleware.ts, tipos gerados.
Do Claude: app/(painel)/, components/, styles/.
Não edite a pasta dele. Se precisar de algo lá, peça.

=====================================================================
1. CONTEXTO
=====================================================================
O dentista atende sozinho. Enquanto está com a mão na boca de um paciente,
chega mensagem no WhatsApp do consultório e ninguém responde. Uma IA de
atendimento construída em n8n passou a responder por ele.

Este painel é onde ele vê o que a IA fez, assume a conversa quando quer e
manda no comportamento dela. Um usuário só. Um consultório só. Sem multi-tenant,
sem planos, sem permissões.

=====================================================================
2. STACK
=====================================================================
Next.js (App Router) + TypeScript + Supabase (Postgres, Auth, Realtime),
deploy na Vercel. Auth por magic link, uma conta, sem tela de cadastro.
Tudo em português do Brasil, fuso America/Sao_Paulo, inclusive no banco.

=====================================================================
3. SCHEMA (você é o dono)
=====================================================================
pacientes            id, nome, telefone_e164 (único), origem
                     (whatsapp|site|campanha|indicacao), codental_id (texto,
                     opcional), primeiro_contato, ultimo_contato, status
                     (novo|em_conversa|agendado|paciente|fora_da_base),
                     observacoes, nao_perturbe (bool)
conversas            id, paciente_id, iniciada_em, encerrada_em, status
                     (ativa|escalada|assumida|encerrada), motivo_escalonamento,
                     resumo_gerado, agente_pausado_ate (timestamptz)
mensagens            id, conversa_id, direcao (entrada|saida), autor
                     (paciente|agente|dentista), texto, tipo
                     (texto|audio|imagem|documento), transcricao, midia_url,
                     wa_message_id (único), criada_em
agendamentos         id, paciente_id, tipo, inicio, fim, status
                     (sugerido|confirmado|cancelado|faltou), confirmado_em,
                     origem (agente|painel), observacao
campanha_envios      id, paciente_id, leva, enviada_em, status
                     (fila|enviada|respondida|erro|bloqueada), respondida_em,
                     erro
base_conhecimento    id, pergunta, resposta, palavras_chave text[], ativo
regras_escalonamento id, gatilho, acao, ativo
config               chave, valor jsonb
eventos              id, tipo, payload jsonb, criado_em

Migrações versionadas. RLS ligado em tudo: n8n usa service role, o painel usa o
usuário logado. Realtime publicado em `mensagens` e `conversas`.

=====================================================================
4. CONTRATO QUE O n8n CONSOME (nomes exatos, não mude sem avisar)
=====================================================================
contexto_paciente(p_telefone)
  → paciente (cria se não existir), conversa ativa, agente_pausado (bool),
    últimas 20 mensagens, próximo agendamento e o `config` inteiro. UMA
    chamada: o n8n não pode precisar de três round-trips pra responder.

registrar_mensagem(p_telefone, p_direcao, p_autor, p_texto, p_tipo,
                   p_transcricao, p_midia_url, p_wa_message_id)
  → idempotente por wa_message_id.

buscar_conhecimento(p_pergunta)
  → linhas ativas ordenadas por relevância.

horarios_livres(p_tipo, p_a_partir_de, p_limite)
  → respeita horário de atendimento, bloqueios, duração por tipo, antecedência
    mínima e o TETO DE PACIENTES NOVOS POR SEMANA vindo de `config`. Teto
    estourado devolve vazio com motivo 'teto_semanal'.

criar_agendamento(p_telefone, p_tipo, p_inicio, p_origem, p_observacao)
  → revalida teto e conflito. Nunca confie que o chamador validou.

escalar_conversa(p_telefone, p_motivo, p_urgente)
  → marca escalada, pausa o agente, devolve para onde avisar.

REGRA DE OURO: toda regra de agenda mora no banco, nunca no n8n e nunca no
front. Se a mesma regra existir em dois lugares, um dia eles discordam e o
paciente marca num horário que não existe.

=====================================================================
5. CONTRATO QUE O FRONT-END CONSOME (lib/api.ts)
=====================================================================
Funções tipadas, nomes em português, erro tratado, nada de o front falar com o
Supabase direto. No mínimo:

listarConversas(filtro)            assumirConversa(conversaId, ate)
abrirConversa(id)                  devolverParaIA(conversaId)
enviarMensagem(conversaId, texto)  buscarPaciente(id)
salvarObservacao(pacienteId, txt)  agendaDoDia(data) / agendaDaSemana(inicio)
criarBloqueio(inicio, fim)         confirmarSugestao(agendamentoId)
marcarFalta(agendamentoId)         listarConhecimento() / salvarConhecimento()
statusCampanha()                   pausarCampanha() / retomarCampanha()
lerConfig() / salvarConfig()       consumoDoMes()
inscreverEmConversas(cb)           inscreverEmMensagens(conversaId, cb)

enviarMensagem NÃO fala com o WhatsApp. Ela chama o webhook de envio do n8n
(rota em app/api/, segredo em variável de ambiente). Um único ponto de saída
pro WhatsApp, senão o histórico racha em dois.

assumirConversa preenche `agente_pausado_ate` com prazo vindo de `config`.
Expirou, a IA volta sozinha — senão ele assume no sábado, esquece, e o
consultório fica mudo na segunda.

=====================================================================
6. NÃO NEGOCIÁVEL
=====================================================================
- Dados de saúde são sensíveis pela LGPD. Conversa de paciente não vai pra log
  de terceiro nem pra analytics. Credencial fora do repositório.
- Toda mensagem, em qualquer direção, existe em `mensagens`. Se não está no
  banco, não aconteceu.
- Toda edição em base_conhecimento e config grava em `eventos`, com data.
- `config` tem valor padrão pra tudo. Nada pode quebrar por campo nulo.
- Nenhum dado de exemplo com cara de real. Fixture tem que ser obviamente
  fictício.
- O Codental (sistema atual do consultório) não tem API pública. Não escreva
  integração especulativa com ele.

=====================================================================
7. COMO TRABALHAR
=====================================================================
Antes de codar: modelo de dados final, lista de rotas e o que você precisa de
mim que não está aqui. Não comece sem isso aprovado.
Entregue migrações versionadas e um README curto em português: como rodar, como
mexer no `config`, o que ficou pendente. Pendência escrita é pendência; pendência
na cabeça não existe.
