-- Busca de pacientes no servidor (barra superior e BuscaPaciente) passa a achar pelos campos do cadastro importado do Codental:
-- nome, celular, telefone de contato (compartilhado), telefone fixo, CPF, código Codental, codental_id e e-mail.
-- Termo com dígitos é comparado só por dígitos (aceita "(13) 9…", "13 9…", "+55…"). Também vale para a busca em 'conversas'.
-- Só o ramo 'pacientes' e 'conversas' mudaram em relação a 202610230001; o resto da função é igual.
-- Um paciente (como jsonb) bate com o termo? Nome e e-mail por texto; celular, telefone de contato, fixo e CPF por dígitos
-- (a partir de 3 dígitos, para "13" não trazer todo mundo); código Codental e codental_id por igualdade.
create or replace function privado.paciente_bate(p jsonb, termo text, termo_digitos text) returns boolean language sql immutable as $$
 select termo <> '' and (
  position(termo in lower(coalesce(p->>'nome',''))) > 0
  or position(termo in lower(coalesce(p->>'email',''))) > 0
  or lower(coalesce(p->>'codental_numero','')) = termo
  or lower(coalesce(p->>'codental_id','')) = termo
  or (length(termo_digitos) >= 3 and (
       position(termo_digitos in regexp_replace(coalesce(p->>'telefone_e164',''), '\D', '', 'g')) > 0
    or position(termo_digitos in regexp_replace(coalesce(p->>'telefone_contato',''), '\D', '', 'g')) > 0
    or position(termo_digitos in regexp_replace(coalesce(p->>'telefone_fixo',''), '\D', '', 'g')) > 0
    or position(termo_digitos in coalesce(p->>'cpf','')) > 0
    or coalesce(p->>'codental_numero','') = termo_digitos))
 );
$$;
create or replace function public.painel_leitura(p_operacao text,p_argumentos jsonb default '{}') returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare resultado jsonb; cfg jsonb; pid uuid; data_inicio date; limite integer; deslocamento integer; mes_inicio timestamptz; mes_fim timestamptz; atual uuid := public.consultorio_atual();
 termo text := lower(trim(coalesce(p_argumentos->>'busca',''))); termo_digitos text := regexp_replace(coalesce(p_argumentos->>'busca',''), '\D', '', 'g');
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
   and (termo='' or privado.paciente_bate(r->'paciente', termo, termo_digitos))
   order by coalesce(r->'ultima_mensagem'->>'criada_em',r->>'iniciada_em') desc limit limite offset deslocamento) s;
 when 'conversa' then
  select jsonb_build_object('conversa',to_jsonb(c),'paciente',to_jsonb(p),'mensagens',(select coalesce(jsonb_agg(to_jsonb(m) order by criada_em,id),'[]') from public.mensagens m where conversa_id=c.id)) into resultado
  from public.conversas c join public.pacientes p on p.id=c.paciente_id where c.id=(p_argumentos->>'id')::uuid and c.consultorio_id = atual;
 when 'pacientes' then
  select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('contagem_conversas',(select count(*) from public.conversas where paciente_id=p.id),'convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=p.convenio_id),
   'proximo_agendamento',(select to_jsonb(a) from public.agendamentos a where a.paciente_id=p.id and a.status in ('agendado','confirmado','sugerido') and a.inicio >= now() order by a.inicio limit 1)) order by nome,id),'[]') into resultado from public.pacientes p
  where p.consultorio_id = atual and (termo='' or privado.paciente_bate(to_jsonb(p), termo, termo_digitos));
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
