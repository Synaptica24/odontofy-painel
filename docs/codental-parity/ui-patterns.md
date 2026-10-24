# Codental — padrões de interface (para familiaridade, não cópia de marca)

- **Barra superior branca** com logo à esquerda, abas com ícone (Agenda, Pacientes, Financeiro, mais), ícones à direita (busca, sino com badge, mensagens, tarefas, engrenagem) e menu "Conta". Aba ativa = fundo azul-claro + texto azul. Já aplicado em `components/casca/barra-superior.tsx`.
- **Fundo cinza muito claro**, cartões brancos com borda de 1 px e raio ~8 px, sombra quase nula.
- **Tipografia** sans neutra, 14 px corpo, títulos 18–20 px semibold, rótulos de coluna 12 px cinza.
- **Cores:** azul primário para ação principal e aba ativa; verde para WhatsApp/finalizado; âmbar "em aberto"; chips de convênio coloridos.
- **Lista de pacientes:** linhas altas (~64 px) com avatar circular + nome em negrito + subtítulo cinza ("Última consulta…"), colunas CPF e Telefone alinhadas à direita, cabeçalho de colunas em cinza pequeno. Aplicado em `components/telas/pacientes.tsx` e `styles/desktop.css` (`.pacientes-*`).
- **Abas de página** (Buscar / Aniversariantes / Retornos semestrais) abaixo do título e acima da busca. Usa o primitivo `Abas`.
- **Ficha:** cabeçalho com avatar, nome, "Categorizar", botão Editar à direita; abas horizontais; grade de duas colunas (lateral estreita com tarefas/notas/informações, conteúdo largo com odontograma e evoluções). Nossa ficha usa a lateral à direita; mantido.
- **Estados vazios** com frase amigável + convite ("Vamos começar?"). Nosso `Vazio` já faz isso.
- **Agenda:** colunas por dia, blocos com hora pequena em cima e título, hachura para indisponível, badge "1 Tarefa pendente" acima da coluna.
- **Modal de export:** título, estado "Relatório gerado", botões Fechar / Baixar.
- **Sem dark mode.**
