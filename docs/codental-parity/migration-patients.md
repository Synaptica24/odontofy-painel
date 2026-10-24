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
- Busca no servidor (`painel_leitura`, operação 'pacientes') ainda não procura em `telefone_contato`; a tela de Pacientes filtra no navegador, então não é afetada.
- `salvar_paciente` ainda não grava os campos novos (sexo, RG, endereço detalhado etc.); pedido ao Codex em `docs/PEDIDOS.md`.
