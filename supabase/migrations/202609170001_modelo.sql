-- Modelo aprovado. Enums text + CHECK preservam o contrato TypeScript.
begin;
alter database postgres set timezone to 'America/Sao_Paulo';
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table public.pacientes (
 id uuid primary key default gen_random_uuid(), nome text not null check (btrim(nome) <> ''),
 telefone_e164 text not null unique check (telefone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 origem text not null check (origem in ('whatsapp','site','campanha','indicacao')),
 codental_id text, primeiro_contato timestamptz not null default now(), ultimo_contato timestamptz not null default now(),
 status text not null default 'novo' check (status in ('novo','em_conversa','agendado','paciente','fora_da_base')),
 observacoes text not null default '', nao_perturbe boolean not null default false,
 check (ultimo_contato >= primeiro_contato)
);
create index on public.pacientes(status, ultimo_contato desc);
create index on public.pacientes(codental_id) where codental_id is not null;
create table public.conversas (
 id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes on delete restrict,
 iniciada_em timestamptz not null default now(), encerrada_em timestamptz,
 status text not null default 'ativa' check (status in ('ativa','escalada','assumida','encerrada')),
 motivo_escalonamento text, resumo_gerado text, agente_pausado_ate timestamptz, urgente boolean not null default false,
 check ((status = 'encerrada') = (encerrada_em is not null)), check (encerrada_em >= iniciada_em),
 check (status <> 'assumida' or agente_pausado_ate is not null),
 check (status <> 'escalada' or coalesce(btrim(motivo_escalonamento),'') <> '')
);
create unique index on public.conversas(paciente_id) where status <> 'encerrada';
create index on public.conversas(status, iniciada_em desc);
create table public.mensagens (
 id uuid primary key default gen_random_uuid(), conversa_id uuid not null references public.conversas on delete restrict,
 direcao text not null check (direcao in ('entrada','saida')), autor text not null check (autor in ('paciente','agente','dentista')),
 texto text not null default '', tipo text not null check (tipo in ('texto','audio','imagem','documento')),
 transcricao text, midia_url text, wa_message_id text check (btrim(wa_message_id) <> ''), criada_em timestamptz not null default now(),
 check ((direcao = 'entrada' and autor = 'paciente') or (direcao = 'saida' and autor in ('agente','dentista'))),
 check ((tipo = 'texto' and btrim(texto) <> '') or (tipo <> 'texto' and coalesce(btrim(midia_url),'') <> ''))
);
create unique index on public.mensagens(wa_message_id) where wa_message_id is not null;
create index on public.mensagens(conversa_id, criada_em, id);
create table public.campanha_envios (
 id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes on delete restrict,
 leva integer not null check (leva > 0), enviada_em timestamptz,
 status text not null default 'fila' check (status in ('fila','enviada','respondida','erro','bloqueada')),
 respondida_em timestamptz, erro text, unique(paciente_id,leva), unique(id,paciente_id),
 check (status not in ('enviada','respondida') or enviada_em is not null),
 check (status <> 'respondida' or (respondida_em is not null and respondida_em >= enviada_em)),
 check (status <> 'erro' or coalesce(btrim(erro),'') <> '')
);
create index on public.campanha_envios(status,leva);
create table public.agendamentos (
 id uuid primary key default gen_random_uuid(), paciente_id uuid not null references public.pacientes on delete restrict,
 tipo text not null check (btrim(tipo) <> ''), inicio timestamptz not null, fim timestamptz not null,
 status text not null default 'sugerido' check (status in ('sugerido','confirmado','cancelado','faltou')),
 confirmado_em timestamptz, origem text not null check (origem in ('agente','painel')), observacao text not null default '',
 paciente_novo boolean not null, campanha_envio_id uuid,
 foreign key(campanha_envio_id,paciente_id) references public.campanha_envios(id,paciente_id) on delete restrict,
 check (fim > inicio), check (status <> 'confirmado' or confirmado_em is not null),
 exclude using gist (tstzrange(inicio,fim,'[)') with &&) where (status in ('sugerido','confirmado'))
);
create index on public.agendamentos(paciente_id,inicio desc);
create index on public.agendamentos(inicio);
create index on public.agendamentos(campanha_envio_id) where campanha_envio_id is not null;
create table public.bloqueios (
 id uuid primary key default gen_random_uuid(), inicio timestamptz not null, fim timestamptz not null,
 check (fim > inicio), exclude using gist (tstzrange(inicio,fim,'[)') with &&)
);
create table public.base_conhecimento (
 id uuid primary key default gen_random_uuid(), pergunta text not null check (btrim(pergunta) <> ''),
 resposta text not null check (btrim(resposta) <> ''), palavras_chave text[] not null default '{}', ativo boolean not null default true
);
create index on public.base_conhecimento using gin(to_tsvector('portuguese',pergunta || ' ' || resposta));
create index on public.base_conhecimento using gin(palavras_chave);
create table public.regras_escalonamento (
 id uuid primary key default gen_random_uuid(), gatilho text not null check(btrim(gatilho) <> ''),
 acao text not null check(btrim(acao) <> ''), ativo boolean not null default true
);
create table public.config (chave text primary key, valor jsonb not null);
create table public.eventos (
 id uuid primary key default gen_random_uuid(), tipo text not null, payload jsonb not null default '{}', criado_em timestamptz not null default now()
);
create index on public.eventos(criado_em desc);
create index on public.eventos(tipo,criado_em desc);
create table public.consumo_ia (
 id uuid primary key default gen_random_uuid(), referencia_externa text not null unique check(btrim(referencia_externa) <> ''),
 periodo_inicio timestamptz not null, periodo_fim timestamptz not null, gasto_usd numeric(18,6) not null check(gasto_usd >= 0),
 cambio_usd_brl numeric(18,6) check(cambio_usd_brl > 0), fonte_consumo text not null check(btrim(fonte_consumo) <> ''),
 fonte_cambio text, atualizado_em timestamptz not null default now(), check(periodo_fim > periodo_inicio)
);
create index on public.consumo_ia(periodo_inicio,periodo_fim);
create table public.conta_autorizada (id uuid primary key references auth.users on delete restrict);
create unique index conta_unica on public.conta_autorizada ((true));

create function public.conta_permitida() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.conta_autorizada where id = (select auth.uid()));
$$;
create function privado.exigir_acesso() returns void language plpgsql stable set search_path = '' as $$
begin
 if coalesce(auth.role(),'') <> 'service_role' and not public.conta_permitida() then
   raise exception 'nao_autorizado' using errcode = '42501';
 end if;
end $$;
create function privado.travar_agenda() returns trigger language plpgsql set search_path = '' as $$
begin perform pg_advisory_xact_lock(17092026,1); return null; end $$;
create trigger trava_agenda before insert or update or delete on public.agendamentos for each statement execute function privado.travar_agenda();
create trigger trava_bloqueios before insert or update or delete on public.bloqueios for each statement execute function privado.travar_agenda();
create trigger trava_config before insert or update or delete on public.config for each statement execute function privado.travar_agenda();
create function privado.auditar() returns trigger language plpgsql security definer set search_path = '' as $$
declare anterior jsonb := coalesce(to_jsonb(old),'{}'); posterior jsonb := coalesce(to_jsonb(new),'{}'); chaves jsonb;
begin
 select coalesce(jsonb_agg(k),'[]') into chaves from (select key k from jsonb_each(anterior || posterior) where anterior->key is distinct from posterior->key) s;
 insert into public.eventos(tipo,payload) values(tg_table_name || '.' || lower(tg_op),
 jsonb_build_object('referencia',coalesce(posterior->>'id',anterior->>'id',posterior->>'chave',anterior->>'chave'),
 'chaves',chaves,'ator',auth.uid(),'papel',auth.role()));
 return coalesce(new,old);
end $$;
create trigger auditar_config after insert or update or delete on public.config for each row execute function privado.auditar();
create trigger auditar_conhecimento after insert or update or delete on public.base_conhecimento for each row execute function privado.auditar();
create function privado.somente_acrescentar() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Auditoria não pode ser alterada.' using errcode = '42501'; end $$;
create trigger eventos_imutaveis before update or delete or truncate on public.eventos for each statement execute function privado.somente_acrescentar();

do $$ declare t text; begin
 foreach t in array array['pacientes','conversas','mensagens','agendamentos','bloqueios','campanha_envios','base_conhecimento','regras_escalonamento','config','eventos','consumo_ia','conta_autorizada'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 if t <> 'conta_autorizada' then
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy painel_leitura on public.%I for select to authenticated using ((select public.conta_permitida()))',t);
 end if;
 end loop;
end $$;
grant update(observacoes) on public.pacientes to authenticated;
create policy painel_observacao on public.pacientes for update to authenticated using ((select public.conta_permitida())) with check ((select public.conta_permitida()));
grant insert,update,delete on public.base_conhecimento to authenticated;
create policy painel_conhecimento on public.base_conhecimento for all to authenticated using ((select public.conta_permitida())) with check ((select public.conta_permitida()));
revoke all on function public.conta_permitida() from public, anon;
grant execute on function public.conta_permitida() to authenticated,service_role;
revoke all on all functions in schema privado from public,anon,authenticated;
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
end $$;
alter publication supabase_realtime add table public.mensagens,public.conversas;
commit;
