-- Multi-consultório: cada linha de dado pertence a um consultório; RLS por participação.
-- O usuário tem um consultório "ativo" (preferencias) e só enxerga/edita o que é dele.
-- Mantém as RPCs existentes (security definer) acrescentando filtro explícito por consultório.
begin;
create extension if not exists btree_gist;

-- ---------- consultórios, membros, preferências ----------
create table public.consultorios (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (btrim(nome) <> ''),
 demo boolean not null default false,
 principal boolean not null default false,
 criado_em timestamptz not null default now()
);
create unique index consultorio_principal_unico on public.consultorios ((true)) where principal;
create table public.membros (
 consultorio_id uuid not null references public.consultorios on delete cascade,
 user_id uuid not null references auth.users on delete cascade,
 papel text not null default 'dono' check (papel in ('dono','profissional','recepcao')),
 criado_em timestamptz not null default now(),
 primary key (consultorio_id, user_id)
);
create index on public.membros(user_id);
create table public.preferencias (
 user_id uuid primary key references auth.users on delete cascade,
 consultorio_id uuid references public.consultorios on delete set null,
 atualizado_em timestamptz not null default now()
);

-- Consultório ativo: preferência do usuário, senão o primeiro em que é membro.
-- Para service_role (n8n, scripts): current_setting('app.consultorio') ou o consultório principal.
create or replace function public.consultorio_atual() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c uuid; fixado text;
begin
 if uid is not null then
  select p.consultorio_id into c from public.preferencias p join public.membros m on m.consultorio_id = p.consultorio_id and m.user_id = p.user_id where p.user_id = uid;
  if c is null then select m.consultorio_id into c from public.membros m where m.user_id = uid order by m.criado_em limit 1; end if;
  return c;
 end if;
 fixado := current_setting('app.consultorio', true);
 if coalesce(fixado,'') <> '' then return fixado::uuid; end if;
 select id into c from public.consultorios where principal limit 1;
 return c;
end $$;
revoke all on function public.consultorio_atual() from public, anon;
grant execute on function public.consultorio_atual() to authenticated, service_role;

-- Acesso: é membro de algum consultório (substitui a conta única).
drop index if exists public.conta_unica;
create or replace function public.conta_permitida() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.membros where user_id = (select auth.uid()));
$$;

create function public.escolher_consultorio(p_consultorio uuid) returns uuid language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.membros where user_id = auth.uid() and consultorio_id = p_consultorio) then raise exception 'nao_autorizado' using errcode = '42501'; end if;
 insert into public.preferencias(user_id, consultorio_id) values (auth.uid(), p_consultorio)
 on conflict (user_id) do update set consultorio_id = excluded.consultorio_id, atualizado_em = now();
 return p_consultorio;
end $$;
create function public.meus_consultorios() returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'demo', c.demo, 'papel', m.papel, 'ativo', c.id = public.consultorio_atual()) order by c.demo, c.nome), '[]')
 from public.membros m join public.consultorios c on c.id = m.consultorio_id where m.user_id = auth.uid();
$$;
revoke all on function public.escolher_consultorio(uuid), public.meus_consultorios() from public, anon;
grant execute on function public.escolher_consultorio(uuid), public.meus_consultorios() to authenticated, service_role;

-- ---------- profissionais e convênios ----------
create table public.profissionais (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 nome text not null check (btrim(nome) <> ''), cro text not null default '', cor text not null default '#1570EF',
 user_id uuid references auth.users on delete set null, ativo boolean not null default true, ordem integer not null default 0,
 criado_em timestamptz not null default now()
);
create index on public.profissionais(consultorio_id, ativo, ordem);
create table public.convenios (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 nome text not null check (btrim(nome) <> ''), cor text not null default '#475467', ativo boolean not null default true,
 unique (consultorio_id, nome)
);

-- Retornos (pacientes que precisam voltar); criada aqui porque resumo_do_dia conta os pendentes.
create table public.retornos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 motivo text not null check (btrim(motivo) <> ''), previsto_para date not null,
 status text not null default 'pendente' check (status in ('pendente','contatado','agendado','descartado')),
 contatado_em timestamptz, agendamento_id uuid references public.agendamentos on delete set null,
 criado_em timestamptz not null default now(), criado_por uuid references auth.users on delete set null
);
create index on public.retornos(consultorio_id, status, previsto_para);
alter table public.retornos enable row level security;
revoke all on public.retornos from anon, authenticated; grant all on public.retornos to service_role;
grant select, insert, update, delete on public.retornos to authenticated;
create policy consultorio_tudo on public.retornos for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));

-- ---------- consultorio_id nas tabelas existentes ----------
alter table public.pacientes add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete restrict;
alter table public.pacientes drop constraint pacientes_telefone_e164_key;
alter table public.pacientes add constraint pacientes_telefone_por_consultorio unique (consultorio_id, telefone_e164);
alter table public.pacientes add column cpf text not null default '' check (cpf = '' or cpf ~ '^[0-9]{11}$');
alter table public.pacientes add column nascimento date;
alter table public.pacientes add column email text not null default '';
alter table public.pacientes add column endereco text not null default '';
alter table public.pacientes add column convenio_id uuid references public.convenios on delete set null;
alter table public.pacientes add column numero_carteirinha text not null default '';
alter table public.pacientes add column criado_por uuid references auth.users on delete set null;
create index on public.pacientes(consultorio_id, nome);

alter table public.conversas add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete restrict;
create index on public.conversas(consultorio_id, status);
alter table public.mensagens add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete restrict;
alter table public.campanha_envios add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete restrict;
alter table public.base_conhecimento add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade;
alter table public.regras_escalonamento add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade;
alter table public.eventos add column consultorio_id uuid default public.consultorio_atual();
alter table public.consumo_ia add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade;

-- As linhas padrão da migração 2 não pertencem a consultório nenhum; config_padrao() já cobre o padrão.
alter table public.config disable trigger config_valida;
delete from public.config;
alter table public.config enable trigger config_valida;
alter table public.config drop constraint config_pkey;
alter table public.config add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade;
alter table public.config add primary key (consultorio_id, chave);

alter table public.bloqueios add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade;
alter table public.bloqueios add column profissional_id uuid references public.profissionais on delete cascade;
alter table public.bloqueios add column motivo text not null default '';
do $$ declare n text; begin
 for n in select conname from pg_constraint where conrelid = 'public.bloqueios'::regclass and contype = 'x' loop execute format('alter table public.bloqueios drop constraint %I', n); end loop;
 for n in select conname from pg_constraint where conrelid = 'public.agendamentos'::regclass and contype = 'x' loop execute format('alter table public.agendamentos drop constraint %I', n); end loop;
end $$;
alter table public.bloqueios add constraint bloqueios_sem_sobreposicao exclude using gist (consultorio_id with =, coalesce(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid) with =, tstzrange(inicio,fim,'[)') with &&);

alter table public.agendamentos add column consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete restrict;
alter table public.agendamentos add column profissional_id uuid references public.profissionais on delete restrict;
alter table public.agendamentos add column convenio_id uuid references public.convenios on delete set null;
alter table public.agendamentos add column valor numeric(12,2) not null default 0 check (valor >= 0);
alter table public.agendamentos add column confirmacao_enviada_em timestamptz;
alter table public.agendamentos add column criado_por uuid references auth.users on delete set null;
alter table public.agendamentos drop constraint agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check check (status in ('sugerido','agendado','confirmado','cancelado','faltou','concluido'));
alter table public.agendamentos add constraint agendamentos_sem_sobreposicao exclude using gist (consultorio_id with =, coalesce(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid) with =, tstzrange(inicio,fim,'[)') with &&) where (status in ('sugerido','agendado','confirmado'));
create index on public.agendamentos(consultorio_id, inicio);

-- ---------- RLS por consultório ----------
do $$ declare t text; begin
 foreach t in array array['pacientes','conversas','mensagens','agendamentos','bloqueios','campanha_envios','base_conhecimento','regras_escalonamento','config','eventos','consumo_ia'] loop
  execute format('drop policy if exists painel_leitura on public.%I', t);
  execute format('create policy consultorio_le on public.%I for select to authenticated using (consultorio_id = (select public.consultorio_atual()))', t);
 end loop;
end $$;
drop policy if exists painel_observacao on public.pacientes;
drop policy if exists painel_conhecimento on public.base_conhecimento;
grant insert, update on public.pacientes to authenticated;
create policy consultorio_escreve on public.pacientes for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));
create policy consultorio_escreve on public.base_conhecimento for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));
grant insert, update on public.agendamentos to authenticated;
create policy consultorio_escreve on public.agendamentos for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));
grant insert, update, delete on public.bloqueios to authenticated;
create policy consultorio_escreve on public.bloqueios for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));

do $$ declare t text; begin
 foreach t in array array['consultorios','membros','preferencias','profissionais','convenios'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
 end loop;
end $$;
grant select on public.consultorios to authenticated;
create policy membro_le on public.consultorios for select to authenticated using (exists(select 1 from public.membros m where m.consultorio_id = id and m.user_id = (select auth.uid())));
grant select on public.membros to authenticated;
create policy proprio_le on public.membros for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.profissionais, public.convenios to authenticated;
create policy consultorio_tudo on public.profissionais for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));
create policy consultorio_tudo on public.convenios for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()));

-- ---------- funções existentes, agora filtradas por consultório ----------
create or replace function privado.config_atual() returns jsonb language sql volatile set search_path = '' as $$
 select privado.config_padrao() || coalesce((select jsonb_object_agg(chave,valor) from public.config where consultorio_id = public.consultorio_atual()),'{}');
$$;
create or replace function public.salvar_config(p_alteracoes jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 c := privado.config_atual() || p_alteracoes; perform privado.validar_config(c);
 insert into public.config(consultorio_id, chave, valor) select atual, key, value from jsonb_each(p_alteracoes) on conflict(consultorio_id, chave) do update set valor=excluded.valor;
 return c;
end $$;
create or replace function privado.novos_semana(p_inicio timestamptz,p_excluir uuid default null) returns bigint language sql volatile set search_path = '' as $$
 select count(*) from public.agendamentos where consultorio_id = public.consultorio_atual() and paciente_novo and status <> 'cancelado'
 and inicio >= privado.semana(p_inicio) and inicio < ((privado.semana(p_inicio) at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo'
 and (p_excluir is null or id <> p_excluir);
$$;
-- Conflito agora considera o profissional (null = agenda geral) e o consultório. Sobreposição é a exclusion constraint;
-- aqui só avisamos com motivo legível.
create or replace function privado.motivo_horario(p_tipo text,p_inicio timestamptz,p_fim timestamptz,p_novo boolean,p_excluir uuid default null,p_antecedencia boolean default true,p_profissional uuid default null)
 returns text language plpgsql volatile set search_path = '' as $$
declare c jsonb := privado.config_atual(); local_inicio timestamp := p_inicio at time zone 'America/Sao_Paulo'; local_fim timestamp := p_fim at time zone 'America/Sao_Paulo'; dia text; atual uuid := public.consultorio_atual();
begin
 if not (c->>'agenda_ativa')::boolean or not (c->'duracoes_por_tipo' ? p_tipo) then return 'nao_configurado'; end if;
 if p_novo and (c->>'teto_pacientes_novos_semana')::integer > 0 and privado.novos_semana(p_inicio,p_excluir) >= (c->>'teto_pacientes_novos_semana')::integer then return 'teto_semanal'; end if;
 if p_antecedencia and p_inicio < now() + make_interval(mins => (c->>'antecedencia_minima_minutos')::integer) then return 'antecedencia'; end if;
 if p_fim <= p_inicio then return 'duracao'; end if;
 dia := (array['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[extract(dow from local_inicio)::integer+1];
 if local_inicio::date <> local_fim::date or not exists(select 1 from jsonb_array_elements(c->'horarios_atendimento'->dia) f where local_inicio::time >= (f->>'inicio')::time and local_fim::time <= (f->>'fim')::time) then return 'fora_expediente'; end if;
 if exists(select 1 from public.bloqueios where consultorio_id = atual and (profissional_id is null or p_profissional is null or profissional_id = p_profissional) and tstzrange(inicio,fim,'[)') && tstzrange(p_inicio,p_fim,'[)'))
  or exists(select 1 from public.agendamentos where consultorio_id = atual and status in ('sugerido','agendado','confirmado') and (p_excluir is null or id <> p_excluir) and (profissional_id is not distinct from p_profissional) and tstzrange(inicio,fim,'[)') && tstzrange(p_inicio,p_fim,'[)')) then return 'conflito'; end if;
 return null;
end $$;
create or replace function privado.validar_agendamento() returns trigger language plpgsql security definer set search_path = '' as $$
declare motivo text; mudou boolean;
begin
 if tg_op = 'DELETE' then return old; end if;
 if tg_op = 'INSERT' then
  new.paciente_novo := not exists(select 1 from public.pacientes where id=new.paciente_id and status='paciente') and not exists(select 1 from public.agendamentos where paciente_id=new.paciente_id and status in ('confirmado','concluido') and fim < now());
  mudou := true;
 else
  if new.paciente_id <> old.paciente_id or new.paciente_novo <> old.paciente_novo then raise exception 'Classificação histórica imutável' using errcode='22023'; end if;
  mudou := (new.inicio,new.fim,new.tipo,new.profissional_id) is distinct from (old.inicio,old.fim,old.tipo,old.profissional_id);
  if old.status in ('cancelado','faltou','concluido') and (mudou or new.status <> old.status) then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
 end if;
 if new.status in ('sugerido','agendado','confirmado') then
  -- Pelo painel (origem 'painel') o profissional decide o horário: só bloqueamos conflito real e duração inválida.
  if new.origem = 'painel' then
   if new.fim <= new.inicio then raise exception 'duracao' using errcode='23514'; end if;
   if mudou and exists(select 1 from public.bloqueios b where b.consultorio_id = new.consultorio_id and (b.profissional_id is null or new.profissional_id is null or b.profissional_id = new.profissional_id) and tstzrange(b.inicio,b.fim,'[)') && tstzrange(new.inicio,new.fim,'[)')) then raise exception 'conflito' using errcode='23514'; end if;
  else
   motivo := privado.motivo_horario(new.tipo,new.inicio,new.fim,new.paciente_novo,new.id,mudou,new.profissional_id);
   if motivo is not null then raise exception '%',motivo using errcode='23514'; end if;
  end if;
 elsif tg_op = 'INSERT' then raise exception 'Estado inicial inválido' using errcode='23514';
 end if;
 return new;
end $$;
create or replace function privado.validar_bloqueio() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from public.agendamentos a where a.consultorio_id = new.consultorio_id and a.status in ('sugerido','agendado','confirmado') and (new.profissional_id is null or a.profissional_id is null or a.profissional_id = new.profissional_id) and tstzrange(a.inicio,a.fim,'[)') && tstzrange(new.inicio,new.fim,'[)')) then raise exception 'conflito' using errcode='23514'; end if;
 return new;
end $$;
create or replace function public.criar_bloqueio(p_inicio timestamptz,p_fim timestamptz) returns public.bloqueios language plpgsql security definer set search_path = '' as $$
declare b public.bloqueios;
begin perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 insert into public.bloqueios(inicio,fim,consultorio_id) values(p_inicio,p_fim,public.consultorio_atual()) returning * into b; return b; end $$;
create function public.criar_bloqueio_painel(p_inicio timestamptz,p_fim timestamptz,p_profissional uuid default null,p_motivo text default '') returns public.bloqueios language plpgsql security definer set search_path = '' as $$
declare b public.bloqueios;
begin perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 insert into public.bloqueios(inicio,fim,consultorio_id,profissional_id,motivo) values(p_inicio,p_fim,public.consultorio_atual(),p_profissional,coalesce(p_motivo,'')) returning * into b; return b; end $$;
create function public.remover_bloqueio(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 delete from public.bloqueios where id = p_id and consultorio_id = public.consultorio_atual();
 if not found then raise exception 'Bloqueio não encontrado' using errcode='P0002'; end if; end $$;

create or replace function privado.alterar_agendamento(p_id uuid,p_acao text,p_inicio timestamptz default null) returns public.agendamentos language plpgsql set search_path = '' as $$
declare a public.agendamentos; duracao integer;
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 select * into a from public.agendamentos where id=p_id and consultorio_id = public.consultorio_atual() for update;
 if not found then raise exception 'Agendamento não encontrado' using errcode='P0002'; end if;
 if p_acao='confirmar' then
  if a.status not in ('sugerido','agendado') then raise exception 'Somente sugestões ou agendados' using errcode='23514'; end if;
  update public.agendamentos set status='confirmado',confirmado_em=now() where id=p_id returning * into a;
 elsif p_acao='falta' then
  if a.status not in ('confirmado','agendado') then raise exception 'Somente confirmados' using errcode='23514'; end if;
  update public.agendamentos set status='faltou' where id=p_id returning * into a;
 elsif p_acao='concluir' then
  if a.status not in ('confirmado','agendado') then raise exception 'Somente confirmados' using errcode='23514'; end if;
  update public.agendamentos set status='concluido' where id=p_id returning * into a;
  update public.pacientes set status='paciente' where id=a.paciente_id and status <> 'fora_da_base';
 elsif p_acao='cancelar' then
  if a.status not in ('sugerido','agendado','confirmado') then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
  update public.agendamentos set status='cancelado' where id=p_id returning * into a;
 elsif p_acao='remarcar' then
  if a.status not in ('sugerido','agendado','confirmado') then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
  duracao := coalesce((privado.config_atual()->'duracoes_por_tipo'->>a.tipo)::integer, (extract(epoch from (a.fim - a.inicio))/60)::integer);
  if duracao is null or p_inicio is null then raise exception 'Horário inválido' using errcode='22023'; end if;
  update public.agendamentos set inicio=p_inicio,fim=p_inicio+make_interval(mins=>duracao) where id=p_id returning * into a;
 else raise exception 'Operação inválida' using errcode='22023'; end if;
 return a;
end $$;
create function public.concluir_agendamento(p_agendamento_id uuid) returns public.agendamentos language sql security definer set search_path = '' as $$ select privado.alterar_agendamento(p_agendamento_id,'concluir'); $$;

-- Agendamento criado pelo painel (recepção/dentista): paciente existente, profissional e convênio.
create function public.criar_agendamento_painel(p_paciente uuid,p_tipo text,p_inicio timestamptz,p_duracao_min integer,p_profissional uuid default null,p_convenio uuid default null,p_observacao text default '',p_valor numeric default 0,p_status text default 'agendado')
 returns public.agendamentos language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 if p_duracao_min is null or p_duracao_min < 5 or p_duracao_min > 720 then raise exception 'Duração inválida' using errcode='22023'; end if;
 if p_status not in ('agendado','confirmado') then raise exception 'Estado inválido' using errcode='22023'; end if;
 if not exists(select 1 from public.pacientes where id=p_paciente and consultorio_id=atual) then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
 insert into public.agendamentos(consultorio_id,paciente_id,tipo,inicio,fim,status,confirmado_em,origem,observacao,paciente_novo,profissional_id,convenio_id,valor,criado_por)
 values(atual,p_paciente,p_tipo,p_inicio,p_inicio+make_interval(mins=>p_duracao_min),p_status,case when p_status='confirmado' then now() end,'painel',coalesce(p_observacao,''),true,p_profissional,p_convenio,coalesce(p_valor,0),auth.uid())
 returning * into a;
 update public.pacientes set status = case when status in ('novo','em_conversa') then 'agendado' else status end where id = p_paciente;
 return a;
end $$;
create function public.editar_agendamento(p_id uuid,p_alteracoes jsonb) returns public.agendamentos language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos; duracao integer;
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 select * into a from public.agendamentos where id=p_id and consultorio_id=public.consultorio_atual() for update;
 if not found then raise exception 'Agendamento não encontrado' using errcode='P0002'; end if;
 duracao := coalesce((p_alteracoes->>'duracao_min')::integer, (extract(epoch from (a.fim - a.inicio))/60)::integer);
 update public.agendamentos set
  tipo = coalesce(p_alteracoes->>'tipo', tipo),
  inicio = coalesce((p_alteracoes->>'inicio')::timestamptz, inicio),
  fim = coalesce((p_alteracoes->>'inicio')::timestamptz, inicio) + make_interval(mins=>duracao),
  profissional_id = case when p_alteracoes ? 'profissional_id' then nullif(p_alteracoes->>'profissional_id','')::uuid else profissional_id end,
  convenio_id = case when p_alteracoes ? 'convenio_id' then nullif(p_alteracoes->>'convenio_id','')::uuid else convenio_id end,
  observacao = coalesce(p_alteracoes->>'observacao', observacao),
  valor = coalesce((p_alteracoes->>'valor')::numeric, valor)
 where id=p_id returning * into a;
 return a;
end $$;

create or replace function privado.resumos() returns setof jsonb language sql stable set search_path = '' as $$
 select to_jsonb(c) || jsonb_build_object('paciente',to_jsonb(p),'ultima_mensagem',
 (select to_jsonb(m) from public.mensagens m where conversa_id=c.id order by criada_em desc,id desc limit 1))
 from public.conversas c join public.pacientes p on p.id=c.paciente_id where c.consultorio_id = public.consultorio_atual();
$$;
create or replace function privado.agenda(p_data date,p_dias integer,p_filtro jsonb default '{}') returns jsonb language sql stable set search_path = '' as $$
 select jsonb_build_object('inicio',p_data,'fim_exclusivo',p_data+p_dias,
 'agendamentos',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('paciente',to_jsonb(p),'profissional',(select to_jsonb(pr) from public.profissionais pr where pr.id=a.profissional_id),'convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=coalesce(a.convenio_id,p.convenio_id))) order by a.inicio,a.id),'[]') from public.agendamentos a join public.pacientes p on p.id=a.paciente_id
 where a.consultorio_id = public.consultorio_atual() and a.inicio < (p_data+p_dias)::timestamp at time zone 'America/Sao_Paulo' and a.fim > p_data::timestamp at time zone 'America/Sao_Paulo'
 and (not p_filtro ? 'status' or a.status=p_filtro->>'status') and (not p_filtro ? 'paciente_id' or a.paciente_id=(p_filtro->>'paciente_id')::uuid)
 and (not p_filtro ? 'profissional_id' or a.profissional_id=(p_filtro->>'profissional_id')::uuid)),
 'bloqueios',(select coalesce(jsonb_agg(to_jsonb(b) order by inicio),'[]') from public.bloqueios b where b.consultorio_id = public.consultorio_atual() and inicio < (p_data+p_dias)::timestamp at time zone 'America/Sao_Paulo' and fim > p_data::timestamp at time zone 'America/Sao_Paulo'
 and (not p_filtro ? 'profissional_id' or b.profissional_id is null or b.profissional_id=(p_filtro->>'profissional_id')::uuid)),
 'profissionais',(select coalesce(jsonb_agg(to_jsonb(pr) order by ordem, nome),'[]') from public.profissionais pr where pr.consultorio_id = public.consultorio_atual() and pr.ativo),
 'convenios',(select coalesce(jsonb_agg(to_jsonb(cv) order by nome),'[]') from public.convenios cv where cv.consultorio_id = public.consultorio_atual() and cv.ativo),
 'pacientes_novos_semana',privado.novos_semana(p_data::timestamp at time zone 'America/Sao_Paulo'),
 'teto_pacientes_novos_semana',privado.config_atual()->'teto_pacientes_novos_semana');
$$;
create or replace function public.resumo_do_dia(p_data date default (now() at time zone 'America/Sao_Paulo')::date) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a jsonb; d_ini timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo'; d_fim timestamptz := (p_data+1)::timestamp at time zone 'America/Sao_Paulo'; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso(); a := privado.agenda(p_data,1);
 return jsonb_build_object('data',p_data,'escaladas',(select coalesce(jsonb_agg(r order by (r->>'urgente')::boolean desc,r->>'iniciada_em'),'[]') from privado.resumos() r where r->>'status'='escalada'),
 'agenda',a->'agendamentos','bloqueios',a->'bloqueios','pacientes_novos_semana',a->'pacientes_novos_semana','teto_pacientes_novos_semana',a->'teto_pacientes_novos_semana',
 'contatos_novos_24h',(select count(*) from public.pacientes where consultorio_id = atual and primeiro_contato >= now()-interval '24 hours' and primeiro_contato <= now()),
 'mensagens_ia_hoje',(select count(*) from public.mensagens where consultorio_id = atual and autor='agente' and criada_em>=d_ini and criada_em < d_fim),
 'faturamento_previsto',(select coalesce(sum(ag.valor),0) from public.agendamentos ag where ag.consultorio_id = atual and ag.status in ('agendado','confirmado','concluido') and ag.inicio >= d_ini and ag.inicio < d_fim),
 'faturamento_realizado',(select coalesce(sum(ag.valor),0) from public.agendamentos ag where ag.consultorio_id = atual and ag.status = 'concluido' and ag.inicio >= d_ini and ag.inicio < d_fim),
 'comparecimento_30d',(select jsonb_build_object('compareceram',count(*) filter (where status in ('concluido')),'faltaram',count(*) filter (where status='faltou'),'total',count(*) filter (where status in ('concluido','faltou')))
   from public.agendamentos where consultorio_id = atual and inicio >= now()-interval '30 days' and inicio < now()),
 'confirmacoes_pendentes',(select count(*) from public.agendamentos where consultorio_id = atual and status='agendado' and inicio >= now() and inicio < now()+interval '48 hours'),
 'retornos_pendentes',(select count(*) from public.retornos where consultorio_id = atual and status='pendente' and previsto_para <= (now() at time zone 'America/Sao_Paulo')::date + 14));
end $$;
create or replace function public.painel_leitura(p_operacao text,p_argumentos jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb; cfg jsonb; pid uuid; data_inicio date; limite integer; deslocamento integer; mes_inicio timestamptz; mes_fim timestamptz; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso();
 case p_operacao
 when 'conversas' then
  limite := coalesce((p_argumentos->>'limite')::integer,50); deslocamento := coalesce((p_argumentos->>'deslocamento')::integer,0);
  if limite not between 1 and 100 or deslocamento < 0 then raise exception 'Paginação inválida' using errcode='22023'; end if;
  select coalesce(jsonb_agg(r),'[]') into resultado from (select r from privado.resumos() r
   where (coalesce(p_argumentos->>'status','todas')='todas' or r->>'status'=p_argumentos->>'status')
   and (not p_argumentos ? 'paciente_id' or r->>'paciente_id'=p_argumentos->>'paciente_id')
   and (not p_argumentos ? 'urgente' or r->'urgente'=p_argumentos->'urgente')
   and (coalesce(p_argumentos->>'busca','')='' or position(lower(p_argumentos->>'busca') in lower(r->'paciente'->>'nome'))>0 or position(p_argumentos->>'busca' in r->'paciente'->>'telefone_e164')>0)
   order by coalesce(r->'ultima_mensagem'->>'criada_em',r->>'iniciada_em') desc limit limite offset deslocamento) s;
 when 'conversa' then
  select jsonb_build_object('conversa',to_jsonb(c),'paciente',to_jsonb(p),'mensagens',(select coalesce(jsonb_agg(to_jsonb(m) order by criada_em,id),'[]') from public.mensagens m where conversa_id=c.id)) into resultado
  from public.conversas c join public.pacientes p on p.id=c.paciente_id where c.id=(p_argumentos->>'id')::uuid and c.consultorio_id = atual;
 when 'pacientes' then
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('contagem_conversas',(select count(*) from public.conversas where paciente_id=p.id),'convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=p.convenio_id),
   'proximo_agendamento',(select to_jsonb(a) from public.agendamentos a where a.paciente_id=p.id and a.status in ('agendado','confirmado','sugerido') and a.inicio >= now() order by a.inicio limit 1)) order by nome,id),'[]') into resultado from public.pacientes p
  where p.consultorio_id = atual and (coalesce(p_argumentos->>'busca','')='' or position(lower(p_argumentos->>'busca') in lower(nome))>0 or position(p_argumentos->>'busca' in telefone_e164)>0 or position(p_argumentos->>'busca' in cpf)>0);
 when 'paciente' then
  pid := (p_argumentos->>'id')::uuid;
  select jsonb_build_object('paciente',to_jsonb(p)||jsonb_build_object('convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=p.convenio_id)),'conversas',(select coalesce(jsonb_agg(c order by iniciada_em desc),'[]') from public.conversas c where paciente_id=pid),
  'agendamentos',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('profissional',(select to_jsonb(pr) from public.profissionais pr where pr.id=a.profissional_id)) order by inicio desc),'[]') from public.agendamentos a where paciente_id=pid)) into resultado from public.pacientes p where id=pid and consultorio_id = atual;
 when 'agenda' then
  data_inicio := (p_argumentos->>'data')::date;
  if data_inicio is null or coalesce((p_argumentos->>'dias')::integer,0) not in (1,7) then raise exception 'Data inválida' using errcode='22023'; end if;
  resultado := privado.agenda(data_inicio,(p_argumentos->>'dias')::integer,coalesce(p_argumentos->'filtro','{}'));
 when 'campanha' then
  select jsonb_build_object('pausada',privado.config_atual()->'campanha_pausada','total',count(*),'fila',count(*) filter(where status='fila'),
  'enviadas',count(*) filter(where status='enviada'),'respondidas',count(*) filter(where status='respondida'),'erro',count(*) filter(where status='erro'),'bloqueadas',count(*) filter(where status='bloqueada'),
  'agendadas',(select count(distinct paciente_id) from public.agendamentos where consultorio_id = atual and campanha_envio_id is not null and status='confirmado'),'envios',coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('paciente_nome',(select nome from public.pacientes where id=e.paciente_id)) order by leva,id),'[]')) into resultado from public.campanha_envios e where e.consultorio_id = atual;
 when 'consumo' then
  cfg := privado.config_atual(); mes_inicio := date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; mes_fim := ((mes_inicio at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo';
  select jsonb_build_object('mes',to_char(mes_inicio at time zone 'America/Sao_Paulo','YYYY-MM'),
   'gasto_usd',sum(gasto_usd),'gasto_brl',case when bool_and(cambio_usd_brl is not null and coalesce(fonte_cambio,'')<>'') then sum(gasto_usd*cambio_usd_brl) else null end,
   'teto_brl',cfg->'teto_gasto_ia_brl','cambio_usd_brl',case when min(cambio_usd_brl)=max(cambio_usd_brl) and bool_and(cambio_usd_brl is not null) then min(cambio_usd_brl) else null end,
   'fonte_consumo',cfg->>'consumo_fonte','fonte_cambio',cfg->>'cambio_fonte','atualizado_em',max(atualizado_em),
   'status',case when count(*)>0 and bool_and(cambio_usd_brl is not null and coalesce(fonte_cambio,'')<>'') then 'disponivel' else 'nao_configurado' end) into resultado
  from public.consumo_ia where consultorio_id = atual and periodo_inicio>=mes_inicio and periodo_fim<=mes_fim and fonte_consumo=cfg->>'consumo_fonte';
 else raise exception 'Operação inválida' using errcode='22023';
 end case;
 if resultado is null then raise exception 'Não encontrado' using errcode='P0002'; end if;
 return resultado;
end $$;
-- n8n: paciente identificado por telefone dentro do consultório ativo (service_role usa app.consultorio ou o principal).
create or replace function public.contexto_paciente(p_telefone text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pacientes; c public.conversas; cfg jsonb; ms jsonb; proximo jsonb; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso();
 perform pg_advisory_xact_lock(hashtextextended(p_telefone,17));
 insert into public.pacientes(nome,telefone_e164,origem,consultorio_id) values('Contato sem nome',p_telefone,'whatsapp',atual) on conflict(consultorio_id,telefone_e164) do nothing;
 select * into strict p from public.pacientes where telefone_e164=p_telefone and consultorio_id=atual;
 insert into public.conversas(paciente_id,consultorio_id) values(p.id,atual) on conflict(paciente_id) where status <> 'encerrada' do nothing;
 select * into strict c from public.conversas where paciente_id=p.id and status <> 'encerrada' for update;
 if c.status in ('assumida','escalada') and c.agente_pausado_ate <= now() then
  update public.conversas set status='ativa',agente_pausado_ate=null,urgente=false,motivo_escalonamento=null where id=c.id returning * into c;
 end if;
 cfg := privado.config_atual();
 select coalesce(jsonb_agg(to_jsonb(m) order by m.criada_em,m.id),'[]') into ms from (select * from public.mensagens where conversa_id=c.id order by criada_em desc,id desc limit 20) m;
 select to_jsonb(a) into proximo from public.agendamentos a where paciente_id=p.id and status in ('sugerido','agendado','confirmado') and inicio >= now() order by inicio limit 1;
 return jsonb_build_object('paciente',to_jsonb(p),'conversa',to_jsonb(c),'agente_pausado',not (cfg->>'agente_ativo')::boolean or coalesce(c.agente_pausado_ate>now(),false),'mensagens',ms,'proximo_agendamento',proximo,'config',cfg);
end $$;
create or replace function public.buscar_conhecimento(p_pergunta text) returns setof public.base_conhecimento language plpgsql stable security definer set search_path = '' as $$
begin
 perform privado.exigir_acesso();
 return query select b.* from public.base_conhecimento b
 where b.consultorio_id = public.consultorio_atual() and b.ativo and (to_tsvector('portuguese',b.pergunta || ' ' || b.resposta) @@ websearch_to_tsquery('portuguese',p_pergunta)
 or exists(select 1 from unnest(b.palavras_chave) k where position(lower(k) in lower(p_pergunta))>0))
 order by ts_rank(to_tsvector('portuguese',b.pergunta || ' ' || b.resposta),websearch_to_tsquery('portuguese',p_pergunta)) desc,b.id;
end $$;

-- Pacientes: cadastro e edição pelo painel.
create function public.salvar_paciente(p_id uuid, p_dados jsonb) returns public.pacientes language plpgsql security definer set search_path = '' as $$
declare p public.pacientes; atual uuid := public.consultorio_atual();
begin
 perform privado.exigir_acesso();
 if p_id is null then
  insert into public.pacientes(consultorio_id,nome,telefone_e164,origem,cpf,nascimento,email,endereco,convenio_id,numero_carteirinha,observacoes,criado_por,status)
  values(atual, btrim(p_dados->>'nome'), p_dados->>'telefone_e164', coalesce(p_dados->>'origem','indicacao'), regexp_replace(coalesce(p_dados->>'cpf',''),'\D','','g'),
   nullif(p_dados->>'nascimento','')::date, coalesce(p_dados->>'email',''), coalesce(p_dados->>'endereco',''), nullif(p_dados->>'convenio_id','')::uuid, coalesce(p_dados->>'numero_carteirinha',''), coalesce(p_dados->>'observacoes',''), auth.uid(), 'paciente')
  returning * into p;
 else
  update public.pacientes set
   nome = coalesce(nullif(btrim(p_dados->>'nome'),''), nome), telefone_e164 = coalesce(p_dados->>'telefone_e164', telefone_e164),
   cpf = case when p_dados ? 'cpf' then regexp_replace(coalesce(p_dados->>'cpf',''),'\D','','g') else cpf end,
   nascimento = case when p_dados ? 'nascimento' then nullif(p_dados->>'nascimento','')::date else nascimento end,
   email = coalesce(p_dados->>'email', email), endereco = coalesce(p_dados->>'endereco', endereco),
   convenio_id = case when p_dados ? 'convenio_id' then nullif(p_dados->>'convenio_id','')::uuid else convenio_id end,
   numero_carteirinha = coalesce(p_dados->>'numero_carteirinha', numero_carteirinha),
   observacoes = coalesce(p_dados->>'observacoes', observacoes), nao_perturbe = coalesce((p_dados->>'nao_perturbe')::boolean, nao_perturbe)
  where id = p_id and consultorio_id = atual returning * into p;
  if not found then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
 end if;
 return p;
end $$;

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('criar_bloqueio_painel','remover_bloqueio','concluir_agendamento','criar_agendamento_painel','editar_agendamento','salvar_paciente') loop
  execute format('revoke all on function %s from public,anon',f); execute format('grant execute on function %s to authenticated,service_role',f);
 end loop;
end $$;
revoke all on all functions in schema privado from public,anon,authenticated;
commit;
