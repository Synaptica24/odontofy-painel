begin;
create or replace function privado.travar_agenda() returns trigger language plpgsql set search_path = '' as $$
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'Use isolamento READ COMMITTED para editar a agenda' using errcode='40001'; end if;
 perform pg_advisory_xact_lock(17092026,1); return null;
end $$;
-- Consultas de validação precisam enxergar commits ocorridos enquanto a trava aguardava.
alter function privado.config_atual() volatile;
alter function privado.novos_semana(timestamptz,uuid) volatile;
alter function privado.motivo_horario(text,timestamptz,timestamptz,boolean,uuid,boolean) volatile;
create function privado.validar_consumo() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if exists(select 1 from public.consumo_ia c where c.id<>new.id and c.fonte_consumo=new.fonte_consumo
  and tstzrange(c.periodo_inicio,c.periodo_fim,'[)') && tstzrange(new.periodo_inicio,new.periodo_fim,'[)')) then
  raise exception 'Período de consumo sobreposto' using errcode='23514';
 end if;
 return new;
end $$;
create function privado.travar_consumo() returns trigger language plpgsql set search_path = '' as $$
begin perform pg_advisory_xact_lock(17092026,2); return null; end $$;
create trigger trava_consumo before insert or update or delete on public.consumo_ia for each statement execute function privado.travar_consumo();
create trigger validar_consumo before insert or update on public.consumo_ia for each row execute function privado.validar_consumo();
-- Impede perda de correlação após recarregar a aba: reconciliar o envio pendente primeiro.
create function privado.validar_envio_pendente() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.autor='dentista' and new.wa_message_id is null and exists(select 1 from public.mensagens where conversa_id=new.conversa_id and autor='dentista' and wa_message_id is null and texto=new.texto) then
  raise exception 'Envio pendente de reconciliação' using errcode='23514';
 end if;
 return new;
end $$;
create trigger validar_envio_pendente before insert on public.mensagens for each row execute function privado.validar_envio_pendente();
-- Retrato completo de Realtime, sem o limite de paginação da listagem.
create function public.retrato_conversas() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin perform privado.exigir_acesso(); return (select coalesce(jsonb_agg(r order by coalesce(r->'ultima_mensagem'->>'criada_em',r->>'iniciada_em') desc),'[]') from privado.resumos() r); end $$;
revoke all on function public.retrato_conversas() from public,anon;
grant execute on function public.retrato_conversas() to authenticated,service_role;
revoke all on all functions in schema privado from public,anon,authenticated;
commit;
