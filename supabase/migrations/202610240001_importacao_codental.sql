-- Importação dos pacientes do Codental (export CSV nativo "Baixar lista de pacientes").
-- Escrita por Claude Code a pedido direto do Gabriel (2026-10-24); ver docs/PEDIDOS.md e docs/codental-parity/migration-patients.md.
begin;

-- 1) Telefone passa a ser opcional: 10 cadastros do Codental não têm celular nem telefone, e 23 números são
--    compartilhados por 50 cadastros (familiares). A unicidade (consultorio_id, telefone_e164) continua valendo
--    para quem tem o número principal; os demais guardam o número em telefone_contato.
alter table public.pacientes alter column telefone_e164 drop not null;
alter table public.pacientes add column if not exists telefone_contato text not null default ''; -- número de contato quando o WhatsApp principal já pertence a outro cadastro
alter table public.pacientes add column if not exists telefone_fixo text not null default '';

-- 2) Origem "codental" para quem veio da importação.
alter table public.pacientes drop constraint if exists pacientes_origem_check;
alter table public.pacientes add constraint pacientes_origem_check check (origem in ('whatsapp','site','campanha','indicacao','codental'));

-- 3) Campos cadastrais que o Codental exporta e o painel ainda não tinha.
alter table public.pacientes
 add column if not exists sexo text not null default '' check (sexo in ('','masculino','feminino','outro')),
 add column if not exists rg text not null default '',
 add column if not exists profissao text not null default '',
 add column if not exists cep text not null default '',
 add column if not exists complemento text not null default '',
 add column if not exists bairro text not null default '',
 add column if not exists cidade text not null default '',
 add column if not exists estado text not null default '',
 add column if not exists responsavel_nome text not null default '',
 add column if not exists responsavel_nascimento date,
 add column if not exists responsavel_documento text not null default '',
 add column if not exists emergencia_nome text not null default '',
 add column if not exists emergencia_telefone text not null default '',
 add column if not exists como_conheceu text not null default '',
 add column if not exists convenio_titular text not null default '',
 add column if not exists convenio_titular_cpf text not null default '',
 add column if not exists codental_numero text not null default '',
 add column if not exists ultimo_agendamento_codental timestamptz,
 add column if not exists atualizado_em timestamptz not null default now();

-- 4) Não duplicar na reimportação: um codental_id por consultório.
alter table public.pacientes add constraint pacientes_codental_unico unique (consultorio_id, codental_id);

-- 5) atualizado_em automático.
create or replace function privado.pacientes_atualizado_em() returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists pacientes_atualizado_em on public.pacientes;
create trigger pacientes_atualizado_em before update on public.pacientes for each row execute function privado.pacientes_atualizado_em();

commit;
