-- Executar como administrador SOMENTE em banco descartável com migrações aplicadas.
begin;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
create function pg_temp.verificar(condicao boolean,rotulo text) returns void language plpgsql as $$
begin if condicao is distinct from true then raise exception 'TESTE FALHOU: %',rotulo; end if; end $$;

select pg_temp.verificar((select count(*)=12 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('pacientes','conversas','mensagens','agendamentos','bloqueios','campanha_envios','base_conhecimento','regras_escalonamento','config','eventos','consumo_ia','conta_autorizada') and c.relrowsecurity),'RLS em todas as tabelas');
select pg_temp.verificar(not has_function_privilege('authenticated','public.criar_agendamento(text,text,timestamptz,text,text)','EXECUTE'),'RPC n8n não é pública ao painel');
select pg_temp.verificar(not has_table_privilege('authenticated','public.agendamentos','INSERT'),'Agenda não permite escrita direta');
select pg_temp.verificar(not has_table_privilege('anon','public.pacientes','SELECT'),'Anon sem leitura');
select pg_temp.verificar((select count(*)=2 from pg_publication_tables where pubname='supabase_realtime' and tablename in ('mensagens','conversas')),'Publicação Realtime');

do $$
declare ctx jsonb; ctx2 jsonb; m public.mensagens; m2 public.mensagens; a public.agendamentos; b public.agendamentos;
 inicio timestamptz := (date_trunc('week',now() at time zone 'America/Sao_Paulo')+interval '7 days 10 hours') at time zone 'America/Sao_Paulo';
 falhou boolean; antes bigint; item uuid;
begin
 perform public.salvar_config('{"agenda_ativa":true,"horarios_atendimento":{"segunda":[{"inicio":"09:00","fim":"18:00"}],"terca":[],"quarta":[],"quinta":[],"sexta":[],"sabado":[],"domingo":[]},"duracoes_por_tipo":{"ATENDIMENTO_TESTE":30},"teto_pacientes_novos_semana":1}');
 ctx := public.contexto_paciente('+5511900000001'); ctx2 := public.contexto_paciente('+5511900000001');
 perform pg_temp.verificar(ctx->'conversa'->>'id'=ctx2->'conversa'->>'id','Contexto reutiliza conversa');
 perform pg_temp.verificar((ctx->>'agente_pausado')::boolean,'Agente globalmente desativado');
 update public.pacientes set nome='Paciente Teste 01' where id=(ctx->'paciente'->>'id')::uuid;
 m := public.registrar_mensagem('+5511900000001','entrada','paciente','MENSAGEM DE TESTE','texto',null,null,'FIXTURE-TESTE-01');
 m2 := public.registrar_mensagem('+5511900000001','entrada','paciente','MENSAGEM DE TESTE','texto',null,null,'FIXTURE-TESTE-01');
 perform pg_temp.verificar(m.id=m2.id,'Idempotência WhatsApp');
 falhou := false;
 begin perform public.registrar_mensagem('+5511900000001','entrada','paciente','OUTRO TESTE','texto',null,null,'FIXTURE-TESTE-01'); exception when unique_violation then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Payload divergente rejeitado');
 a := public.criar_agendamento('+5511900000001','ATENDIMENTO_TESTE',inicio,'agente','FIXTURE TESTE');
 perform pg_temp.verificar(a.fim=a.inicio+interval '30 minutes' and a.paciente_novo,'Duração e classificação no banco');
 perform pg_temp.verificar(public.horarios_livres('ATENDIMENTO_TESTE',inicio,10)->>'motivo'='teto_semanal','Teto devolve motivo');
 falhou:=false;
 begin perform public.criar_agendamento('+5511900000002','ATENDIMENTO_TESTE',inicio+interval '1 hour','agente','FIXTURE TESTE'); exception when check_violation then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Criação revalida teto');
 falhou:=false;
 begin perform public.criar_bloqueio(inicio,inicio+interval '30 minutes'); exception when check_violation then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Bloqueio conflita com reserva');
 perform public.confirmar_sugestao(a.id); perform public.marcar_falta(a.id);
 perform pg_temp.verificar(public.horarios_livres('ATENDIMENTO_TESTE',inicio,10)->>'motivo'='teto_semanal','Falta consome teto');
 perform public.salvar_config('{"teto_pacientes_novos_semana":3}');
 b := public.criar_agendamento('+5511900000002','ATENDIMENTO_TESTE',inicio+interval '1 hour','painel','FIXTURE TESTE');
 perform public.remarcar_agendamento(b.id,inicio+interval '2 hours');
 perform public.cancelar_agendamento(b.id);
 perform pg_temp.verificar(jsonb_array_length(public.horarios_livres('ATENDIMENTO_TESTE',inicio,2)->'horarios')=2,'Cancelamento libera vagas');
 perform public.criar_bloqueio(inicio+interval '3 hours',inicio+interval '4 hours');
 falhou:=false;
 begin perform public.criar_agendamento('+5511900000002','ATENDIMENTO_TESTE',inicio+interval '3 hours','agente','FIXTURE TESTE'); exception when check_violation then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Reserva conflita com bloqueio');
 perform pg_temp.verificar(public.resumo_do_dia((inicio at time zone 'America/Sao_Paulo')::date)->'agenda'->0 ? 'paciente','Resumo inclui paciente');
 select count(*) into antes from public.eventos;
 insert into public.base_conhecimento(pergunta,resposta,palavras_chave) values('PERGUNTA TESTE','RESPOSTA TESTE',array['teste']) returning id into item;
 update public.base_conhecimento set ativo=false where id=item; delete from public.base_conhecimento where id=item;
 perform public.salvar_config('{"pausa_agente_minutos":35}');
 perform pg_temp.verificar((select count(*)=antes+4 from public.eventos),'Auditoria insert/update/delete e config');
 falhou:=false;
 begin perform public.salvar_config('{"chave_desconhecida":1}'); exception when invalid_parameter_value then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Config rejeita chaves desconhecidas');
 falhou:=false;
 begin perform public.salvar_config('{"horarios_atendimento":{"segunda":[{"inicio":"10:00","fim":"12:00"},{"inicio":"11:00","fim":"13:00"}],"terca":[],"quarta":[],"quinta":[],"sexta":[],"sabado":[],"domingo":[]}}'); exception when invalid_parameter_value then falhou:=true; end;
 perform pg_temp.verificar(falhou,'Config rejeita faixas sobrepostas');
 perform public.assumir_conversa((ctx->'conversa'->>'id')::uuid);
 m := public.preparar_envio((ctx->'conversa'->>'id')::uuid,'SAÍDA DE TESTE',gen_random_uuid());
 m2 := public.preparar_envio(m.conversa_id,m.texto,m.id);
 perform pg_temp.verificar(m.id=m2.id,'Retry reaproveita registro pendente');
 m2 := public.confirmar_envio(m.id,'FIXTURE-SAIDA-01');
 perform pg_temp.verificar(m.id=m2.id and m2.wa_message_id='FIXTURE-SAIDA-01','ACK associa ao mesmo registro');
 update public.conversas set agente_pausado_ate=now()-interval '1 minute' where id=m.conversa_id;
 ctx := public.contexto_paciente('+5511900000001');
 perform pg_temp.verificar(ctx->'conversa'->>'status'='ativa','Pausa expirada normalizada');
end $$;

-- Conta permitida tem leitura; outra conta autenticada não tem.
insert into auth.users(id,email) values('00000000-0000-4000-8000-999999999998','conta-teste@example.invalid');
insert into public.conta_autorizada(id) values('00000000-0000-4000-8000-999999999998');
do $$ begin execute format('grant usage on schema %I to authenticated',(select nspname from pg_namespace where oid=pg_my_temp_schema())); end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-999999999998"}',true);
select pg_temp.verificar((select count(*)>0 from public.pacientes),'Conta permitida pode ler');
select pg_temp.verificar(public.resumo_do_dia() ? 'agenda','Conta permitida executa RPC');
select set_config('request.jwt.claims','{"role":"authenticated","sub":"00000000-0000-4000-8000-999999999999"}',true);
select pg_temp.verificar((select count(*)=0 from public.pacientes),'RLS bloqueia segundo usuário');
do $$ declare falhou boolean:=false; begin
 begin perform public.resumo_do_dia(); exception when insufficient_privilege then falhou:=true; end;
 perform pg_temp.verificar(falhou,'RPC privilegiada verifica conta');
end $$;
reset role;
rollback;
