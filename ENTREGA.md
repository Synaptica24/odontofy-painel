# Entrega: site + painel do Dr. Mateus Peixoto

Atualizado em 2026-10-23. Decisões tomadas sem consulta estão em `DECISOES.md`.

## Endereços

| O quê | Onde |
| --- | --- |
| Site (público) | https://dr-mateus-peixoto.vercel.app |
| Entrar no painel | https://dr-mateus-peixoto.vercel.app/entrar |
| Supabase (banco, usuários, arquivos) | https://supabase.com/dashboard/project/jvaiwbancxkrbomjevix |

## Como o Dr. acessa
1. Abre `/entrar` no celular ou no computador.
2. E-mail e senha provisórios: `dr.mateus@consultorio.local`; a senha está em `DR_SENHA_INICIAL` no `.env.local` (nunca neste arquivo nem no repositório).
3. **Antes de entregar**: troque o e-mail para o dele em `AUTH_EMAIL_PERMITIDO` (no `.env.local` e na Vercel) e rode `node supabase/scripts/criar-usuario.mjs` com `DR_EMAIL` e `DR_SENHA_INICIAL` definidos. Depois apague a senha provisória do `.env.local`.
4. Ele começa no consultório **real**, vazio. A demonstração (dados fictícios) fica no menu **Conta → Demonstração**; uma faixa amarela avisa quando ela está ativa.

## O que ficou pronto

**Site** (`app/(site)`, textos e dados em `config/site.ts`)
- Hero, para quem é, tratamentos (cartões que inclinam e abrem com abas), sobre, primeira consulta, antes e depois com comparador de arrastar, depoimentos em baralho, FAQ, localização e CTA final.
- Botão flutuante do WhatsApp com mensagem pronta; eventos para Meta Pixel e Google Analytics.
- SEO local, Open Graph (prévia bonita no WhatsApp), sitemap, robots e dados estruturados de dentista.
- Fonte SF Pro Display/Text nos aparelhos Apple, Inter nos demais.

**Painel**
- Barra superior com Hoje, Agenda, Pacientes, Financeiro e Conversas, busca de paciente, sino e menu da conta.
- Agenda semanal por profissional: minicalendário, Dia/Semana, blocos por estado (agendado, confirmado, sugerido, faltou, bloqueado), chip de convênio, clique no vazio marca, clique no bloco abre, Shift + clique bloqueia.
- Pacientes com cadastro completo; ficha com anamnese, odontograma (11 a 48, por face), evolução que só aceita acréscimo, anexos privados, orçamentos, contratos, consultas e trilha de acesso.
- Contratos: modelos com variáveis ({{nome_paciente}}, {{cpf}}, {{tratamento}}, {{valor}}, {{data}}…), PDF, link de assinatura no celular (desenho + nome + CPF + data/hora + IP) e PDF assinado guardado no prontuário. Estrutura pronta para ZapSign/Clicksign.
- Financeiro: previsto e realizado, comparecimento, confirmações, retornos com botão de WhatsApp, orçamentos (pendente, aprovado, recusado) e faltas.
- Hoje: faturamento previsto do dia e taxa de comparecimento.
- Segurança: RLS em todas as tabelas, cada consultório só vê o seu, chave secreta só no servidor, trilha de quem viu e alterou prontuário.

## Placeholders para trocar (`config/site.ts`)
`[CRO]`, `[CIDADE]`, `[BAIRRO]`, `[ENDEREÇO]`, `[CEP]`, `[WHATSAPP]` (só dígitos com 55), `[(DDD) 9 9999-9999]`, `[@INSTAGRAM]`, `[E-MAIL]`, `mapsUrl`, fotos (`[FOTO DO DR.]`, `[FOTO DO CONSULTÓRIO]`), horários, prova social, IDs do Pixel e do Analytics, `[HISTÓRIA DO DR.]`, `[FORMAÇÃO]`, `[ESPECIALIZAÇÃO]`, valores e convênios do FAQ. Depoimentos e antes/depois estão marcados como EXEMPLO.

## Roteiro de apresentação (5 minutos)
1. **Site no celular (1 min 30)**: abrir o link como quem vem do Instagram. Mostrar o hero, tocar num tratamento, arrastar o antes e depois, passar os depoimentos, abrir uma dúvida do FAQ e tocar no WhatsApp: a mensagem já vem escrita.
2. **Entrar no painel (15 s)**: `/entrar`, e-mail e senha. Trocar para **Demonstração** no menu Conta.
3. **Hoje (30 s)**: faturamento previsto, comparecimento, quem está esperando resposta.
4. **Agenda (1 min)**: semana com blocos coloridos e convênio. Clicar num horário vazio e marcar uma consulta; abrir um bloco e confirmar ou marcar falta.
5. **Ficha do paciente (1 min)**: anamnese com alertas, clicar num dente do odontograma, adicionar uma evolução, mostrar anexos e o orçamento.
6. **Contrato (45 s)**: gerar o termo a partir do modelo, enviar o link, abrir no celular e assinar com o dedo; voltar e mostrar o PDF assinado na ficha.
7. **Fechamento (15 s)**: voltar ao consultório real, vazio e pronto para uso.
