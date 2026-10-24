# Paridade Codental × nosso painel: o que está pronto e o backlog (2026-10-24)

## Pronto nesta rodada
- [x] **Pacientes migrados**: 436 cadastros do Codental no Supabase real, com `codental_id` único, convênios criados, telefones tratados (ver `migration-patients.md`).
- [x] **Lista de pacientes no desenho do Codental**: abas Buscar / Aniversariantes / Retornos semestrais; busca por nome, telefone, CPF ou código; linha com nome + chip de convênio + "Última consulta: dd/mm/aaaa - há X"; colunas CPF e Telefone com atalho do WhatsApp; cabeçalho de colunas no desktop.
- [x] **Ficha → Resumo → "Informações"**: código Codental, nascimento, sexo, CPF, RG, profissão, e-mail, celular (ou "compartilhado"), fixo, endereço completo, responsável, emergência, convênio/titular, como conheceu, observações.
- [x] **Telefone opcional** em toda a interface (agenda, financeiro, ficha, contratos): sem número, o botão do WhatsApp some em vez de quebrar.
- [x] **Edição completa do cadastro** (mesmas seções do Codental: dados, emergência, endereço, responsável, convênio) no cadastro novo e em "Editar dados"; `salvar_paciente` grava tudo e aceita celular vazio quando há outro contato.
- [x] **Busca da barra superior** acha por nome, e-mail, celular, telefone de contato (compartilhado), fixo, CPF e código Codental; quem bate exatamente no código/CPF/telefone aparece primeiro.
- [x] **Visual no padrão Figars/Brio** (Emil Kowalski + blocos do Bencho): base neutra, acento azul-petróleo, botão primário em tinta, cartões de 14px com sombra em duas camadas, barra de vidro, abas segmentadas, pilha "Pede atenção", números que rolam e ilha do próximo paciente na Hoje. Fluxo lista → ficha → abas Buscar/Aniversariantes/Retornos inalterado.
- [x] Já existia e segue valendo: ficha com anamnese, odontograma por face, evolução só-acréscimo, anexos, orçamentos, contratos por modelo com assinatura no celular, agenda semanal por profissional, financeiro básico, conversas com IA.

## Backlog (ordem sugerida)
1. **Export CSV/Excel** da lista de pacientes (Codental tem; simples de fazer no cliente).
3. **Tarefas** (por paciente e por dia, badge na agenda).
4. **Documentos clínicos**: receita e atestado a partir de modelo, com as mesmas variáveis dos contratos; compartilhar por WhatsApp/link.
5. **Modelos de anamnese** configuráveis + link para o paciente preencher no celular.
6. **Evolução**: anexar imagem, assinar digitalmente (reaproveitar a assinatura dos contratos).
7. **Pagamentos** por paciente (parcelas, recebido/pendente) e **fluxo de caixa**; notas fiscais e boletos depois.
8. **Migrar histórico clínico e agenda futura** do Codental (depende de export completo ou leitura ficha a ficha).
9. **Lembretes automáticos** por paciente (preferência WhatsApp/SMS/nenhum); já temos `nao_perturbe`, falta a preferência positiva.
10. Pastas e comparação de imagens em Arquivos; categorização de pacientes; CRM/estoque/prótese só se o Dr. pedir.
