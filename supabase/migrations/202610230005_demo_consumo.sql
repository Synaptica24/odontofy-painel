-- semear_demo: limpa o consumo de IA da demo antes de recriar (o trigger de sobreposição barrava o upsert).
begin;
create or replace function public.semear_demo(p_consultorio uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 hoje date := (now() at time zone 'America/Sao_Paulo')::date;
 segunda date := hoje - ((extract(isodow from hoje)::int) - 1);
 prof uuid; conv_sul uuid; conv_priv uuid; pac uuid[] := '{}'; p uuid; conv uuid; i int; d int; h int;
 nomes text[] := array['Paciente Teste 01','Paciente Teste 02','Paciente Teste 03','Paciente Teste 04','Paciente Teste 05','Paciente Teste 06','Paciente Teste 07','Paciente Teste 08','Paciente Teste 09','Paciente Teste 10','Paciente Teste 11','Paciente Teste 12','Paciente Teste 13','Paciente Teste 14'];
 tipos text[] := array['Avaliação','Limpeza','Restauração','Canal','Retorno','Clareamento'];
 valores numeric[] := array[150,180,350,900,0,1200];
 ts timestamptz;
begin
 if auth.role() <> 'service_role' then raise exception 'nao_autorizado' using errcode='42501'; end if;
 if not exists(select 1 from public.consultorios where id = p_consultorio and demo) then raise exception 'Só o consultório de demonstração pode ser semeado' using errcode='22023'; end if;
 perform set_config('app.consultorio', p_consultorio::text, true);
 -- libera, só nesta transação e só para service_role, a limpeza das tabelas append-only da demo
 perform set_config('app.limpando_demo', 'on', true);

 -- limpa (ordem respeita as FKs; eventos/acessos são imutáveis e ficam)
 delete from public.evolucoes where consultorio_id = p_consultorio;
 delete from public.consumo_ia where consultorio_id = p_consultorio;
 delete from public.orcamento_itens where consultorio_id = p_consultorio;
 delete from public.orcamentos where consultorio_id = p_consultorio;
 delete from public.contratos where consultorio_id = p_consultorio and status <> 'assinado';
 delete from public.anexos where consultorio_id = p_consultorio;
 delete from public.odontograma where consultorio_id = p_consultorio;
 delete from public.anamneses where consultorio_id = p_consultorio;
 delete from public.retornos where consultorio_id = p_consultorio;
 delete from public.mensagens where consultorio_id = p_consultorio;
 delete from public.conversas where consultorio_id = p_consultorio;
 delete from public.agendamentos where consultorio_id = p_consultorio;
 delete from public.bloqueios where consultorio_id = p_consultorio;
 delete from public.campanha_envios where consultorio_id = p_consultorio;
 delete from public.pacientes where consultorio_id = p_consultorio and not exists(select 1 from public.contratos c where c.paciente_id = pacientes.id and c.status='assinado');
 delete from public.base_conhecimento where consultorio_id = p_consultorio;
 delete from public.convenios where consultorio_id = p_consultorio;
 delete from public.profissionais where consultorio_id = p_consultorio;
 delete from public.config where consultorio_id = p_consultorio;

 insert into public.config(consultorio_id, chave, valor) values
  (p_consultorio,'horarios_atendimento','{"segunda":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"terca":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"quarta":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"quinta":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"sexta":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}],"sabado":[],"domingo":[]}'),
  (p_consultorio,'duracoes_por_tipo','{"Avaliação":30,"Limpeza":45,"Restauração":60,"Canal":90,"Retorno":30,"Clareamento":60}'),
  (p_consultorio,'teto_pacientes_novos_semana','20'), (p_consultorio,'agenda_ativa','true'), (p_consultorio,'agente_ativo','true'),
  (p_consultorio,'canal_urgencia','{"tipo":"whatsapp","destino":"+5511900000000"}'), (p_consultorio,'teto_gasto_ia_brl','300'),
  (p_consultorio,'consumo_fonte','"demonstracao"'), (p_consultorio,'cambio_fonte','"demonstracao"'), (p_consultorio,'cambio_usd_brl','5.2'),
  (p_consultorio,'confirmacao_ativa','true'), (p_consultorio,'confirmacao_antecedencia_horas','24'), (p_consultorio,'confirmacao_horario','"09:00"'),
  (p_consultorio,'campanha_pausada','false');

 insert into public.profissionais(consultorio_id, nome, cro, cor, ordem) values (p_consultorio, 'Dr. Mateus Peixoto (demo)', 'CRO-DEMO', '#1570EF', 0) returning id into prof;
 insert into public.convenios(consultorio_id, nome, cor) values (p_consultorio, 'SulAmérica', '#B54708') returning id into conv_sul;
 insert into public.convenios(consultorio_id, nome, cor) values (p_consultorio, 'Privian', '#067647') returning id into conv_priv;

 for i in 1..array_length(nomes,1) loop
  insert into public.pacientes(consultorio_id, nome, telefone_e164, origem, status, cpf, nascimento, convenio_id, primeiro_contato, ultimo_contato, observacoes)
  values (p_consultorio, nomes[i], '+55119000000' || lpad(i::text,2,'0'), (array['whatsapp','site','campanha','indicacao'])[1 + (i % 4)],
   case when i <= 8 then 'paciente' when i <= 11 then 'agendado' else 'novo' end, lpad((11111111100 + i)::text, 11, '0'), date '1980-01-01' + (i * 500),
   case when i % 3 = 0 then conv_sul when i % 3 = 1 then conv_priv else null end, now() - (i || ' days')::interval, now() - ((i % 5) || ' hours')::interval,
   case when i = 3 then 'Prefere horário de manhã. Tem medo de anestesia.' else '' end)
  on conflict (consultorio_id, telefone_e164) do update set nome = excluded.nome, status = excluded.status, convenio_id = excluded.convenio_id
  returning id into p;
  pac := pac || p;
 end loop;

 -- anamnese e odontograma de alguns
 insert into public.anamneses(paciente_id, consultorio_id, alergias, medicamentos, hipertensao, queixa_principal) values (pac[1], p_consultorio, 'Dipirona', 'Losartana 50mg', true, 'Sensibilidade no 36 ao gelado');
 insert into public.anamneses(paciente_id, consultorio_id, gestante, queixa_principal) values (pac[2], p_consultorio, true, 'Sangramento gengival');
 insert into public.odontograma(consultorio_id, paciente_id, dente, face, procedimento, status, valor, profissional_id) values
  (p_consultorio, pac[1], 36, 'O', 'Restauração em resina', 'planejado', 350, prof),
  (p_consultorio, pac[1], 16, 'todas', 'Coroa existente', 'existente', 0, prof),
  (p_consultorio, pac[1], 21, 'V', 'Faceta', 'planejado', 1800, prof),
  (p_consultorio, pac[2], 46, 'todas', 'Canal', 'realizado', 900, prof);
 insert into public.evolucoes(consultorio_id, paciente_id, profissional_id, texto, criado_em) values
  (p_consultorio, pac[1], prof, 'Avaliação inicial. Cárie oclusal no 36, sensibilidade ao frio. Plano: restauração em resina. Paciente de acordo.', now() - interval '20 days'),
  (p_consultorio, pac[1], prof, 'Profilaxia realizada. Orientação de escovação e fio dental. Retorno em 6 meses.', now() - interval '6 days'),
  (p_consultorio, pac[2], prof, 'Canal no 46 concluído em duas sessões. Sem dor. Encaminhar para coroa.', now() - interval '3 days');
 insert into public.retornos(consultorio_id, paciente_id, motivo, previsto_para, status) values
  (p_consultorio, pac[1], 'Limpeza semestral', hoje + 5, 'pendente'), (p_consultorio, pac[4], 'Limpeza semestral', hoje - 3, 'pendente'),
  (p_consultorio, pac[5], 'Controle do clareamento', hoje + 12, 'pendente'), (p_consultorio, pac[6], 'Limpeza semestral', hoje - 10, 'contatado');
 insert into public.orcamentos(consultorio_id, paciente_id, titulo, status, criado_em) values (p_consultorio, pac[1], 'Plano de tratamento', 'pendente', now() - interval '2 days') returning id into conv;
 insert into public.orcamento_itens(orcamento_id, consultorio_id, descricao, dente, valor_unitario, ordem) values (conv, p_consultorio, 'Restauração em resina', 36, 350, 0), (conv, p_consultorio, 'Faceta em cerâmica', 21, 1800, 1);
 insert into public.orcamentos(consultorio_id, paciente_id, titulo, status, decidido_em, criado_em) values (p_consultorio, pac[2], 'Coroa no 46', 'aprovado', now() - interval '1 day', now() - interval '4 days') returning id into conv;
 insert into public.orcamento_itens(orcamento_id, consultorio_id, descricao, dente, valor_unitario, ordem) values (conv, p_consultorio, 'Coroa em cerâmica', 46, 2200, 0);
 insert into public.orcamentos(consultorio_id, paciente_id, titulo, status, decidido_em, criado_em) values (p_consultorio, pac[7], 'Clareamento', 'recusado', now() - interval '5 days', now() - interval '9 days') returning id into conv;
 insert into public.orcamento_itens(orcamento_id, consultorio_id, descricao, valor_unitario, ordem) values (conv, p_consultorio, 'Clareamento em consultório (2 sessões)', 1200, 0);

 -- agenda da semana: segunda a sexta, manhã e tarde, com status variados
 i := 0;
 for d in 0..4 loop
  for h in 0..5 loop
   i := i + 1;
   ts := ((segunda + d)::timestamp + make_interval(hours => case when h < 3 then 8 + h else 14 + (h - 3) end)) at time zone 'America/Sao_Paulo';
   if i % 4 = 0 then continue; end if; -- buracos na agenda
   -- entra sempre como confirmado pelo painel (validação branda); o estado final é ajustado logo abaixo
   insert into public.agendamentos(consultorio_id, paciente_id, tipo, inicio, fim, status, confirmado_em, origem, observacao, paciente_novo, profissional_id, convenio_id, valor)
   values (p_consultorio, pac[1 + (i % 12)], tipos[1 + (i % 6)], ts, ts + interval '50 minutes', 'confirmado', now() - interval '1 day', 'painel',
    case when i = 5 then 'Paciente pediu para avisar 1h antes.' else '' end, i % 3 = 0, prof,
    case when i % 3 = 0 then conv_sul when i % 3 = 1 then conv_priv else null end, valores[1 + (i % 6)])
   returning id into conv;
   if ts < now() - interval '1 hour' then
    update public.agendamentos set status = case when i % 7 = 0 then 'faltou' else 'concluido' end where id = conv;
   elsif i % 5 = 0 then
    update public.agendamentos set status = 'sugerido', confirmado_em = null, origem = 'agente' where id = conv;
   elsif i % 3 = 0 then
    update public.agendamentos set status = 'agendado', confirmado_em = null where id = conv;
   end if;
  end loop;
 end loop;
 insert into public.bloqueios(consultorio_id, profissional_id, inicio, fim, motivo) values
  (p_consultorio, prof, ((segunda + 2)::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo', ((segunda + 2)::timestamp + interval '14 hours') at time zone 'America/Sao_Paulo', 'Almoço com fornecedor'),
  (p_consultorio, prof, ((segunda + 4)::timestamp + interval '17 hours') at time zone 'America/Sao_Paulo', ((segunda + 4)::timestamp + interval '18 hours') at time zone 'America/Sao_Paulo', 'Curso');

 -- conversas de WhatsApp com a IA
 for i in 1..7 loop
  insert into public.conversas(consultorio_id, paciente_id, iniciada_em, status, motivo_escalonamento, urgente, agente_pausado_ate, encerrada_em)
  values (p_consultorio, pac[i], now() - (i || ' hours')::interval,
   case when i <= 2 then 'escalada' when i <= 4 then 'ativa' when i = 5 then 'assumida' else 'encerrada' end,
   case when i = 1 then 'Paciente relata dor forte e pede encaixe hoje' when i = 2 then 'Quer saber valor de implante e parcelamento' end,
   i = 1, case when i <= 2 or i = 5 then now() + interval '30 minutes' end, case when i >= 6 then now() - interval '30 minutes' end)
  returning id into conv;
  insert into public.mensagens(consultorio_id, conversa_id, direcao, autor, texto, tipo, criada_em, wa_message_id) values
   (p_consultorio, conv, 'entrada', 'paciente', 'Oi, vi o site de vocês. Queria marcar uma avaliação.', 'texto', now() - (i || ' hours')::interval, 'demo-' || i || '-1'),
   (p_consultorio, conv, 'saida', 'agente', 'Olá! Que bom que você veio. Posso te ajudar a marcar. Você prefere de manhã ou à tarde?', 'texto', now() - (i || ' hours')::interval + interval '1 minute', 'demo-' || i || '-2'),
   (p_consultorio, conv, 'entrada', 'paciente', 'De manhã, se possível na quinta.', 'texto', now() - (i || ' hours')::interval + interval '3 minutes', 'demo-' || i || '-3'),
   (p_consultorio, conv, 'saida', 'agente', 'Tenho quinta às 9h ou às 10h30. Qual fica melhor?', 'texto', now() - (i || ' hours')::interval + interval '4 minutes', 'demo-' || i || '-4');
  if i = 1 then
   insert into public.mensagens(consultorio_id, conversa_id, direcao, autor, texto, tipo, transcricao, midia_url, criada_em, wa_message_id) values
    (p_consultorio, conv, 'entrada', 'paciente', '', 'audio', 'Na verdade tá doendo muito desde ontem, não consigo esperar até quinta', 'demo://audio-1', now() - interval '50 minutes', 'demo-1-5'),
    (p_consultorio, conv, 'saida', 'agente', 'Entendi, sinto muito pela dor. Vou avisar o Dr. Mateus agora para tentarmos um encaixe hoje. Enquanto isso, evite alimentos muito quentes ou gelados.', 'texto', null, null, now() - interval '49 minutes', 'demo-1-6');
  end if;
  if i = 5 then
   insert into public.mensagens(consultorio_id, conversa_id, direcao, autor, texto, tipo, criada_em, wa_message_id) values
    (p_consultorio, conv, 'saida', 'dentista', 'Oi, aqui é o Dr. Mateus. Vi sua mensagem, quinta às 9h está reservado para você.', 'texto', now() - interval '4 hours', 'demo-5-5');
  end if;
 end loop;

 insert into public.base_conhecimento(consultorio_id, pergunta, resposta, palavras_chave) values
  (p_consultorio, 'Quanto custa a avaliação?', 'A avaliação custa R$ 150 e o valor é abatido se você fechar o tratamento.', array['valor','preço','avaliação']),
  (p_consultorio, 'Vocês atendem convênio?', 'Atendemos SulAmérica e Privian. Para outros planos, emitimos recibo para reembolso.', array['convênio','plano']),
  (p_consultorio, 'Onde fica o consultório?', 'Ficamos na [ENDEREÇO], [BAIRRO]. Tem estacionamento na rua.', array['endereço','onde','estacionamento']),
  (p_consultorio, 'Formas de pagamento', 'Pix, dinheiro e cartão em até 10x.', array['pagamento','parcelar','cartão','pix']),
  (p_consultorio, 'Horário de atendimento', 'Segunda a sexta, das 8h às 12h e das 14h às 18h.', array['horário','abre','fecha']),
  (p_consultorio, 'Clareamento dói?', 'Pode dar uma sensibilidade leve por um ou dois dias. Usamos gel de concentração controlada.', array['clareamento','dói','sensibilidade']);

 insert into public.campanha_envios(consultorio_id, paciente_id, leva, enviada_em, status, respondida_em, erro)
 select p_consultorio, pac[n], 1 + (n % 2),
  case when n % 4 in (1,2) then now() - (n || ' days')::interval end,
  (array['erro','enviada','respondida','fila'])[1 + (n % 4)],
  case when n % 4 = 2 then now() - (n || ' hours')::interval end,
  case when n % 4 = 0 then 'Número inválido' end
 from generate_series(1, 12) n;

 insert into public.consumo_ia(consultorio_id, referencia_externa, periodo_inicio, periodo_fim, gasto_usd, cambio_usd_brl, fonte_consumo, fonte_cambio)
 values (p_consultorio, 'demo-' || to_char(now(),'YYYY-MM'), date_trunc('month', now()), now(), 12.4, 5.2, 'demonstracao', 'demonstracao')
 on conflict (referencia_externa) do update set gasto_usd = 12.4, periodo_fim = now();

 return jsonb_build_object('pacientes', array_length(pac,1), 'ok', true);
end $$;
revoke all on function public.semear_demo(uuid) from public, anon, authenticated;
grant execute on function public.semear_demo(uuid) to service_role;
commit;
