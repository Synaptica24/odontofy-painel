# Codental — fluxos observados (só leitura)

## Paciente → prontuário → documento
1. Pacientes → busca (nome/telefone/CPF/código) → clica na linha.
2. Visão geral: odontograma + últimas evoluções + notas. Abas para anamnese, orçamento, tratamentos, evoluções, documentos, arquivos.
3. Evolução: "Adicionar" abre o editor na própria aba, escolhe profissional e data, salva, pode assinar digitalmente.
4. Documento: Documentos → emitir prescrição/atestado a partir de modelo → compartilhar (e-mail, WhatsApp, link), baixar, imprimir.

**Nosso app:** Pacientes → ficha (Resumo) → aba Evolução (acréscimo) → aba Contratos (modelo → PDF → link de assinatura no celular → PDF assinado volta para a ficha). Mesma ordem, menos cliques; falta receita/atestado.

## Agenda
- Semana por padrão; coluna por dia com hora na lateral; blocos coloridos por estado (hachurado = indisponível); "1 Tarefa pendente" no cabeçalho do dia; dia do dentista marcado.
- Lateral esquerda: minicalendário, "Agendas" (lista de profissionais), "Adicionar profissional", banner de indicação.
- Lateral direita recolhida: "Sugestões".
- Botões: Hoje, Semana/Dia, lista, impressão, mais.

**Nosso app:** mesma estrutura (minicalendário, Dia/Semana, blocos por estado, clique no vazio marca, Shift+clique bloqueia). Falta: tarefas do dia, impressão, sugestões.

## Pacientes — abas
- **Buscar:** lista paginada em 50 (carrega mais ao rolar); cada linha = avatar, nome, "Última consulta: dd/mm/aaaa - há X", CPF, telefone com ícone WhatsApp.
- **Aniversariantes:** quem faz aniversário no período.
- **Retornos semestrais:** último atendimento há mais de 6 meses.

**Nosso app:** as três abas, calculadas no navegador sobre a lista completa (437 cadastros cabem numa chamada).

## Export/Import (feito nesta rodada)
Codental → CSV nativo → `data/codental-patients.csv` (gitignored) → `node scripts/import-codental-patients.mjs` → `public.pacientes` (upsert por `codental_id`).
