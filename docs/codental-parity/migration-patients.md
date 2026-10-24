# Migração de pacientes Codental → Supabase

**Data:** 2026-10-24. **Origem:** export nativo do Codental (Pacientes → rodapé → "Baixar lista de pacientes em: CSV"), arquivo `pacientes-24-10-2026.csv`, 33 colunas, 436 linhas. Guardado em `data/codental-patients.csv` (pasta `data/` no `.gitignore`). Nenhuma alteração na conta Codental.

**Destino:** `public.pacientes`, consultório real "Consultório Dr. Mateus Peixoto", projeto Supabase `jvaiwbancxkrbomjevix`.
**Script:** `node scripts/import-codental-patients.mjs [--dry-run] [--avisos]` (lê `.env.local`; service role só no servidor). Upsert por `(consultorio_id, codental_id)`: rodar de novo não duplica.
**Migração de esquema:** `supabase/migrations/202610240001_importacao_codental.sql` (aplicada com `supabase db push`).

## Resultado
| | |
| --- | --- |
| Lidos | 436 |
| Inseridos | 436 |
| Atualizados (2ª execução, prova de idempotência) | 436 |
| Erros | 0 |
| No banco com `codental_id` | 436 (437 no consultório, contando 1 cadastro de teste anterior) |
| Sem celular | 11 (1 deles tem telefone fixo) |
| Celular compartilhado com outro cadastro | 27, guardados em `telefone_contato` |
| Com CPF | 342 |
| Com convênio | 166 (5 convênios criados: Odontolife/DentalUni, OdontoBase, SulAmérica Odonto, PRIVIAN, Atividades Extras Consultório) |

## Mapeamento de colunas
| CSV Codental | `pacientes` | Regra |
| --- | --- | --- |
| ID | `codental_id` | único por consultório |
| Numero | `codental_numero` | código curto mostrado na ficha |
| Nome completo | `nome` | espaços normalizados |
| CPF | `cpf` | só dígitos, 11 ou vazio |
| RG | `rg` | |
| Data de nascimento | `nascimento` | dd/mm/aaaa → date |
| Sexo | `sexo` | masculino / feminino / outro / vazio |
| Profissão | `profissao` | |
| E-mail | `email` | minúsculas, validado |
| Celular | `telefone_e164` **ou** `telefone_contato` | E.164. Se o número já é de outro cadastro (família), vai para `telefone_contato` e `telefone_e164` fica null. O dono do número é o cadastro com último agendamento mais recente |
| Telefone | `telefone_fixo` | texto como veio |
| CEP, Endereço, Complemento, Bairro, Cidade, Estado | colunas próprias + `endereco` | `endereco` = linha única "Rua, nº, compl - Bairro - Cidade/UF - CEP" |
| Nome / Data / Documento do responsável | `responsavel_*` | |
| Contato de emergência nome / telefone | `emergencia_*` | |
| Nome do plano | `convenio_id` | "Particular" = null; demais criam linhas em `convenios` |
| Numero da carterinha | `numero_carteirinha` | |
| Titular / CPF do titular do convênio | `convenio_titular`, `convenio_titular_cpf` | |
| Observações | `observacoes` | observação cadastral, não evolução clínica |
| Como conheceu | `como_conheceu` | |
| Data de criação | `primeiro_contato` | |
| Data do último agendamento | `ultimo_agendamento_codental`; `ultimo_contato` recebe esse valor se já passou, senão a criação | |
| (fixo) | `origem` = `codental`, `status` = `paciente` | |
| Documento, Estrangeiro, País | não migrados | vazios em todos os registros (País só "Brasil" em 14) |

## Decisões
- `telefone_e164` virou opcional (era obrigatório). As RPCs do n8n continuam resolvendo por telefone único; quem tem o número só em `telefone_contato` não é encontrado pelo WhatsApp, porque o número pertence a outro cadastro da família.
- Cadastros que não são pessoas (ex.: "Academia") vieram como estão: o Dr. usa a agenda do Codental também para compromissos próprios.
- Agendamentos do Codental não foram migrados (só a data do último, para a aba "Retornos semestrais").

## Pendências
- Histórico clínico (evoluções, anamneses, odontograma, orçamentos, pagamentos, arquivos) do Codental: não migrado. O export nativo cobre só cadastro; o prontuário teria de ser lido ficha a ficha (436) ou pedido ao suporte do Codental como export completo.
- Agenda futura (há consultas marcadas até 04/2027 no Codental): não migrada.
- ~~Busca no servidor (`painel_leitura`, operação 'pacientes') ainda não procura em `telefone_contato`~~ Feito na migração `202610240003` (nome, e-mail, celular, contato, fixo, CPF, código Codental).
- ~~`salvar_paciente` ainda não grava os campos novos~~ Feito na migração `202610240002`.

## Prontuário e agenda (2026-10-24, segunda rodada)
Pedido do Gabriel: trazer consultas, evoluções/anamneses, orçamentos/pagamentos e arquivos. O Codental não tem API pública; a ficha é renderizada no servidor (Rails) e a agenda tem `GET /events.json?start&end`.
**Como:** `scripts/codental-extrator.browser.js` roda na aba logada do Codental (só GET), lê as páginas da ficha (`/patients/:id`, `/evolutions`, `/quotes`, `/procedures`, `/debts`, `/anamneses/:id/edit`, `/documents`, `/uploads`) e envia JSON + arquivos para `scripts/coletor-local.mjs` (http://localhost:3011 → `data/codental/`). O Chrome pede permissão de "acesso à rede local" para a página falar com o localhost; o Gabriel autorizou. Depois `scripts/import-codental-prontuario.mjs` grava no Supabase (idempotente por `codental_id`). Migrações `202610240004` a `202610240006`.

| | Codental | Importado |
| --- | --- | --- |
| Consultas (2024–04/2027) | 1692 | 1692 (passadas sem cancelamento → `concluido`; 24 futuras) |
| Compromissos do Dr. (bloqueios) | 903 | 868 (35 sobrepostos entre si, descartados) |
| Feriados | 143 | não migrados |
| Evoluções | — | 331 |
| Tratamentos → odontograma (por dente) | — | 235 |
| Orçamentos / itens | — | 29 / 160 |
| Pagamentos | — | 81 (aba nova na ficha) |
| Anamneses respondidas | — | 32 (bloco na aba Anamnese) |
| Receitas e atestados | — | 261 registros (sem PDF) |
| Arquivos | 736 (3,05 GB) | enviados ao bucket `prontuario` (ver relatório da importação) |
