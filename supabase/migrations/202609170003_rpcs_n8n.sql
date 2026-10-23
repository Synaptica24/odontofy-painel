begin;
create function public.contexto_paciente(p_telefone text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.pacientes; c public.conversas; cfg jsonb; ms jsonb; proximo jsonb;
begin
 perform privado.exigir_acesso();
 perform pg_advisory_xact_lock(hashtextextended(p_telefone,17));
 insert into public.pacientes(nome,telefone_e164,origem) values('Contato sem nome',p_telefone,'whatsapp') on conflict(telefone_e164) do nothing;
 select * into strict p from public.pacientes where telefone_e164=p_telefone;
 insert into public.conversas(paciente_id) values(p.id) on conflict(paciente_id) where status <> 'encerrada' do nothing;
 select * into strict c from public.conversas where paciente_id=p.id and status <> 'encerrada' for update;
 if c.status in ('assumida','escalada') and c.agente_pausado_ate <= now() then
  update public.conversas set status='ativa',agente_pausado_ate=null,urgente=false,motivo_escalonamento=null where id=c.id returning * into c;
 end if;
 cfg := privado.config_atual();
 select coalesce(jsonb_agg(to_jsonb(m) order by m.criada_em,m.id),'[]') into ms from (select * from public.mensagens where conversa_id=c.id order by criada_em desc,id desc limit 20) m;
 select to_jsonb(a) into proximo from public.agendamentos a where paciente_id=p.id and status in ('sugerido','confirmado') and inicio >= now() order by inicio limit 1;
 return jsonb_build_object('paciente',to_jsonb(p),'conversa',to_jsonb(c),'agente_pausado',not (cfg->>'agente_ativo')::boolean or coalesce(c.agente_pausado_ate>now(),false),'mensagens',ms,'proximo_agendamento',proximo,'config',cfg);
end $$;
create function public.registrar_mensagem(p_telefone text,p_direcao text,p_autor text,p_texto text,p_tipo text,p_transcricao text,p_midia_url text,p_wa_message_id text)
 returns public.mensagens language plpgsql security definer set search_path = '' as $$
declare m public.mensagens; contexto jsonb;
begin
 perform privado.exigir_acesso();
 if coalesce(btrim(p_wa_message_id),'')='' then raise exception 'Identificador obrigatório' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_wa_message_id,18));
 select * into m from public.mensagens where wa_message_id=p_wa_message_id;
 if found then
  if (m.direcao,m.autor,m.texto,m.tipo,m.transcricao,m.midia_url) is distinct from (p_direcao,p_autor,coalesce(p_texto,''),p_tipo,p_transcricao,p_midia_url)
    or not exists(select 1 from public.conversas c join public.pacientes p on p.id=c.paciente_id where c.id=m.conversa_id and p.telefone_e164=p_telefone) then raise exception 'Identificador já utilizado' using errcode='23505'; end if;
  return m;
 end if;
 contexto := public.contexto_paciente(p_telefone);
 insert into public.mensagens(conversa_id,direcao,autor,texto,tipo,transcricao,midia_url,wa_message_id)
 values((contexto->'conversa'->>'id')::uuid,p_direcao,p_autor,coalesce(p_texto,''),p_tipo,p_transcricao,p_midia_url,p_wa_message_id) returning * into m;
 update public.pacientes set ultimo_contato=greatest(ultimo_contato,m.criada_em) where id=(contexto->'paciente'->>'id')::uuid;
 return m;
end $$;
create function public.buscar_conhecimento(p_pergunta text) returns setof public.base_conhecimento language plpgsql stable security definer set search_path = '' as $$
begin
 perform privado.exigir_acesso();
 return query select b.* from public.base_conhecimento b
 where b.ativo and (to_tsvector('portuguese',b.pergunta || ' ' || b.resposta) @@ websearch_to_tsquery('portuguese',p_pergunta)
 or exists(select 1 from unnest(b.palavras_chave) k where position(lower(k) in lower(p_pergunta))>0))
 order by ts_rank(to_tsvector('portuguese',b.pergunta || ' ' || b.resposta),websearch_to_tsquery('portuguese',p_pergunta)) desc,b.id;
end $$;
create function public.horarios_livres(p_tipo text,p_a_partir_de timestamptz,p_limite integer) returns jsonb language plpgsql security definer set search_path = '' as $$
declare c jsonb; cursor_hora timestamptz; fim_semana timestamptz; fim_hora timestamptz; horarios jsonb := '[]';
begin
 perform privado.exigir_acesso();
 if p_a_partir_de is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'Limite inválido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(17092026,1); c := privado.config_atual();
 if privado.novos_semana(p_a_partir_de) >= (c->>'teto_pacientes_novos_semana')::integer then return jsonb_build_object('horarios',horarios,'motivo','teto_semanal'); end if;
 if not (c->>'agenda_ativa')::boolean or not (c->'duracoes_por_tipo' ? p_tipo) then return jsonb_build_object('horarios',horarios,'motivo','nao_configurado'); end if;
 cursor_hora := date_trunc('minute',greatest(p_a_partir_de,now()+make_interval(mins=>(c->>'antecedencia_minima_minutos')::integer)));
 if cursor_hora < greatest(p_a_partir_de,now()+make_interval(mins=>(c->>'antecedencia_minima_minutos')::integer)) then cursor_hora := cursor_hora + interval '1 minute'; end if;
 fim_semana := ((privado.semana(p_a_partir_de) at time zone 'America/Sao_Paulo') + interval '7 days') at time zone 'America/Sao_Paulo';
 while cursor_hora < fim_semana and jsonb_array_length(horarios) < p_limite loop
  fim_hora := cursor_hora + make_interval(mins=>(c->'duracoes_por_tipo'->>p_tipo)::integer);
  if privado.motivo_horario(p_tipo,cursor_hora,fim_hora,true) is null then
   horarios := horarios || jsonb_build_array(jsonb_build_object('inicio',cursor_hora,'fim',fim_hora));
   cursor_hora := fim_hora;
  else cursor_hora := cursor_hora + interval '1 minute'; end if;
 end loop;
 return jsonb_build_object('horarios',horarios,'motivo',case when horarios='[]' then 'sem_horarios' else null end);
end $$;
create function public.criar_agendamento(p_telefone text,p_tipo text,p_inicio timestamptz,p_origem text,p_observacao text) returns public.agendamentos language plpgsql security definer set search_path = '' as $$
declare contexto jsonb; a public.agendamentos; duracao integer;
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 contexto := public.contexto_paciente(p_telefone);
 duracao := (privado.config_atual()->'duracoes_por_tipo'->>p_tipo)::integer;
 if duracao is null then raise exception 'nao_configurado' using errcode='23514'; end if;
 insert into public.agendamentos(paciente_id,tipo,inicio,fim,origem,observacao,paciente_novo)
 values((contexto->'paciente'->>'id')::uuid,p_tipo,p_inicio,p_inicio+make_interval(mins=>duracao),p_origem,coalesce(p_observacao,''),true) returning * into a;
 return a;
end $$;
create function public.escalar_conversa(p_telefone text,p_motivo text,p_urgente boolean) returns jsonb language plpgsql security definer set search_path = '' as $$
declare contexto jsonb; c public.conversas; cfg jsonb;
begin
 perform privado.exigir_acesso(); contexto := public.contexto_paciente(p_telefone); cfg := privado.config_atual();
 update public.conversas set status='escalada',motivo_escalonamento=p_motivo,urgente=p_urgente,agente_pausado_ate=now()+make_interval(mins=>(cfg->>'pausa_agente_minutos')::integer)
 where id=(contexto->'conversa'->>'id')::uuid returning * into c;
 return jsonb_build_object('conversa',to_jsonb(c),'canal_urgencia',cfg->'canal_urgencia','notificar',cfg->'canal_urgencia'->>'tipo'<>'nao_configurado' and btrim(cfg->'canal_urgencia'->>'destino')<>'');
end $$;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('contexto_paciente','registrar_mensagem','buscar_conhecimento','horarios_livres','criar_agendamento','escalar_conversa') loop
 execute format('revoke all on function %s from public,anon,authenticated',f);
 execute format('grant execute on function %s to service_role',f);
 end loop;
end $$;
commit;
