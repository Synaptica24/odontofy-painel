-- Prontuário (anamnese, odontograma, evolução imutável, anexos), orçamentos, contratos com assinatura,
-- e trilha de acesso ao prontuário (LGPD). Tudo por consultório, com RLS.
begin;

-- ---------- anamnese ----------
create table public.anamneses (
 paciente_id uuid primary key references public.pacientes on delete cascade,
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 alergias text not null default '', medicamentos text not null default '', doencas text not null default '',
 gestante boolean not null default false, fumante boolean not null default false, diabetes boolean not null default false,
 hipertensao boolean not null default false, cardiopatia boolean not null default false, anticoagulante boolean not null default false,
 cirurgias text not null default '', queixa_principal text not null default '', observacoes text not null default '',
 atualizado_em timestamptz not null default now(), atualizado_por uuid references auth.users on delete set null
);

-- ---------- odontograma ----------
create table public.odontograma (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 dente integer not null check (dente between 11 and 48 and dente % 10 between 1 and 8),
 face text not null default 'todas' check (face in ('todas','V','L','M','D','O','I','P')),
 procedimento text not null check (btrim(procedimento) <> ''),
 status text not null default 'planejado' check (status in ('existente','planejado','realizado')),
 observacao text not null default '', valor numeric(12,2) not null default 0 check (valor >= 0),
 profissional_id uuid references public.profissionais on delete set null,
 registrado_em timestamptz not null default now(), registrado_por uuid references auth.users on delete set null,
 realizado_em timestamptz
);
create index on public.odontograma(paciente_id, dente);

-- ---------- evolução clínica: só acrescenta ----------
create table public.evolucoes (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 profissional_id uuid references public.profissionais on delete set null,
 agendamento_id uuid references public.agendamentos on delete set null,
 texto text not null check (btrim(texto) <> ''),
 corrige_id uuid references public.evolucoes on delete restrict,
 criado_em timestamptz not null default now(), criado_por uuid references auth.users on delete set null
);
create index on public.evolucoes(paciente_id, criado_em desc);
create trigger evolucoes_imutaveis before update or delete or truncate on public.evolucoes for each statement execute function privado.somente_acrescentar();

-- ---------- anexos (Storage privado) ----------
create table public.anexos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 nome text not null check (btrim(nome) <> ''), tipo_mime text not null default 'application/octet-stream',
 categoria text not null default 'documento' check (categoria in ('raio_x','foto','documento','exame','outro')),
 caminho text not null unique, tamanho integer not null default 0 check (tamanho >= 0),
 descricao text not null default '',
 criado_em timestamptz not null default now(), criado_por uuid references auth.users on delete set null
);
create index on public.anexos(paciente_id, criado_em desc);

-- ---------- orçamentos / plano de tratamento ----------
create table public.orcamentos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 titulo text not null default 'Plano de tratamento',
 status text not null default 'pendente' check (status in ('pendente','aprovado','recusado')),
 desconto numeric(12,2) not null default 0 check (desconto >= 0),
 observacao text not null default '', validade date,
 decidido_em timestamptz,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), criado_por uuid references auth.users on delete set null
);
create index on public.orcamentos(consultorio_id, status, criado_em desc);
create table public.orcamento_itens (
 id uuid primary key default gen_random_uuid(),
 orcamento_id uuid not null references public.orcamentos on delete cascade,
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 descricao text not null check (btrim(descricao) <> ''), dente integer check (dente is null or (dente between 11 and 48)),
 quantidade integer not null default 1 check (quantidade > 0), valor_unitario numeric(12,2) not null default 0 check (valor_unitario >= 0),
 ordem integer not null default 0
);
create index on public.orcamento_itens(orcamento_id, ordem);

-- ---------- contratos: modelos e documentos assinados ----------
create table public.contrato_modelos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 nome text not null check (btrim(nome) <> ''), conteudo text not null check (btrim(conteudo) <> ''),
 ativo boolean not null default true,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);
create table public.contratos (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 modelo_id uuid references public.contrato_modelos on delete set null,
 titulo text not null check (btrim(titulo) <> ''),
 conteudo text not null check (btrim(conteudo) <> ''),
 variaveis jsonb not null default '{}',
 status text not null default 'rascunho' check (status in ('rascunho','enviado','assinado','cancelado')),
 token text unique, token_expira_em timestamptz,
 pdf_caminho text, pdf_assinado_caminho text,
 assinatura jsonb, assinado_em timestamptz,
 provedor text not null default 'interno' check (provedor in ('interno','zapsign','clicksign')),
 provedor_referencia text,
 criado_em timestamptz not null default now(), criado_por uuid references auth.users on delete set null
);
create index on public.contratos(consultorio_id, status, criado_em desc);
create index on public.contratos(paciente_id, criado_em desc);
-- Assinatura é imutável: depois de assinado, nada muda além de cancelado→ nada.
create function privado.travar_contrato_assinado() returns trigger language plpgsql set search_path = '' as $$
begin
 if tg_op = 'DELETE' then
  if old.status = 'assinado' then raise exception 'Contrato assinado não pode ser excluído' using errcode='42501'; end if;
  return old;
 end if;
 if old.status = 'assinado' and (new.conteudo, new.assinatura, new.assinado_em, new.pdf_assinado_caminho, new.paciente_id, new.status) is distinct from (old.conteudo, old.assinatura, old.assinado_em, old.pdf_assinado_caminho, old.paciente_id, old.status) then
  raise exception 'Contrato assinado é imutável' using errcode='42501';
 end if;
 return new;
end $$;
create trigger contrato_assinado_imutavel before update or delete on public.contratos for each row execute function privado.travar_contrato_assinado();

-- ---------- trilha de acesso ao prontuário (LGPD) ----------
create table public.acessos_prontuario (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null default public.consultorio_atual() references public.consultorios on delete cascade,
 paciente_id uuid not null references public.pacientes on delete cascade,
 user_id uuid references auth.users on delete set null,
 acao text not null check (acao in ('visualizou','alterou','anexou','baixou','gerou_contrato','assinou_contrato')),
 detalhe text not null default '', ip text not null default '',
 criado_em timestamptz not null default now()
);
create index on public.acessos_prontuario(paciente_id, criado_em desc);
create trigger acessos_imutaveis before update or delete or truncate on public.acessos_prontuario for each statement execute function privado.somente_acrescentar();

-- Mudanças no prontuário entram na trilha automaticamente.
create function privado.registrar_alteracao_prontuario() returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid := coalesce(new.paciente_id, old.paciente_id); cid uuid := coalesce(new.consultorio_id, old.consultorio_id);
begin
 insert into public.acessos_prontuario(consultorio_id, paciente_id, user_id, acao, detalhe)
 values (cid, pid, auth.uid(), 'alterou', tg_table_name || '.' || lower(tg_op));
 return coalesce(new, old);
end $$;
do $$ declare t text; begin
 foreach t in array array['anamneses','odontograma','evolucoes','anexos','orcamentos','contratos'] loop
  execute format('create trigger trilha_%I after insert or update or delete on public.%I for each row execute function privado.registrar_alteracao_prontuario()', t, t);
 end loop;
end $$;

create function public.registrar_acesso_prontuario(p_paciente uuid, p_acao text default 'visualizou', p_detalhe text default '', p_ip text default '') returns void language plpgsql security definer set search_path = '' as $$
begin
 perform privado.exigir_acesso();
 if not exists(select 1 from public.pacientes where id = p_paciente and consultorio_id = public.consultorio_atual()) then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
 insert into public.acessos_prontuario(paciente_id, user_id, acao, detalhe, ip) values (p_paciente, auth.uid(), p_acao, coalesce(p_detalhe,''), coalesce(p_ip,''));
end $$;

-- ---------- RLS ----------
do $$ declare t text; begin
 foreach t in array array['anamneses','odontograma','evolucoes','anexos','orcamentos','orcamento_itens','contrato_modelos','contratos','acessos_prontuario'] loop
  execute format('alter table public.%I enable row level security', t);
  execute format('revoke all on public.%I from anon, authenticated', t);
  execute format('grant all on public.%I to service_role', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  execute format('create policy consultorio_tudo on public.%I for all to authenticated using (consultorio_id = (select public.consultorio_atual())) with check (consultorio_id = (select public.consultorio_atual()))', t);
 end loop;
end $$;
-- evoluções e acessos: o trigger já impede update/delete; a policy acima só permite select/insert na prática.

-- ---------- Storage: buckets privados ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prontuario', 'prontuario', false, 26214400, array['image/jpeg','image/png','image/webp','image/heic','application/pdf','application/dicom'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('contratos', 'contratos', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
-- Caminho: <consultorio_id>/<paciente_id>/<arquivo>. A primeira pasta tem que ser o consultório ativo.
create policy prontuario_le on storage.objects for select to authenticated using (bucket_id in ('prontuario','contratos') and (storage.foldername(name))[1] = (select public.consultorio_atual())::text);
create policy prontuario_escreve on storage.objects for insert to authenticated with check (bucket_id in ('prontuario','contratos') and (storage.foldername(name))[1] = (select public.consultorio_atual())::text);
create policy prontuario_apaga on storage.objects for delete to authenticated using (bucket_id = 'prontuario' and (storage.foldername(name))[1] = (select public.consultorio_atual())::text);

-- ---------- leitura agregada da ficha ----------
create function public.prontuario_completo(p_paciente uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare atual uuid := public.consultorio_atual(); r jsonb;
begin
 perform privado.exigir_acesso();
 select jsonb_build_object(
  'paciente', to_jsonb(p) || jsonb_build_object('convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=p.convenio_id)),
  'anamnese', (select to_jsonb(a) from public.anamneses a where a.paciente_id = p.id),
  'odontograma', (select coalesce(jsonb_agg(to_jsonb(o) order by o.dente, o.registrado_em),'[]') from public.odontograma o where o.paciente_id = p.id),
  'evolucoes', (select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('profissional',(select nome from public.profissionais where id=e.profissional_id)) order by e.criado_em desc),'[]') from public.evolucoes e where e.paciente_id = p.id),
  'anexos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc),'[]') from public.anexos x where x.paciente_id = p.id),
  'orcamentos', (select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('itens',(select coalesce(jsonb_agg(to_jsonb(i) order by i.ordem),'[]') from public.orcamento_itens i where i.orcamento_id=o.id),
    'total',(select coalesce(sum(i.quantidade*i.valor_unitario),0) from public.orcamento_itens i where i.orcamento_id=o.id) - o.desconto) order by o.criado_em desc),'[]') from public.orcamentos o where o.paciente_id = p.id),
  'contratos', (select coalesce(jsonb_agg(to_jsonb(c) - 'token' order by c.criado_em desc),'[]') from public.contratos c where c.paciente_id = p.id),
  'agendamentos', (select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('profissional',(select nome from public.profissionais where id=a.profissional_id)) order by a.inicio desc),'[]') from public.agendamentos a where a.paciente_id = p.id),
  'retornos', (select coalesce(jsonb_agg(to_jsonb(r2) order by r2.previsto_para),'[]') from public.retornos r2 where r2.paciente_id = p.id),
  'acessos', (select coalesce(jsonb_agg(to_jsonb(ac) order by ac.criado_em desc),'[]') from (select * from public.acessos_prontuario where paciente_id = p.id order by criado_em desc limit 30) ac)
 ) into r from public.pacientes p where p.id = p_paciente and p.consultorio_id = atual;
 if r is null then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
 return r;
end $$;

-- Financeiro e retornos: visão por consultório.
create function public.financeiro_resumo(p_inicio date, p_fim date) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare atual uuid := public.consultorio_atual(); d_ini timestamptz := p_inicio::timestamp at time zone 'America/Sao_Paulo'; d_fim timestamptz := (p_fim+1)::timestamp at time zone 'America/Sao_Paulo';
begin
 perform privado.exigir_acesso();
 return jsonb_build_object(
  'periodo', jsonb_build_object('inicio', p_inicio, 'fim', p_fim),
  'previsto', (select coalesce(sum(valor),0) from public.agendamentos where consultorio_id=atual and status in ('agendado','confirmado','concluido') and inicio >= d_ini and inicio < d_fim),
  'realizado', (select coalesce(sum(valor),0) from public.agendamentos where consultorio_id=atual and status='concluido' and inicio >= d_ini and inicio < d_fim),
  'faltas', (select count(*) from public.agendamentos where consultorio_id=atual and status='faltou' and inicio >= d_ini and inicio < d_fim),
  'consultas', (select count(*) from public.agendamentos where consultorio_id=atual and status in ('agendado','confirmado','concluido') and inicio >= d_ini and inicio < d_fim),
  'orcamentos', (select jsonb_build_object(
     'pendentes', count(*) filter (where status='pendente'), 'aprovados', count(*) filter (where status='aprovado'), 'recusados', count(*) filter (where status='recusado'),
     'valor_pendente', coalesce(sum(t.total) filter (where status='pendente'),0), 'valor_aprovado', coalesce(sum(t.total) filter (where status='aprovado'),0))
    from (select o.status, (select coalesce(sum(i.quantidade*i.valor_unitario),0) from public.orcamento_itens i where i.orcamento_id=o.id) - o.desconto as total from public.orcamentos o where o.consultorio_id=atual and o.criado_em >= d_ini and o.criado_em < d_fim) t),
  'lista_orcamentos', (select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'titulo',o.titulo,'status',o.status,'criado_em',o.criado_em,'paciente',jsonb_build_object('id',p.id,'nome',p.nome),
     'total',(select coalesce(sum(i.quantidade*i.valor_unitario),0) from public.orcamento_itens i where i.orcamento_id=o.id) - o.desconto) order by o.criado_em desc),'[]')
    from (select * from public.orcamentos where consultorio_id=atual order by criado_em desc limit 100) o join public.pacientes p on p.id=o.paciente_id),
  'faltas_lista', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'inicio',a.inicio,'tipo',a.tipo,'paciente',jsonb_build_object('id',p.id,'nome',p.nome,'telefone_e164',p.telefone_e164)) order by a.inicio desc),'[]')
    from public.agendamentos a join public.pacientes p on p.id=a.paciente_id where a.consultorio_id=atual and a.status='faltou' and a.inicio >= now()-interval '60 days'),
  'confirmacoes', (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'inicio',a.inicio,'tipo',a.tipo,'status',a.status,'confirmacao_enviada_em',a.confirmacao_enviada_em,'paciente',jsonb_build_object('id',p.id,'nome',p.nome,'telefone_e164',p.telefone_e164)) order by a.inicio),'[]')
    from public.agendamentos a join public.pacientes p on p.id=a.paciente_id where a.consultorio_id=atual and a.status='agendado' and a.inicio >= now() and a.inicio < now()+interval '72 hours'),
  'retornos', (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'motivo',r.motivo,'previsto_para',r.previsto_para,'status',r.status,'paciente',jsonb_build_object('id',p.id,'nome',p.nome,'telefone_e164',p.telefone_e164)) order by r.previsto_para),'[]')
    from public.retornos r join public.pacientes p on p.id=r.paciente_id where r.consultorio_id=atual and r.status in ('pendente','contatado') and r.previsto_para <= (now() at time zone 'America/Sao_Paulo')::date + 30)
 );
end $$;

create function public.marcar_confirmacao_enviada(p_agendamento uuid) returns public.agendamentos language plpgsql security definer set search_path = '' as $$
declare a public.agendamentos;
begin
 perform privado.exigir_acesso();
 update public.agendamentos set confirmacao_enviada_em = now() where id = p_agendamento and consultorio_id = public.consultorio_atual() returning * into a;
 if not found then raise exception 'Agendamento não encontrado' using errcode='P0002'; end if;
 return a;
end $$;

do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('registrar_acesso_prontuario','prontuario_completo','financeiro_resumo','marcar_confirmacao_enviada') loop
  execute format('revoke all on function %s from public,anon',f); execute format('grant execute on function %s to authenticated,service_role',f);
 end loop;
end $$;
revoke all on all functions in schema privado from public,anon,authenticated;
commit;
