# Codental — inventário de funcionalidades (conta do Dr. Mateus, só leitura, 2026-10-24)

Levantado navegando na sessão logada em app.codental.com.br. Nada foi criado, editado ou excluído lá.

## Navegação principal (barra superior)
| Módulo | Rota | O que faz | Nosso app |
| --- | --- | --- | --- |
| Agenda | `/` | Semana/Dia por profissional, minicalendário, "Hoje", tarefas pendentes do dia, sugestões (lateral direita), impressão | ✅ Agenda semanal/diária, blocos por estado, bloqueios |
| Pacientes | `/patients` | Lista com busca (nome, telefone, CPF, código), abas **Buscar / Aniversariantes / Retornos semestrais**, filtro por categoria, export Excel/CSV, cadastro | ✅ Lista com as 3 abas e colunas Nome/CPF/Telefone; export ainda não |
| Financeiro | `/financial` | Painel (aguardando repasse, inadimplência, próximas despesas), fluxo de caixa, notas fiscais, comissões, boletos | ◐ Previsto × realizado, orçamentos, faltas; sem fluxo de caixa/NF/boletos |
| Mais ferramentas (⋮⋮⋮) | — | Central de oportunidades (CRM `/crm/pipelines`), Controle de estoque, Campanhas automáticas, Relatórios de inteligência, Galeria de vídeos, Site da clínica, Controle de prótese, Extensão para WhatsApp | ◐ Campanha e IA no WhatsApp (nosso diferencial); resto no backlog |
| Ícones à direita | — | Busca global, notificações, central de mensagens (`/messages`), tarefas (`/todos`), configurações, conta | ✅ Busca de paciente, sino, conta; sem tarefas |
| Configurações gerais | `/settings` | Configurações da clínica, gestão de profissionais, taxas de maquininhas, mensagens, gestão de convênios, modelos de anamnese | ◐ Profissionais, convênios, horários; sem maquininhas/modelos de anamnese |

## Ficha do paciente (`/patients/:id`)
Abas: **Visão Geral · Anamneses · Orçamentos · Tratamentos · Pagamentos · Evoluções · Documentos · Arquivos**. Botões: Editar, foto, categorizar.

| Aba Codental | Conteúdo | Nosso app |
| --- | --- | --- |
| Visão Geral | Tarefas, bloco de notas (salvo automaticamente), Informações (código, preferência de lembrete, convênio, Serasa), odontograma permanentes/decíduos com legenda finalizado/em aberto, últimas evoluções, mensagens trocadas | ✅ Resumo (alertas, próxima consulta, última evolução, retornos, **Informações**, orçamentos) |
| Anamneses | Modelos de anamnese; preencher, enviar por e-mail/WhatsApp/link, baixar, imprimir | ◐ Anamnese única estruturada (alergias, medicamentos, condições); sem modelos nem link público |
| Orçamentos | Criar orçamento, compartilhar/baixar/imprimir | ✅ Orçamentos com itens, status pendente/aprovado/recusado; sem PDF |
| Tratamentos | Odontograma por dente/face, "Adicionar tratamento" | ✅ Odontograma 11–48 por face, planejado/realizado |
| Pagamentos | Débitos/parcelas do paciente | ✗ backlog |
| Evoluções | Editor rico (B/I/S, imagem), profissional, data, transcrever/melhorar com IA, **assinar digitalmente** | ✅ Evolução só acréscimo (texto); sem imagem/IA/assinatura |
| Documentos | Prescrição inteligente, emitir prescrição, emitir atestado, personalizar modelos | ◐ Contratos por modelo com variáveis + assinatura no celular; sem receita/atestado |
| Arquivos | Pastas, adicionar, mover, comparar imagens | ✅ Anexos privados; sem pastas/comparação |

## Cadastro de paciente (`/patients/:id/edit`)
Seções: dados básicos, Contato de emergência, Endereço, Responsável, Dados do Convênio.
Campos: nome*, celular, lembretes automáticos, e-mail, telefone fixo, profissão, gênero, paciente estrangeiro, nascimento, CPF, RG, documento, observações; emergência (nome, telefone); CEP, endereço com número, complemento, bairro, cidade, estado, país; responsável (nome, CPF, documento, nascimento); convênio (plano, carteirinha, titular, CPF do titular).
Todos esses campos existem agora em `public.pacientes` (migração `202610240001`); o formulário do painel edita os básicos e mostra os demais em "Informações".

## Export nativo
Rodapé da lista de pacientes: "Baixar lista de pacientes em: Excel / CSV". Gera relatório assíncrono e abre modal "Relatório gerado. Você já pode baixar". 33 colunas (ver `migration-patients.md`).
