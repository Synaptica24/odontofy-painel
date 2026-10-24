-- Importação do prontuário do Codental (consultas, bloqueios, evoluções, tratamentos, orçamentos, pagamentos, anamneses, arquivos).
-- Cada linha importada guarda o id de origem (codental_id) para a importação ser idempotente (rodar de novo não duplica).
-- Escrito pelo Claude a pedido direto do Gabriel em 2026-10-24 (pasta do Codex; aviso em docs/PEDIDOS.md).
begin;

-- ---------- consultas e bloqueios ----------
alter table public.agendamentos add column if not exists codental_id bigint;
create unique index if not exists agendamentos_codental_unico on public.agendamentos (consultorio_id, codental_id) where codental_id is not null;
do $$ declare n text; begin
 for n in select conname from pg_constraint where conrelid = 'public.agendamentos'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%origem%' loop
  execute format('alter table public.agendamentos drop constraint %I', n);
 end loop;
end $$;
alter table public.agendamentos add constraint agendamentos_origem_check check (origem in ('agente','painel','codental'));

alter table public.bloqueios add column if not exists codental_id bigint;
create unique index if not exists bloqueios_codental_unico on public.bloqueios (consultorio_id, codental_id) where codental_id is not null;

-- ---------- prontuário ----------
alter table public.evolucoes add column if not exists codental_id bigint;
create unique index if not exists evolucoes_codental_unico on public.evolucoes (consultorio_id, codental_id) where codental_id is not null;

alter table public.odontograma add column if not exists codental_id bigint;
create unique index if not exists odontograma_codental_unico on public.odontograma (consultorio_id, codental_id) where codental_id is not null;

alter table public.orcamentos add column if not exists codental_id bigint;
alter table public.orcamentos add column if not exists codental_numero text not null default '';
alter table public.orcamentos add column if not exists valor_total numeric(12,2);
create unique index if not exists orcamentos_codental_unico on public.orcamentos (consultorio_id, codental_id) where codental_id is not null;
alter table public.orcamento_itens add column if not exists faces text not null default '';

alter table public.anexos add column if not exists codental_id bigint;
alter table public.anexos add column if not exists pasta text not null default '';
create unique index if not exists anexos_codental_unico on public.anexos (consultorio_id, codental_id) where codental_id is not null;

alter table public.pacientes add column if not exists notas_codental text not null default '';

-- Pagamentos (débitos/parcelas por paciente). Codental: aba "Pagamentos". Primeiro uso: importação; o painel ganha a aba depois.
create table if not exists public.pagamentos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 orcamento_id uuid references public.orcamentos on delete set null,
 descricao text not null default '',
 valor numeric(12,2) not null default 0 check (valor >= 0),
 vencimento date,
 status text not null default 'pendente' check (status in ('pendente','atrasado','pago','cancelado')),
 pago_em timestamptz,
 forma text not null default '',
 recibo boolean not null default false,
 codental_id bigint,
 criado_em timestamptz not null default now(),
 criado_por uuid references auth.users on delete set null
);
create index if not exists pagamentos_paciente on public.pagamentos(paciente_id, vencimento);
create unique index if not exists pagamentos_codental_unico on public.pagamentos (consultorio_id, codental_id) where codental_id is not null;

-- Anamneses respondidas por modelo (perguntas e respostas livres), como o Codental guarda. A anamnese estruturada (public.anamneses) continua.
create table if not exists public.anamneses_respostas (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 modelo text not null default 'Anamnese',
 respostas jsonb not null default '[]',
 assinada boolean not null default false,
 codental_id bigint,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 criado_por uuid references auth.users on delete set null
);
create index if not exists anamneses_respostas_paciente on public.anamneses_respostas(paciente_id, criado_em desc);
create unique index if not exists anamneses_respostas_codental_unico on public.anamneses_respostas (consultorio_id, codental_id) where codental_id is not null;

-- Receitas e atestados emitidos no Codental ficam como registro histórico (texto), sem o PDF.
create table if not exists public.documentos_emitidos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 tipo text not null default 'documento',
 resumo text not null default '',
 origem_url text not null default '',
 criado_em timestamptz not null default now()
);
create index if not exists documentos_emitidos_paciente on public.documentos_emitidos(paciente_id, criado_em desc);
create unique index if not exists documentos_emitidos_origem on public.documentos_emitidos (consultorio_id, origem_url) where origem_url <> '';

-- RLS e trilha, no mesmo padrão do prontuário
do $$ declare t text; begin
 foreach t in array array['pagamentos','anamneses_respostas','documentos_emitidos'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  execute format('drop policy if exists consultorio_tudo on public.%I', t);
  execute format('create policy consultorio_tudo on public.%I for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()))', t);
  execute format('drop trigger if exists trilha_%I on public.%I', t, t);
  execute format('create trigger trilha_%I after insert or update or delete on public.%I for each row execute function privado.registrar_alteracao_prontuario()', t, t);
 end loop;
end $$;

-- Arquivos do Codental têm mais tipos (gif, vídeos, documentos do Office)
update storage.buckets set file_size_limit = 52428800,
 allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/gif','image/bmp','image/tiff','application/pdf','application/dicom',
  'video/mp4','video/quicktime','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','application/octet-stream']
 where id = 'prontuario';

commit;
