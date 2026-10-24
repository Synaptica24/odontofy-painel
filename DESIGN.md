---
name: Dr. Mateus Peixoto
description: Clínica clara no padrão Figars/Brio — fluxo e hierarquia do Codental, visual neutro e premium; SF Pro/Inter, um acento azul-petróleo, botão primário em tinta, cartões de 14px com sombra em duas camadas, vidro nas barras.
colors:
  fundo: "#ffffff"
  fundo-app: "#f5f5f7"
  fundo-2: "#fafafb"
  fundo-3: "#f0f0f3"
  hoje-fundo: "#f3f7fa"
  tinta: "#17171a"
  tinta-2: "#5b5b63"
  tinta-3: "#6c6c74"
  pauta: "#e7e7ea"
  pauta-2: "#d9d9de"
  acento: "#2b6a8a"
  acento-suave: "#e8f1f6"
  marcador: "#17171a"
  marcador-2: "#2b2b30"
  ia: "#2b6a8a"
  ia-vivo: "#2b6a8a"
  ia-fundo: "#e8f1f6"
  ia-borda: "#c5dbe7"
  alerta: "#b8302a"
  alerta-vivo: "#d0433c"
  alerta-fundo: "#fceceb"
  alerta-borda: "#f3c9c6"
  sucesso: "#1a7a43"
  sucesso-vivo: "#2a9a58"
  sucesso-fundo: "#e7f5ec"
  sucesso-borda: "#bfe3cc"
  aviso: "#94600f"
  aviso-vivo: "#c98a2a"
  aviso-fundo: "#fbf2e2"
  aviso-borda: "#efd9ad"
  selecao: "#e8f1f6"
  foco: "#2b6a8a"
  barra: "rgb(255 255 255 / 0.78)"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  nav:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  cartao: "12px"
  campo: "8px"
  chip: "6px"
  pilula: "999px"
  ponto: "50%"
spacing:
  e-1: "0.25rem"
  e-2: "0.5rem"
  e-3: "0.75rem"
  e-4: "1rem"
  e-5: "1.25rem"
  e-6: "1.5rem"
  e-8: "2rem"
  e-10: "2.5rem"
  e-12: "3rem"
  toque: "2.75rem"
  gutter: "1rem"
  topo: "4rem"
  coluna-lateral: "20rem"
  lista-mestre: "24rem"
shadows:
  xs: "0 1px 2px rgba(16, 24, 40, 0.05)"
  sm: "0 1px 3px rgba(16, 24, 40, 0.1), 0 1px 2px rgba(16, 24, 40, 0.06)"
  md: "0 4px 8px -2px rgba(16, 24, 40, 0.1), 0 2px 4px -2px rgba(16, 24, 40, 0.06)"
  lg: "0 12px 16px -4px rgba(16, 24, 40, 0.1), 0 4px 6px -2px rgba(16, 24, 40, 0.05)"
  anel-foco: "0 0 0 4px rgba(21, 112, 239, 0.16)"
components:
  botao-contorno:
    backgroundColor: "{colors.fundo}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.pauta-2}"
    typography: "{typography.title}"
    rounded: "{rounded.campo}"
    padding: "0 0.875rem"
    height: "2.5rem"
    shadow: "{shadows.xs}"
  botao-contorno-hover:
    backgroundColor: "{colors.fundo-2}"
  botao-cheio:
    backgroundColor: "{colors.marcador}"
    textColor: "#ffffff"
    borderColor: "{colors.marcador}"
    typography: "{typography.title}"
    rounded: "{rounded.campo}"
    padding: "0 0.875rem"
    height: "2.5rem"
  botao-cheio-hover:
    backgroundColor: "{colors.marcador-2}"
  botao-alerta:
    backgroundColor: "{colors.fundo}"
    textColor: "{colors.alerta}"
    borderColor: "{colors.alerta-borda}"
    typography: "{typography.title}"
    rounded: "{rounded.campo}"
    padding: "0 0.875rem"
    height: "2.5rem"
  entrada:
    backgroundColor: "{colors.fundo}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.pauta-2}"
    typography: "{typography.body}"
    rounded: "{rounded.campo}"
    padding: "0.5rem 0.75rem"
    height: "2.5rem"
    shadow: "{shadows.xs}"
  entrada-foco:
    borderColor: "{colors.ia-vivo}"
    shadow: "{shadows.anel-foco}"
  aba:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-2}"
    typography: "{typography.title}"
    rounded: "{rounded.campo}"
    padding: "0 0.75rem"
    height: "2.25rem"
  aba-selecionada:
    backgroundColor: "{colors.ia-fundo}"
    textColor: "{colors.ia}"
  cartao:
    backgroundColor: "{colors.fundo}"
    textColor: "{colors.tinta}"
    borderColor: "{colors.pauta}"
    rounded: "{rounded.cartao}"
    padding: "1rem"
    shadow: "{shadows.xs}"
  cartao-titulo:
    textColor: "{colors.tinta}"
    typography: "{typography.title}"
    borderColor: "{colors.pauta}"
    padding: "0 0 0.75rem"
  linha:
    backgroundColor: "{colors.fundo}"
    textColor: "{colors.tinta}"
    typography: "{typography.body}"
    rounded: "{rounded.campo}"
    padding: "0.75rem 0.5rem"
  linha-hover:
    backgroundColor: "{colors.fundo-2}"
  vazio:
    backgroundColor: "{colors.fundo-app}"
    textColor: "{colors.tinta-2}"
    borderColor: "{colors.pauta-2}"
    typography: "{typography.body}"
    rounded: "{rounded.campo}"
    padding: "0.75rem 1rem"
  erro:
    backgroundColor: "{colors.alerta-fundo}"
    textColor: "{colors.alerta}"
    borderColor: "{colors.alerta-borda}"
    typography: "{typography.body}"
    rounded: "{rounded.campo}"
    padding: "0.75rem 1rem"
  topo:
    backgroundColor: "{colors.barra}"
    borderColor: "{colors.pauta}"
    height: "{spacing.topo}"
    padding: "0 1.5rem"
  topo-aba:
    textColor: "{colors.tinta-2}"
    typography: "{typography.title}"
    rounded: "{rounded.campo}"
    padding: "0 0.875rem"
    height: "2.5rem"
  topo-aba-ativa:
    backgroundColor: "{colors.ia-fundo}"
    textColor: "{colors.ia}"
  nav-inferior:
    backgroundColor: "{colors.barra}"
    textColor: "{colors.tinta-3}"
    borderColor: "{colors.pauta}"
    typography: "{typography.nav}"
    height: "3.5rem"
  nav-inferior-ativo:
    backgroundColor: "{colors.ia-fundo}"
    textColor: "{colors.ia}"
  chip-semana-ia:
    backgroundColor: "{colors.ia-fundo}"
    borderColor: "{colors.ia-borda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  chip-semana-voce:
    backgroundColor: "{colors.sucesso-fundo}"
    borderColor: "{colors.sucesso-borda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  chip-semana-sugerido:
    backgroundColor: "{colors.aviso-fundo}"
    borderColor: "{colors.aviso-borda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  chip-semana-bloqueio:
    backgroundColor: "{colors.fundo-2}"
    borderColor: "{colors.pauta}"
    textColor: "{colors.tinta-3}"
    rounded: "{rounded.chip}"
    padding: "6px 8px"
  balao-paciente:
    backgroundColor: "{colors.fundo}"
    borderColor: "{colors.pauta}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cartao}"
    padding: "0.5rem 0.75rem 1.125rem"
  balao-ia:
    backgroundColor: "{colors.ia-fundo}"
    borderColor: "{colors.ia-borda}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.cartao}"
    padding: "0.5rem 0.75rem 1.125rem"
  balao-voce:
    backgroundColor: "{colors.marcador}"
    textColor: "#ffffff"
    rounded: "{rounded.cartao}"
    padding: "0.5rem 0.75rem 1.125rem"
---

# Design System: Dr. Mateus Peixoto

## Overview

**Creative North Star: "Clínica clara", no padrão Figars/Brio (2026-10-24)**

Atualização de 2026-10-24: o visual passou a seguir o mesmo padrão de design da barbearia Figars (Brio): skill `emil-design-eng` (pressão `scale(.97)` em 140ms, curvas fortes `--saida`/`--meio`, entradas com `@starting-style`, nada acima de 400ms, teclado não anima) e blocos MIT do Bencho adaptados em `components/fx/` (número que rola, pilha "Pede atenção", ilha do próximo paciente). Base neutra (`#f5f5f7` / branco / tinta `#17171a`), um único acento azul-petróleo `#2b6a8a` (AA 5,9:1 sobre branco), botão primário em tinta, cartões de 14px com sombra em duas camadas, controles de 10px, folhas de 20px, vidro fosco só na barra superior, na inferior e no topo/rodapé da conversa. Abas viraram controle segmentado com indicador deslizante. O que segue abaixo descreve a hierarquia e o fluxo (que continuam os do Codental); onde citar azul `#1570EF` ou cinzas Untitled UI, valem os tokens do frontmatter.

O Dr. Mateus usa o Codental todo dia. O painel do consultório segue o mesmo desenho para ele não sentir que está aprendendo outra ferramenta: barra superior branca com abas, cartões brancos com borda de 1px e sombra curta sobre uma página cinza-claríssima, azul como única cor de ação, cinzas suaves no texto, e estado dito por um ponto colorido pequeno ao lado do nome.

A densidade é a de uma ferramenta de trabalho: cada cartão responde uma pergunta, as listas têm linhas de 44px separadas por divisores de 1px, os números importantes ficam em 30 a 36px com peso 600, nunca pesados demais. Nada de ilustração, gradiente, pílula ou tipografia brincalhona.

Referência visual: capturas do aplicativo na home de codental.com.br (barra "Agenda · Pacientes · Financeiro", caixas "Pacientes aguardando" e "Dentistas", agenda em grade com a coluna de hoje azul-clara, cartão do agendamento com botões de contorno e um botão azul cheio).

**Key Characteristics:**
- Uma família só, Inter, pesos 400 a 700. Corpo em 14px, títulos de cartão em 14px/600, título de página em 24px/600.
- Página `#F9FAFB`, cartões `#FFFFFF` com borda `#EAECF0`, raio 12px e sombra xs. Campos, botões, abas e chips com raio 8px (chips da semana, 6px).
- Azul `#1570EF` é a ação: botão cheio, interruptor ligado, balão "você", aba e item de navegação ativos (fundo `#EFF8FF`, texto `#175CD3`).
- Vermelho só quando ele precisa agir agora. Verde confirma. Amarelo espera confirmação. Nunca cor decorativa em cima de dado clínico.
- Estado por ponto chapado de 8px: azul IA, cinza-escuro você, vermelho escalada, verde com check feito, X vermelho faltou, anel tracejado esperando.
- Desktop (≥ 1024px): barra superior fixa de 4rem; Hoje com coluna de cartões à esquerda e lista principal à direita; Conversas com lista de 24rem e thread ao lado; Agenda em grade de seis colunas com linhas de 1px e a coluna de hoje em `#F5FAFF`.
- Celular: uma coluna de cartões, barra inferior branca rente ao fundo com a aba ativa em azul-claro.
- Movimento curto: entrada de lista em 260ms, pressão de 2% ao tocar. Tudo some com `prefers-reduced-motion`.

## Colors

Paleta do Untitled UI, que é a que o Codental usa. Os valores normativos do tema claro estão no frontmatter; o escuro usa os mesmos nomes com valores em `styles/mundo-a.css`.

### Primary
- **Azul de ação** (`marcador` #1570EF, hover `marcador-2` #175CD3): botão cheio, interruptor ligado, botão de enviar, balão "você", barra de progresso, nome do consultório na barra superior.
- **Azul da IA** (`ia` #175CD3, `ia-vivo` #1570EF, `ia-fundo` #EFF8FF, `ia-borda` #B2DDFF): ponto azul, balão da IA, aba e item de navegação ativos, chip da semana marcado pela IA, número grande da campanha, links de ação.

### Secondary
- **Vermelho "precisa de você"** (`alerta` #D92D20, `alerta-vivo` #F04438, `alerta-fundo` #FEF3F2, `alerta-borda` #FECDCA): ponto da escalada, motivo em vermelho na linha, contador na aba Conversas, erro, chip "faltou", estado "IA desligada".
- **Verde confirmado** (`sucesso` #067647, `sucesso-vivo` #17B26A, `sucesso-fundo` #ECFDF3, `sucesso-borda` #ABEFC6): ponto "feito", chip da semana marcado por ele, ícone do vazio-como-boa-notícia.
- **Amarelo esperando** (`aviso` #B54708, `aviso-vivo` #F79009, `aviso-fundo` #FFFAEB, `aviso-borda` #FEDF89): chip sugerido pela IA que falta confirmar, com borda tracejada.

### Neutral
- **Página** (`fundo-app` #F9FAFB) e **cartão** (`fundo` #FFFFFF): o cartão branco sempre fica sobre a página cinza-claríssima.
- **Fundo 2** (`fundo-2` #F2F4F7): hover de linha e de botão de contorno, trilho do interruptor e das barras, hachura do bloqueio.
- **Tinta** (`tinta` #101828): nome de paciente, dado clínico, números, título. **Tinta 2** (#475467): texto secundário, rótulo, sub-linha, abas inativas. **Tinta 3** (#667085): meta, dica, placeholder, cabeçalho de dia na semana.
- **Pauta** (`pauta` #EAECF0): divisor de lista, borda de cartão, borda da barra. **Pauta 2** (#D0D5DD): borda de campo e de botão de contorno.
- **Seleção e foco** (`selecao` #D1E9FF, `foco` #1570EF): seleção de texto azul-clara; foco em contorno de 2px, campos ganham anel de 4px a 16%.

### Named Rules
**A regra do único azul.** Azul é a única cor de ação. Um botão cheio por cartão, no máximo; o resto é contorno branco com borda cinza.

**A regra de quem fez.** Estado é dito pela marca (ponto) e pela cor do chip, nunca pela cor do texto. Nome de paciente e dado clínico ficam sempre em `tinta`.

**A regra do cartão.** Todo bloco de conteúdo é um cartão branco com título de 14px/600 e um divisor de 1px abaixo dele. Dentro do cartão, as linhas se separam por 1px de `pauta`; não existe cartão dentro de cartão.

## Typography

Inter em tudo, numerais tabulares onde tem hora e contagem (`.num`).

- **Título de página** (`headline`): 24px/600, `tinta`, letter-spacing -0.01em.
- **Título de cartão e de aba** (`title`): 14px/600.
- **Corpo e nome na linha** (`body`): 14px/400; o nome da linha sobe para 500.
- **Rótulo, sub-linha, meta** (`label`): 13px/500 em `tinta-2` ou `tinta-3`.
- **Números grandes** (`display`): 30 a 36px/600, letter-spacing -0.02em.
- **Navegação do celular** (`nav`): 11px/500, ativo em 600.

## Layout

- Escala de 4px (`e-1` a `e-12`). Alvo de toque mínimo 44px.
- Celular: uma coluna, gutter de 16px, cartões empilhados com 16px entre eles.
- Desktop: conteúdo até 80rem centrado com 32px de margem; barra superior de 4rem fixa; Hoje em `20rem + 1fr` (22rem a partir de 1400px) com a coluna de cartões à esquerda e sticky; Conversas em `24rem + 1fr` com a lista à esquerda separada por 1px; Agenda em seis colunas iguais dentro de uma moldura de 1px.

## Components

Primitivos em `components/ui/primitivos.tsx`; estilos em `styles/mundo-a.css` (celular e tokens) e `styles/desktop.css` (casca e layouts largos).

- **Botao**: contorno (branco, borda `pauta-2`, sombra xs) ou cheio (azul). 40px de altura, raio 8px, 14px/600. Variante `alerta` tem texto e borda vermelhos.
- **Entrada**: 40px, raio 8px, borda `pauta-2`, sombra xs; foco com borda azul e anel de 4px.
- **Abas**: a selecionada ganha fundo `ia-fundo` e texto `ia`, igual à aba "Agenda" do Codental. **Passos** (anterior · hoje · próximo): grupo de botões com borda de 1px e divisores internos.
- **Interruptor**: 44×24, azul quando ligado, bola branca com sombra sm.
- **Bloco / painel**: cartão branco. Legenda = título 14px/600 + contagem 13px à direita + divisor.
- **Linha**: `ponto · nome/sub/meta · ação`. Hover em `fundo-2`. Ações descem para baixo do texto no celular.
- **Marca**: ponto de 8px; `feito` e `falta` têm 12px e carregam o glifo.
- **Vazio**: caixa tracejada em `fundo-app` com check verde. **Erro**: caixa vermelha com borda `alerta-borda`.
- **Barra superior** (desktop): nome em azul 18px/700 com subtítulo em caixa alta 11px; abas com ícone de 18px; contador vermelho na aba Conversas; pílula de estado da IA; atalhos em ícone de 40px para Campanha, Consumo e Ajustes.
- **Barra inferior** (celular): 56px, branca, borda superior de 1px, cinco destinos; o ativo fica com ícone sobre fundo azul-claro e rótulo azul.
- **Semana**: colunas com cabeçalho "número + dia" em 13px; a coluna de hoje em `hoje-fundo` com cabeçalho azul; chips com borda esquerda de 3px na cor do estado.
- **Thread**: corpo em `fundo-app`; balão do paciente branco com borda, da IA azul-claro com borda, seu azul cheio com texto branco; raio 12px com o canto de origem em 4px.
- **Toast**: escuro (`tinta`) com texto claro, botões brancos, raio 8px.

## Motion

- Entrada de lista: 260ms, 4px de subida, escalonada em 40ms até o quarto item.
- Pressão: 2% ao tocar, 140ms. Hover só com ponteiro fino.
- Saída otimista de linha: 200ms, desliza 12px para a direita.
- Esqueleto: brilho linear de 1,4s.
- `prefers-reduced-motion`: animações desligadas, transições só de opacidade e cor.
