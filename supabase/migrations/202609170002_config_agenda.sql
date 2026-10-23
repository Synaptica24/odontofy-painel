begin;
create function privado.config_padrao() returns jsonb language sql immutable set search_path = '' as $$
 select '{"fuso_horario":"America/Sao_Paulo","horarios_atendimento":{"segunda":[],"terca":[],"quarta":[],"quinta":[],"sexta":[],"sabado":[],"domingo":[]},"duracoes_por_tipo":{},"teto_pacientes_novos_semana":0,"antecedencia_minima_minutos":0,"confirmacao_ativa":false,"confirmacao_antecedencia_horas":0,"confirmacao_horario":"","pausa_agente_minutos":30,"agente_ativo":false,"agenda_ativa":false,"campanha_pausada":true,"canal_urgencia":{"tipo":"nao_configurado","destino":""},"teto_gasto_ia_brl":0,"consumo_fonte":"","cambio_fonte":"","cambio_usd_brl":0}'::jsonb;
$$;
create function privado.config_atual() returns jsonb language sql stable set search_path = '' as $$
 select privado.config_padrao() || coalesce(jsonb_object_agg(chave,valor),'{}') from public.config;
$$;
insert into public.config select key,value from jsonb_each(privado.config_padrao());
create function privado.validar_config(c jsonb) returns void language plpgsql set search_path = '' as $$
declare k text; v jsonb; dia text; faixa jsonb; fim_anterior text; tem_horario boolean := false;
begin
 if jsonb_typeof(c) <> 'object' then raise exception 'validacao' using errcode='22023'; end if;
 for k,v in select key,value from jsonb_each(c) loop
  if not (privado.config_padrao() ? k) or jsonb_typeof(v) is distinct from jsonb_typeof(privado.config_padrao()->k) then raise exception 'Configuração inválida: %',k using errcode='22023'; end if;
 end loop;
 if c->>'fuso_horario' <> 'America/Sao_Paulo' then raise exception 'Fuso inválido' using errcode='22023'; end if;
 foreach k in array array['teto_pacientes_novos_semana','antecedencia_minima_minutos','confirmacao_antecedencia_horas','pausa_agente_minutos'] loop
  if (c->>k) !~ '^[0-9]+$' or (c->>k)::numeric > 2147483647 then raise exception 'Inteiro inválido' using errcode='22023'; end if;
 end loop;
 if (c->>'pausa_agente_minutos')::numeric <= 0 or (c->>'teto_gasto_ia_brl')::numeric < 0 or (c->>'cambio_usd_brl')::numeric < 0 then raise exception 'Valor inválido' using errcode='22023'; end if;
 for k,v in select key,value from jsonb_each(c->'duracoes_por_tipo') loop
  if btrim(k) = '' or jsonb_typeof(v) <> 'number' or v::text !~ '^[0-9]+$' or v::numeric <= 0 or v::numeric > 1440 then raise exception 'Duração inválida' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_object_keys(c->'horarios_atendimento')) <> 7 then raise exception 'Dias inválidos' using errcode='22023'; end if;
 foreach dia in array array['segunda','terca','quarta','quinta','sexta','sabado','domingo'] loop
  if jsonb_typeof(c->'horarios_atendimento'->dia) is distinct from 'array' then raise exception 'Dia inválido' using errcode='22023'; end if;
  fim_anterior := '00:00';
  for faixa in select value from jsonb_array_elements(c->'horarios_atendimento'->dia) loop
   if coalesce(faixa->>'inicio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(faixa->>'fim','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or faixa->>'fim' <= faixa->>'inicio' or faixa->>'inicio' < fim_anterior then raise exception 'Faixa inválida ou sobreposta' using errcode='22023'; end if;
   fim_anterior := faixa->>'fim'; tem_horario := true;
  end loop;
 end loop;
 if (c->>'agenda_ativa')::boolean and (not tem_horario or c->'duracoes_por_tipo' = '{}') then raise exception 'Agenda não configurada' using errcode='22023'; end if;
 if c->>'confirmacao_horario' <> '' and c->>'confirmacao_horario' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horário inválido' using errcode='22023'; end if;
 if (c->>'confirmacao_ativa')::boolean and ((c->>'confirmacao_antecedencia_horas')::numeric <= 0 or c->>'confirmacao_horario' = '') then raise exception 'Confirmação não configurada' using errcode='22023'; end if;
 if coalesce(c->'canal_urgencia'->>'tipo','') not in ('nao_configurado','whatsapp','email') or jsonb_typeof(c->'canal_urgencia'->'destino') is distinct from 'string' then raise exception 'Canal inválido' using errcode='22023'; end if;
 if c->'canal_urgencia'->>'tipo' <> 'nao_configurado' and btrim(c->'canal_urgencia'->>'destino') = '' then raise exception 'Destino ausente' using errcode='22023'; end if;
 if (c->>'agente_ativo')::boolean and (c->'canal_urgencia'->>'tipo' = 'nao_configurado' or (c->>'teto_gasto_ia_brl')::numeric <= 0 or btrim(c->>'consumo_fonte') = '' or btrim(c->>'cambio_fonte') = '') then raise exception 'Agente não configurado' using errcode='22023'; end if;
end $$;
create function privado.validar_config_trigger() returns trigger language plpgsql security definer set search_path = '' as $$
begin perform privado.validar_config(privado.config_atual()); return null; end $$;
create constraint trigger config_valida after insert or update or delete on public.config deferrable initially deferred for each row execute function privado.validar_config_trigger();
create function public.ler_config() returns jsonb language plpgsql security definer set search_path = '' as $$
begin perform privado.exigir_acesso(); return privado.config_atual(); end $$;
create function public.salvar_config(p_alteracoes jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb;
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 c := privado.config_atual() || p_alteracoes; perform privado.validar_config(c);
 insert into public.config select key,value from jsonb_each(p_alteracoes) on conflict(chave) do update set valor=excluded.valor;
 return c;
end $$;
create function privado.semana(p_inicio timestamptz) returns timestamptz language sql immutable set search_path = '' as $$
 select date_trunc('week',p_inicio at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
$$;
create function privado.novos_semana(p_inicio timestamptz,p_excluir uuid default null) returns bigint language sql stable set search_path = '' as $$
 select count(*) from public.agendamentos where paciente_novo and status <> 'cancelado'
 and inicio >= privado.semana(p_inicio) and inicio < ((privado.semana(p_inicio) at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo'
 and (p_excluir is null or id <> p_excluir);
$$;
create function privado.motivo_horario(p_tipo text,p_inicio timestamptz,p_fim timestamptz,p_novo boolean,p_excluir uuid default null,p_antecedencia boolean default true)
 returns text language plpgsql stable set search_path = '' as $$
declare c jsonb := privado.config_atual(); local_inicio timestamp := p_inicio at time zone 'America/Sao_Paulo'; local_fim timestamp := p_fim at time zone 'America/Sao_Paulo'; dia text;
begin
 if not (c->>'agenda_ativa')::boolean or not (c->'duracoes_por_tipo' ? p_tipo) then return 'nao_configurado'; end if;
 if p_novo and privado.novos_semana(p_inicio,p_excluir) >= (c->>'teto_pacientes_novos_semana')::integer then return 'teto_semanal'; end if;
 if p_antecedencia and p_inicio < now() + make_interval(mins => (c->>'antecedencia_minima_minutos')::integer) then return 'antecedencia'; end if;
 if p_fim <> p_inicio + make_interval(mins => (c->'duracoes_por_tipo'->>p_tipo)::integer) then return 'duracao'; end if;
 dia := (array['domingo','segunda','terca','quarta','quinta','sexta','sabado'])[extract(dow from local_inicio)::integer+1];
 if local_inicio::date <> local_fim::date or not exists(select 1 from jsonb_array_elements(c->'horarios_atendimento'->dia) f where local_inicio::time >= (f->>'inicio')::time and local_fim::time <= (f->>'fim')::time) then return 'fora_expediente'; end if;
 if exists(select 1 from public.bloqueios where tstzrange(inicio,fim,'[)') && tstzrange(p_inicio,p_fim,'[)')) or exists(select 1 from public.agendamentos where status in ('sugerido','confirmado') and (p_excluir is null or id <> p_excluir) and tstzrange(inicio,fim,'[)') && tstzrange(p_inicio,p_fim,'[)')) then return 'conflito'; end if;
 return null;
end $$;
create function privado.validar_agendamento() returns trigger language plpgsql security definer set search_path = '' as $$
declare motivo text; mudou boolean;
begin
 if tg_op = 'DELETE' then return old; end if;
 if tg_op = 'INSERT' then
  new.paciente_novo := not exists(select 1 from public.pacientes where id=new.paciente_id and status='paciente') and not exists(select 1 from public.agendamentos where paciente_id=new.paciente_id and status='confirmado' and fim < now());
  mudou := true;
 else
  if new.paciente_id <> old.paciente_id or new.paciente_novo <> old.paciente_novo then raise exception 'Classificação histórica imutável' using errcode='22023'; end if;
  mudou := (new.inicio,new.fim,new.tipo) is distinct from (old.inicio,old.fim,old.tipo);
  if old.status in ('cancelado','faltou') and (mudou or new.status <> old.status) then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
 end if;
 if new.status in ('sugerido','confirmado') then
  motivo := privado.motivo_horario(new.tipo,new.inicio,new.fim,new.paciente_novo,new.id,mudou);
  if motivo is not null then raise exception '%',motivo using errcode='23514'; end if;
 elsif tg_op = 'INSERT' then raise exception 'Estado inicial inválido' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validar_agendamento before insert or update or delete on public.agendamentos for each row execute function privado.validar_agendamento();
create function privado.validar_bloqueio() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from public.agendamentos where status in ('sugerido','confirmado') and tstzrange(inicio,fim,'[)') && tstzrange(new.inicio,new.fim,'[)')) then raise exception 'conflito' using errcode='23514'; end if;
 return new;
end $$;
create trigger validar_bloqueio before insert or update on public.bloqueios for each row execute function privado.validar_bloqueio();
create function privado.validar_campanha() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(17092026,1);
 if new.status in ('fila','enviada') and exists(select 1 from public.pacientes where id=new.paciente_id and nao_perturbe) then raise exception 'Contato bloqueado' using errcode='23514'; end if;
 if new.status = 'enviada' and (tg_op='INSERT' or old.status <> 'enviada') and (privado.config_atual()->>'campanha_pausada')::boolean then raise exception 'Campanha pausada' using errcode='23514'; end if;
 return new;
end $$;
create trigger validar_campanha before insert or update on public.campanha_envios for each row execute function privado.validar_campanha();
revoke all on all functions in schema privado from public,anon,authenticated;
revoke all on function public.ler_config(),public.salvar_config(jsonb) from public,anon;
grant execute on function public.ler_config(),public.salvar_config(jsonb) to authenticated,service_role;
commit;
