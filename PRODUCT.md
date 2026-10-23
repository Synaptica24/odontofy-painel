# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind 4, Supabase (Postgres, Auth, Realtime), deploy na Vercel. Decidido pelo dono do projeto no brief (docs/BRIEF-FRONTEND.md, docs/BRIEF-BACKEND.md).

## Users

Um dentista, 30 e poucos anos, não técnico, que atende sozinho no consultório. Abre o painel no celular entre um paciente e outro, com uns 40 segundos livres e pressa. Também abre à noite (22h) em casa. Desktop é secundário.

Segundo público (indireto): colegas dentistas a quem ele mostra o painel. O painel é a prova de valor do projeto que o dono (Gabriel) vendeu.

## Product Purpose

Uma IA de atendimento em n8n responde o WhatsApp do consultório enquanto o dentista está com a mão na boca de um paciente. O painel é onde ele vê o que a IA fez, assume uma conversa quando quer, aprova sugestões de agenda, edita o que a IA responde e controla a campanha de retorno.

Sucesso, critério de aceite do projeto inteiro: em 40 segundos, no celular, ele descobre se precisa fazer alguma coisa agora e faz.

## Positioning

Não é um SaaS nem um CRM odontológico. É a ferramenta de trabalho de uma pessoa, para um consultório, sem multi-tenant, sem planos, sem permissões. O mecanismo é a IA no WhatsApp; o painel existe para o dentista confiar nela e mandar nela.

## Operating Context

- WhatsApp do consultório é o canal do paciente. Toda mensagem, em qualquer direção, existe no banco.
- Codental é o sistema clínico atual (prontuário, financeiro, radiografia) e fica fora do painel; não tem API pública.
- Memed cuida de receita e assinatura digital; fica fora.
- Campanha de retorno: 166 pacientes sem consulta há mais de 6 meses, enviada em levas.
- Fuso America/Sao_Paulo. Tudo em português do Brasil.

## Capabilities and Constraints

Telas: Hoje (inicial), Conversas (lista e thread, assumir / devolver para a IA), Paciente, Agenda (dia e semana, sugestões da IA, bloqueios, faltas, contador de pacientes novos na semana contra o teto), "O que a IA responde" (base de conhecimento, tratada como tela principal), Campanha de retorno, Ajustes (salva sozinho), Consumo de IA (reais e dólar).

Não construir: prontuário, odontograma, evolução clínica, financeiro, estoque, radiografia, receita, multiusuário, permissões, onboarding, tour guiado, tema customizável, exportar PDF.

Restrições técnicas: o front só fala com `lib/api.ts` (contrato do backend, dono Codex); nunca com Supabase direto. Pastas do front: `app/(painel)/`, `components/`, `styles/`. Abrir em menos de 2 s no 4G. Claro e escuro. `prefers-reduced-motion` respeitado.

Terminologia: "assumir" (dentista pausa a IA e responde), "devolver pra IA", "escalada" (conversa que a IA passou para ele), "sugestão" (agendamento proposto pela IA esperando aprovação), "teto" (limite semanal de pacientes novos; número a favor dele, não meta), "leva" (lote da campanha).

Nome confirmado pelo dono em 2026-09-17: Dr. Mateus Peixoto; o consultório tem o mesmo nome. Logo ou identidade prévia: não informado.

## Brand Commitments

Direção pinada pelo brief: ferramenta de uma pessoa, calma, densa onde precisa, silenciosa onde não. Consultório, não hospital: pode ter calor, mas dado clínico e nome de paciente pedem sobriedade, sem cor decorativa em cima. Uma cor de alerta só, usada com avareza. Proibido: menu lateral com doze itens, dashboard de cards genéricos, gradiente roxo, ilustração de estoque.

Nome: Dr. Mateus Peixoto (dentista e consultório). Direção visual escolhida em 2026-09-17 depois de quatro re-sorteios: Quadro branco com ímãs (seed impeccable bb4443cd, re-roll 3, pick). Rumo dado pelo dono: bordas arredondadas, muito branco, um pouco de brincadeira; vermelho continua sendo a única cor de alerta. Sem logo informado.

## Evidence on Hand

Nenhum dado real disponível nem permitido: dados de saúde (LGPD). Toda fixture é obviamente fictícia ("Paciente Teste 01", +55 11 90000-00xx). Nada de nome ou telefone com cara de real, nem em screenshot.

## Product Principles

1. Uma pergunta por tela; a tela Hoje responde só "preciso fazer alguma coisa agora?".
2. Sempre óbvio, sem ler texto, quem está respondendo: a IA ou ele.
3. Vermelho é ação imediata; se aparece sempre, deixa de ser visto.
4. Ação otimista com desfazer, nunca confirmação prévia; retorno visível em menos de 100 ms.
5. Estado vazio é boa notícia e é tela; carregamento não pula layout; erro diz o que houve e o que fazer e nunca perde o que foi digitado.

## Accessibility & Inclusion

Alvos de toque grandes, sem hover como único caminho, sem tabela que rola para o lado no celular. Animação curta (150–250 ms) e com propósito, respeitando `prefers-reduced-motion`. Contraste de texto ≥ 4.5:1 nos dois temas.
