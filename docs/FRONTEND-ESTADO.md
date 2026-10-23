# Front-end — estado e como mexer

Dono: Claude. Atualizado em 2026-10-05 (rodada 3: visual no desenho do Codental).

## Direção visual
"Clínica clara": o painel se parece com o Codental, o sistema que o Dr. Mateus já usa todo dia, para ele não sentir que está aprendendo outra ferramenta. Referência: capturas do app na home de codental.com.br (barra superior com abas, cartões brancos com borda de 1px, agenda em grade com a coluna de hoje azul-clara, chips coloridos por estado).

- **Fonte Inter** (pesos 400 a 700), corpo em 14px, títulos em 600. Nada de peso 800/900.
- **Azul de ação** `#1570EF` (hover `#175CD3`) em botão cheio, aba selecionada (fundo `#EFF8FF` + texto azul), interruptor ligado, balão "você".
- **Cinzas Untitled UI**: texto `#101828` / `#475467` / `#667085`, divisores `#EAECF0`, borda de campo `#D0D5DD`, página `#F9FAFB`, cartão branco.
- **Cartões**: todo `Bloco` e todo `painel` é um cartão branco com borda de 1px, raio 12px e sombra curta; título de 14px/600 com divisor embaixo. Campos, botões, abas e chips têm raio 8px.
- **Estado por ponto chapado** (`Marca`): azul = a IA fez, cinza-escuro = ele fez, vermelho = precisa dele, verde com check = feito, X vermelho = faltou, anel tracejado = esperando confirmação.
- **Semana em grade**: chips azul (IA marcou), verde (ele marcou), amarelo tracejado (sugerido, falta confirmar), vermelho (faltou), hachura cinza (bloqueio).
- **Fundo claro por padrão** em qualquer aparelho. Escuro só se ele escolher em Mais → Tema (guardado no aparelho; script inline em `app/layout.tsx` aplica antes da pintura). Os tokens escuros ficam em `styles/mundo-a.css`.

Sistema documentado em `DESIGN.md`.

## Duas camadas de layout
- **Celular (< 1024px)**: uma coluna de cartões, barra inferior branca rente ao fundo com a aba ativa em azul-claro, Hoje responde só "preciso fazer algo agora?".
- **Desktop (≥ 1024px)** (`styles/desktop.css`): barra superior fixa de 4rem (nome em azul à esquerda, abas com ícone no meio, estado da IA e atalhos de Campanha/Consumo/Ajustes à direita); Hoje em duas colunas (cartões à esquerda como no Codental: teto de novos, semana dia a dia, campanha, gasto de IA; lista principal à direita); Conversas com lista e thread lado a lado; Agenda abre na semana em seis colunas com chips; Pacientes com origem e primeiro contato na linha.

## Estrutura
- `app/(painel)/layout.tsx` — casca: `BarraSuperior` (desktop) + conteúdo + `NavInferior` (celular).
- `app/(painel)/<rota>/page.tsx` — só monta a tela. `/conversas/[id]` monta `TelaConversas` com `idAberta`.
- `components/telas/*.tsx` — uma tela por arquivo, client components, falam só com `lib/api.ts`.
- `components/ui/primitivos.tsx` — Pagina, Cabecalho, Bloco, Linha (com `acoesEmbaixo` só no celular), Marca, Botao, Vazio, Erro, OssoLinha, Campo, Entrada, Interruptor, Abas, Teto.
- `components/casca/` — `barra-superior.tsx` e `nav-inferior.tsx`, ambos com contador/ponto vermelho ao vivo via `inscreverEmConversas`.
- `components/dados/use-api.ts` e `datas.ts`.
- `styles/base.css` (escala, movimento), `styles/mundo-a.css` (tokens e componentes), `styles/desktop.css` (casca e layouts largos).
- Classes `tabela-linha__extra` = informação que só aparece no desktop.

## Regras que as telas seguem
- Ação otimista com Desfazer no toast, nunca modal de confirmação.
- Erro diz o que houve e o que fazer; texto digitado nunca se perde.
- Vazio é boa notícia. Carregamento é esqueleto com a forma da linha.
- Ajustes e observação do paciente salvam sozinhos.

## Como rodar
```
npm install
npx next dev -p 3010
```
Sem `.env.local`, `lib/api.ts` usa a fixture. Com Supabase configurado, vira real sem mudar o front.

## Pendente no front
- Envios da campanha mostram "Leva N" até o Codex entregar `paciente.nome` em `CampanhaEnvio` (pedido em `docs/PEDIDOS.md`).
- Tela de entrar (magic link) é do Codex e ainda está sem estilo; as classes prontas estão descritas no pedido em `docs/PEDIDOS.md`.
