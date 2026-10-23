begin;
create function public.assumir_conversa(p_conversa_id uuid,p_ate timestamptz default null) returns public.conversas language plpgsql security definer set search_path = '' as $$
declare c public.conversas; prazo timestamptz;
begin
 perform privado.exigir_acesso(); prazo := coalesce(p_ate,now()+make_interval(mins=>(privado.config_atual()->>'pausa_agente_minutos')::integer));
 if prazo <= now() then raise exception 'Prazo inválido' using errcode='22023'; end if;
 update public.conversas set status='assumida',agente_pausado_ate=prazo where id=p_conversa_id and status<>'encerrada' returning * into c;
 if not found then raise exception 'Conversa indisponível' using errcode='P0002'; end if;
 return c;
end $$;
create function public.devolver_para_ia(p_conversa_id uuid) returns public.conversas language plpgsql security definer set search_path = '' as $$
declare c public.conversas;
begin
 perform privado.exigir_acesso(); update public.conversas set status='ativa',agente_pausado_ate=null,motivo_escalonamento=null,urgente=false where id=p_conversa_id and status<>'encerrada' returning * into c;
 if not found then raise exception 'Conversa indisponível' using errcode='P0002'; end if; return c;
end $$;
create function public.criar_bloqueio(p_inicio timestamptz,p_fim timestamptz) returns public.bloqueios language plpgsql security definer set search_path = '' as $$
declare b public.bloqueios;
begin perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 insert into public.bloqueios(inicio,fim) values(p_inicio,p_fim) returning * into b; return b; end $$;
create function privado.alterar_agendamento(p_id uuid,p_acao text,p_inicio timestamptz default null) returns public.agendamentos language plpgsql set search_path = '' as $$
declare a public.agendamentos; duracao integer;
begin
 perform privado.exigir_acesso(); perform pg_advisory_xact_lock(17092026,1);
 select * into a from public.agendamentos where id=p_id for update;
 if not found then raise exception 'Agendamento não encontrado' using errcode='P0002'; end if;
 if p_acao='confirmar' then
  if a.status <> 'sugerido' then raise exception 'Somente sugestões' using errcode='23514'; end if;
  update public.agendamentos set status='confirmado',confirmado_em=now() where id=p_id returning * into a;
 elsif p_acao='falta' then
  if a.status <> 'confirmado' then raise exception 'Somente confirmados' using errcode='23514'; end if;
  update public.agendamentos set status='faltou' where id=p_id returning * into a;
 elsif p_acao='cancelar' then
  if a.status not in ('sugerido','confirmado') then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
  update public.agendamentos set status='cancelado' where id=p_id returning * into a;
 elsif p_acao='remarcar' then
  if a.status not in ('sugerido','confirmado') then raise exception 'Agendamento encerrado' using errcode='23514'; end if;
  duracao := (privado.config_atual()->'duracoes_por_tipo'->>a.tipo)::integer;
  if duracao is null or p_inicio is null then raise exception 'Horário inválido' using errcode='22023'; end if;
  update public.agendamentos set inicio=p_inicio,fim=p_inicio+make_interval(mins=>duracao) where id=p_id returning * into a;
 else raise exception 'Operação inválida' using errcode='22023'; end if;
 return a;
end $$;
create function public.confirmar_sugestao(p_agendamento_id uuid) returns public.agendamentos language sql security definer set search_path = '' as $$ select privado.alterar_agendamento(p_agendamento_id,'confirmar'); $$;
create function public.marcar_falta(p_agendamento_id uuid) returns public.agendamentos language sql security definer set search_path = '' as $$ select privado.alterar_agendamento(p_agendamento_id,'falta'); $$;
create function public.cancelar_agendamento(p_agendamento_id uuid) returns public.agendamentos language sql security definer set search_path = '' as $$ select privado.alterar_agendamento(p_agendamento_id,'cancelar'); $$;
create function public.remarcar_agendamento(p_agendamento_id uuid,p_novo_inicio timestamptz) returns public.agendamentos language sql security definer set search_path = '' as $$ select privado.alterar_agendamento(p_agendamento_id,'remarcar',p_novo_inicio); $$;

create function privado.resumos() returns setof jsonb language sql stable set search_path = '' as $$
 select to_jsonb(c) || jsonb_build_object('paciente',to_jsonb(p),'ultima_mensagem',
 (select to_jsonb(m) from public.mensagens m where conversa_id=c.id order by criada_em desc,id desc limit 1))
 from public.conversas c join public.pacientes p on p.id=c.paciente_id;
$$;
create function privado.agenda(p_data date,p_dias integer,p_filtro jsonb default '{}') returns jsonb language sql stable set search_path = '' as $$
 select jsonb_build_object('inicio',p_data,'fim_exclusivo',p_data+p_dias,
 'agendamentos',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('paciente',to_jsonb(p)) order by a.inicio,a.id),'[]') from public.agendamentos a join public.pacientes p on p.id=a.paciente_id
 where a.inicio < (p_data+p_dias)::timestamp at time zone 'America/Sao_Paulo' and a.fim > p_data::timestamp at time zone 'America/Sao_Paulo'
 and (not p_filtro ? 'status' or a.status=p_filtro->>'status') and (not p_filtro ? 'paciente_id' or a.paciente_id=(p_filtro->>'paciente_id')::uuid)),
 'bloqueios',(select coalesce(jsonb_agg(to_jsonb(b) order by inicio),'[]') from public.bloqueios b where inicio < (p_data+p_dias)::timestamp at time zone 'America/Sao_Paulo' and fim > p_data::timestamp at time zone 'America/Sao_Paulo'),
 'pacientes_novos_semana',privado.novos_semana(p_data::timestamp at time zone 'America/Sao_Paulo'),
 'teto_pacientes_novos_semana',privado.config_atual()->'teto_pacientes_novos_semana');
$$;
create function public.resumo_do_dia(p_data date default (now() at time zone 'America/Sao_Paulo')::date) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a jsonb; inicio timestamptz := p_data::timestamp at time zone 'America/Sao_Paulo';
begin
 perform privado.exigir_acesso(); a := privado.agenda(p_data,1);
 return jsonb_build_object('data',p_data,'escaladas',(select coalesce(jsonb_agg(r order by (r->>'urgente')::boolean desc,r->>'iniciada_em'),'[]') from privado.resumos() r where r->>'status'='escalada'),
 'agenda',a->'agendamentos','bloqueios',a->'bloqueios','pacientes_novos_semana',a->'pacientes_novos_semana','teto_pacientes_novos_semana',a->'teto_pacientes_novos_semana',
 'contatos_novos_24h',(select count(*) from public.pacientes where primeiro_contato >= now()-interval '24 hours' and primeiro_contato <= now()),
 'mensagens_ia_hoje',(select count(*) from public.mensagens where autor='agente' and criada_em>=inicio and criada_em < (p_data+1)::timestamp at time zone 'America/Sao_Paulo'));
end $$;
create function public.painel_leitura(p_operacao text,p_argumentos jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb; cfg jsonb; pid uuid; data_inicio date; limite integer; deslocamento integer; mes_inicio timestamptz; mes_fim timestamptz;
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
  from public.conversas c join public.pacientes p on p.id=c.paciente_id where c.id=(p_argumentos->>'id')::uuid;
 when 'pacientes' then
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('contagem_conversas',(select count(*) from public.conversas where paciente_id=p.id)) order by nome,id),'[]') into resultado from public.pacientes p
  where coalesce(p_argumentos->>'busca','')='' or position(lower(p_argumentos->>'busca') in lower(nome))>0 or position(p_argumentos->>'busca' in telefone_e164)>0;
 when 'paciente' then
  pid := (p_argumentos->>'id')::uuid;
  select jsonb_build_object('paciente',to_jsonb(p),'conversas',(select coalesce(jsonb_agg(c order by iniciada_em desc),'[]') from public.conversas c where paciente_id=pid),
  'agendamentos',(select coalesce(jsonb_agg(a order by inicio desc),'[]') from public.agendamentos a where paciente_id=pid)) into resultado from public.pacientes p where id=pid;
 when 'agenda' then
  data_inicio := (p_argumentos->>'data')::date;
  if data_inicio is null or coalesce((p_argumentos->>'dias')::integer,0) not in (1,7) then raise exception 'Data inválida' using errcode='22023'; end if;
  resultado := privado.agenda(data_inicio,(p_argumentos->>'dias')::integer,coalesce(p_argumentos->'filtro','{}'));
 when 'campanha' then
  select jsonb_build_object('pausada',privado.config_atual()->'campanha_pausada','total',count(*),'fila',count(*) filter(where status='fila'),
  'enviadas',count(*) filter(where status='enviada'),'respondidas',count(*) filter(where status='respondida'),'erro',count(*) filter(where status='erro'),'bloqueadas',count(*) filter(where status='bloqueada'),
  'agendadas',(select count(distinct paciente_id) from public.agendamentos where campanha_envio_id is not null and status='confirmado'),'envios',coalesce(jsonb_agg(e order by leva,id),'[]')) into resultado from public.campanha_envios e;
 when 'consumo' then
  cfg := privado.config_atual(); mes_inicio := date_trunc('month',now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'; mes_fim := ((mes_inicio at time zone 'America/Sao_Paulo')+interval '1 month') at time zone 'America/Sao_Paulo';
  select jsonb_build_object('mes',to_char(mes_inicio at time zone 'America/Sao_Paulo','YYYY-MM'),
   'gasto_usd',sum(gasto_usd),'gasto_brl',case when bool_and(cambio_usd_brl is not null and coalesce(fonte_cambio,'')<>'') then sum(gasto_usd*cambio_usd_brl) else null end,
   'teto_brl',cfg->'teto_gasto_ia_brl','cambio_usd_brl',case when min(cambio_usd_brl)=max(cambio_usd_brl) and bool_and(cambio_usd_brl is not null) then min(cambio_usd_brl) else null end,
   'fonte_consumo',cfg->>'consumo_fonte','fonte_cambio',cfg->>'cambio_fonte','atualizado_em',max(atualizado_em),
   'status',case when count(*)>0 and bool_and(cambio_usd_brl is not null and coalesce(fonte_cambio,'')<>'') then 'disponivel' else 'nao_configurado' end) into resultado
  from public.consumo_ia where periodo_inicio>=mes_inicio and periodo_fim<=mes_fim and fonte_consumo=cfg->>'consumo_fonte';
 else raise exception 'Operação inválida' using errcode='22023';
 end case;
 if resultado is null then raise exception 'Não encontrado' using errcode='P0002'; end if;
 return resultado;
end $$;
-- Registro pendente persiste antes do webhook. A correlação é o próprio id da mensagem.
create function public.preparar_envio(p_conversa_id uuid,p_texto text,p_id uuid) returns public.mensagens language plpgsql security definer set search_path = '' as $$
declare c public.conversas; m public.mensagens;
begin
 perform privado.exigir_acesso(); select * into c from public.conversas where id=p_conversa_id for update;
 if not found or c.status<>'assumida' or c.agente_pausado_ate<=now() then raise exception 'Assuma a conversa' using errcode='23514'; end if;
 select * into m from public.mensagens where id=p_id;
 if found then
  if m.conversa_id<>p_conversa_id or m.texto<>p_texto or m.autor<>'dentista' then raise exception 'Correlação incompatível' using errcode='23505'; end if;
  return m;
 end if;
 insert into public.mensagens(id,conversa_id,direcao,autor,texto,tipo) values(p_id,p_conversa_id,'saida','dentista',p_texto,'texto') returning * into m;
 return m;
end $$;
create function public.confirmar_envio(p_mensagem_id uuid,p_wa_message_id text) returns public.mensagens language plpgsql security definer set search_path = '' as $$
declare m public.mensagens;
begin
 perform privado.exigir_acesso();
 if coalesce(btrim(p_wa_message_id),'')='' then raise exception 'Identificador obrigatório' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_wa_message_id,18));
 select * into m from public.mensagens where id=p_mensagem_id for update;
 if not found or m.autor<>'dentista' or (m.wa_message_id is not null and m.wa_message_id<>p_wa_message_id) then raise exception 'Correlação incompatível' using errcode='23505'; end if;
 update public.mensagens set wa_message_id=p_wa_message_id where id=p_mensagem_id returning * into m;
 update public.pacientes set ultimo_contato=greatest(ultimo_contato,now()) where id=(select paciente_id from public.conversas where id=m.conversa_id);
 return m;
end $$;
revoke all on all functions in schema privado from public,anon,authenticated;
do $$ declare f regprocedure; begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('assumir_conversa','devolver_para_ia','criar_bloqueio','confirmar_sugestao','marcar_falta','cancelar_agendamento','remarcar_agendamento','resumo_do_dia','painel_leitura','preparar_envio') loop
 execute format('revoke all on function %s from public,anon',f); execute format('grant execute on function %s to authenticated,service_role',f);
 end loop;
end $$;
revoke all on function public.confirmar_envio(uuid,text) from public,anon,authenticated;
grant execute on function public.confirmar_envio(uuid,text) to service_role;
commit;
