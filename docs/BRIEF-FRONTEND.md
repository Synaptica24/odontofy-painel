# Prompt para o CLAUDE CODE — front-end e design

Você é responsável pelo FRONT-END do painel de gestão de um consultório
odontológico. O Codex está construindo o backend em paralelo e já publicou
`lib/contratos.ts` e `lib/api.ts` — construa em cima dessas funções tipadas,
mesmo enquanto elas ainda devolvem fixture. Nunca fale com o Supabase direto.

DONO DE PASTA
Sua: app/(painel)/, components/, styles/.
Do Codex: supabase/, lib/, app/api/, middleware.ts. Não edite.
Precisa de um campo ou de uma função que não existe? Peça, não improvise
consulta própria.

=====================================================================
1. ANTES DE DESENHAR QUALQUER TELA
=====================================================================
Carregue e siga, nesta ordem:
- a skill `impeccable` — direção visual, hierarquia, densidade, anti-padrões
- a skill `emil-design-eng` — polimento, micro-interação, o que faz software
  parecer bem-feito
- a skill `ask-sonner` — para toast e feedback de ação
- a skill `stop-slop` — passe TODO texto de interface por ela antes de commitar.
  O usuário lê cada palavra dessa tela todo dia; texto com cara de IA em
  produto de saúde queima confiança rápido.

Não comece pelas telas. Comece pelo sistema: tipografia, escala de espaço,
cor, estados. Depois as telas caem sozinhas.

=====================================================================
2. QUEM VAI USAR
=====================================================================
Um dentista, 30 e poucos anos, não técnico, abrindo no CELULAR entre um
paciente e outro, com 40 segundos livres e pressa. Desktop é secundário.

O critério de aceite do projeto inteiro é esse: em 40 segundos, no celular, ele
descobre se precisa fazer alguma coisa agora — e faz.

Se a tela for bonita e ele não conseguir isso, ela está errada. Se for feia e
ele conseguir, ainda está errada: este painel é a prova de valor do
projeto que ele pagou, e é o que ele vai mostrar pros colegas que eu quero como
próximos clientes.

=====================================================================
3. DIREÇÃO
=====================================================================
É uma ferramenta de trabalho de uma pessoa, não um SaaS. Nada de menu lateral
com doze itens, nada de dashboard de cards genéricos, nada de gradiente roxo,
nada de ilustração de estoque. Calmo, denso onde precisa, silencioso onde não.

Consultório, não hospital: pode ter calor. Mas informação clínica e nome de
paciente pedem sobriedade — sem cor decorativa em cima de dado clínico.

Uma cor de alerta só, usada com avareza: quando aparecer vermelho, ele
precisa agir agora. Se vermelho aparece o tempo todo, ele para de ver.

Claro e escuro, os dois. Ele abre isso às 22h também.

=====================================================================
4. AS TELAS
=====================================================================
4.1 HOJE — a inicial. Responde UMA pergunta: "preciso fazer alguma coisa
    agora?". No topo, o que exige ele: conversas escaladas e urgentes. Depois
    agenda do dia, contatos novos das últimas 24h, quantas mensagens a IA
    respondeu hoje. Nada mais. A tentação de encher essa tela é o maior risco
    de design do projeto.

4.2 CONVERSAS — lista com filtro (escaladas, ativas, todas): nome, prévia,
    hora. Mensagem nova aparece sem refresh (inscreverEmConversas).
    Dentro: a thread inteira com data, quem falou (paciente, IA, ele), áudio
    com transcrição do lado. Botão ASSUMIR, que pausa a IA naquele contato e
    libera o campo de resposta, com o prazo da pausa visível. Botão DEVOLVER
    PRA IA. Deixe sempre óbvio, sem ler texto, se quem está respondendo agora
    é a IA ou ele.

4.3 PACIENTE — dados, origem, status, todas as conversas, agendamentos
    passados e futuros, campo de observação livre. Link direto por paciente.

4.4 AGENDA — dia e semana. Sugestões da IA esperando aprovação, em destaque.
    Bloquear horário, marcar falta, remarcar. Contador de pacientes novos na
    semana contra o teto, visível — ele quer atender MENOS, esse número é a
    favor dele, não uma meta a bater.

4.5 "O QUE A IA RESPONDE" — é a base_conhecimento, mas nunca chame assim na
    interface. Lista de pergunta e resposta, editar, ativar, desativar.
    Esta tela é o que faz ele parar de depender de mim: trate como tela
    principal, não como configuração escondida. Editar uma resposta tem que ser
    tão fácil quanto responder uma mensagem.

4.6 CAMPANHA DE RETORNO — 166 pacientes sem consulta há mais de 6 meses, em
    levas. Na fila, enviadas, respondidas, agendadas, erro. Botão de pausar
    grande e sempre visível, em qualquer scroll.
    Não mostre "taxa de conversão". Mostre "X pessoas voltaram a marcar".

4.7 AJUSTES — horário dia a dia, duração por tipo, teto de pacientes novos por
    semana, antecedência mínima, antecedência e horário da confirmação, canal
    de urgência, teto de gasto de IA. Formulário que salva sozinho, com
    confirmação discreta. Nada de modal de "deseja salvar?".

4.8 CONSUMO — gasto de IA no mês contra o teto. O crédito está no
    nome dele: essa conta é DELE. Em reais e em dólar, com data da última
    atualização. Gráfico só se ele mudar uma decisão; senão, um número grande
    e honesto basta.

=====================================================================
5. O QUE SEPARA ISSO DE UM CRUD
=====================================================================
- Estado vazio é tela, não texto cinza no meio do nada. "Nenhuma conversa
  escalada" é uma boa notícia — mostre como boa notícia.
- Estado de carregamento não pula layout. Skeleton com a forma do conteúdo
  real, nunca spinner centralizado.
- Erro diz o que houve e o que fazer, em português de gente, e nunca perde o
  que ele digitou.
- Ação otimista com desfazer, não confirmação prévia. Ele está com pressa.
- Toda ação tem retorno visível em menos de 100ms, mesmo que a rede demore.
- Animação com propósito e curta (150–250ms), respeitando prefers-reduced-motion.
  Se a animação chama atenção pra si mesma, está errada.
- Alvo de toque grande, sem hover como único caminho, sem tabela que rola pro
  lado no celular.
- Abre em menos de 2 segundos no 4G.

=====================================================================
6. NÃO CONSTRUIR
=====================================================================
Prontuário, odontograma, evolução clínica, financeiro, estoque, radiografia
(fica no Codental). Receita e assinatura digital (fica na Memed). Multiusuário,
permissões, onboarding, tour guiado, tema customizável, exportar relatório em
PDF. Nada que ninguém pediu.

=====================================================================
7. COMO TRABALHAR
=====================================================================
Antes de construir tela, me mostre a direção: tipografia, cor, espaço, e a tela
HOJE em dois caminhos diferentes pra eu escolher. Depois disso você segue
sozinho.
Nenhum dado de exemplo com cara de real: paciente fictício tem nome e telefone
fictício. É dado de saúde de gente de verdade que vai entrar aqui.
