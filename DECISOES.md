# Decisões tomadas sem perguntar

Registro das escolhas feitas durante a entrega de 2026-10-23 (site + painel). Cada item diz o que foi decidido e por quê. Se alguma estiver errada, é só reverter.

## Infra
- **Supabase não tinha chaves no `.env.local`** (só havia o token da Vercel). Criei um projeto novo na organização "team agents": `dr-mateus-peixoto`, região São Paulo (`sa-east-1`), ref `jvaiwbancxkrbomjevix`. URL, chave anon, service role e senha do banco estão no `.env.local` (não versionado). Painel: https://supabase.com/dashboard/project/jvaiwbancxkrbomjevix.
- **Login por e-mail e senha** além do magic link: o magic link depende de entrega de e-mail (SMTP) que ainda não existe; senha funciona na hora. O e-mail inicial do Dr. é `dr.mateus@consultorio.local` (placeholder). Para trocar: ajuste `AUTH_EMAIL_PERMITIDO` no `.env.local` e na Vercel e rode `node supabase/scripts/criar-usuario.mjs`.
- **Toquei em pastas do Codex** (`supabase/`, `lib/`, `app/api/`, `proxy.ts`): o pedido desta rodada cobre backend e front, o MCP do Codex estava fora do ar e a entrega precisava funcionar de ponta a ponta. Anotado em `docs/PEDIDOS.md`.

## Site
- **Sem fotos reais e sem geração de imagem**: o Arcads estava sem créditos e não há chave do Gemini. As fotos são molduras tonais com rótulo (`[FOTO DO DR.]`, `[FOTO DO CONSULTÓRIO]`), trocáveis em `config/site.ts`. Antes/depois usa duas imagens SVG de exemplo marcadas "EXEMPLO".
- **Componentes do bencho.dev** não têm instalação por pacote (são blocos para copiar e a página é renderizada por JS). Reescrevi em `components/site/` as ideias de Image compare (arrasto com "flick" que desliza até a borda), FAQ accordion, Swipe deck (depoimentos), Text rise/Text blur (títulos) e Tilt card (tratamentos), com `motion` e CSS, no visual do site.
- **Skills `break-ui` e `mobile-native` não existem nesta máquina**. Usei `emil-design-eng`, `animate` e `apple-design` para o motion; a revisão de quebra de layout foi feita no Chrome (desktop e celular) com a checklist da `impeccable`.
- **Paleta**: off-white `#F4F1EA`, grafite `#1F1E1B`, destaque terracota `#B5502A`. Serifa `Instrument Serif` nos títulos, `Inter` no texto.
- **Cidade/bairro** aparecem como `[CIDADE]` e `[BAIRRO]` no texto e no SEO (`dentista em [CIDADE]`); trocar em `config/site.ts`.
- **Eventos**: `lib/site/eventos.ts` dispara `fbq('track','Contact')` e `gtag('event','clique_whatsapp')` quando os scripts existem, e sempre empurra para `dataLayer`. IDs em `config/site.ts` (`metaPixelId`, `gaId`); vazios = scripts não carregam.
- **Raiz `/` é o site.** O painel continua em `/hoje`, `/agenda` etc. `app/page.tsx` (que redirecionava para uma rota inexistente `/direcao/a`) foi removido.

## Painel
- A barra superior passa a ter **Hoje · Agenda · Pacientes · Financeiro · Conversas**. "IA responde", Campanha, Consumo e Ajustes ficam no menu da conta.
- **Multi-consultório**: tabela `consultorios` + `membros`; cada tabela de dados tem `consultorio_id`, com RLS por participação. O Dr. é membro do consultório real; a demo é outro consultório ("Demonstração") no mesmo banco, com dados fictícios, trocado pelo menu da conta. A separação é real (RLS), não só visual.
- **Profissionais**: tabela `profissionais` (o Dr. é o primeiro). A agenda semanal mostra um profissional por vez.
- **Convênios**: lista livre por consultório (`convenios`), vinculada ao paciente e ao agendamento; chip no bloco da agenda.
- **Evolução clínica** é append-only (trigger impede update/delete); correção é um registro novo apontando para o anterior.
- **Anexos**: bucket privado `prontuario`, caminho `consultorio/paciente/arquivo`; URLs assinadas por 10 minutos.
- **Contratos**: PDF gerado no servidor com `pdf-lib` (sem navegador headless). Assinatura por link público com token de 48h; o PDF assinado recebe página final com nome, CPF, data/hora, IP e a assinatura desenhada, e é guardado no bucket `contratos`. A interface `ProvedorAssinatura` em `lib/servidor/assinatura.ts` deixa o encaixe de ZapSign/Clicksign pronto.
- **Confirmação automática**: sem WhatsApp API configurada, a confirmação gera a mensagem e abre o WhatsApp (wa.me) com texto pronto; quando o webhook n8n existir, a rota `/api/cron/confirmacoes` passa a enviar sozinha (Vercel Cron).

## Rodada de revisão (2026-10-23, tarde)
- **Fonte do site trocada para SF Pro Display/Text** a pedido do Gabriel. A Apple não permite embutir a SF Pro em sites, então o site pede a fonte do sistema: iPhone, iPad e Mac mostram a SF Pro de verdade; Android e Windows mostram a Inter (já carregada, desenho muito próximo). A serifada Instrument Serif saiu. O destaque em terracota nos títulos virou só cor, sem itálico.
- **Correções da revisão de código:** assinatura pública não sobrescreve PDF em clique duplo nem responde "assinado" se perdeu a corrida; Financeiro calcula o último dia real do mês; a demonstração pode ser recriada quantas vezes quiser (migrations 0004 e 0005); agenda filtra pelo profissional mostrado no seletor; contrato usa o nome do consultório ativo; remarcar mantém a duração da consulta; cron de confirmação só envia com o n8n homologado e cobre 24 h; centavos no orçamento; PDF do contrato sem upsert e sem rascunho órfão; link de assinatura sempre absoluto.
- `node supabase/scripts/criar-usuario.mjs` recria a demo e deixa o Dr. no consultório **real** (vazio). Para ver a demo: menu Conta → Demonstração.
