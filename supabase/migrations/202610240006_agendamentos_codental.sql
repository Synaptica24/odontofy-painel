-- Importação histórica do Codental: consultas com origem 'codental' entram com o estado que tinham lá (inclusive concluída,
-- faltou, cancelada) e sem a validação de horário/teto, que vale para a IA e para o painel. Resto da função igual a 202610230001.
create or replace function privado.validar_agendamento() returns trigger language plpgsql security definer set search_path = '' as $$
declare motivo text; mudou boolean;
begin
 if tg_op = 'DELETE' then return old; end if;
 if tg_op = 'INSERT' and new.origem = 'codental' then
  if new.fim <= new.inicio then raise exception 'duracao' using errcode='23514'; end if;
  return new; -- histórico importado: paciente_novo vem do Codental (first_appointment)
 end if;
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
  if new.origem in ('painel','codental') then
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
