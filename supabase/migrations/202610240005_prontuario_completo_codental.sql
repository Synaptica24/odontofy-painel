-- prontuario_completo devolve também o que veio do Codental: pagamentos, anamneses respondidas (por modelo) e receitas/atestados.
-- Mesmo corpo de 202610230002, com três chaves novas. Escrito pelo Claude a pedido do Gabriel (pasta do Codex; aviso em docs/PEDIDOS.md).
create or replace function public.prontuario_completo(p_paciente uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare atual uuid := public.consultorio_atual(); r jsonb;
begin
 perform privado.exigir_acesso();
 select jsonb_build_object(
  'paciente', to_jsonb(p) || jsonb_build_object('convenio',(select to_jsonb(cv) from public.convenios cv where cv.id=p.convenio_id)),
  'anamnese', (select to_jsonb(a) from public.anamneses a where a.paciente_id = p.id),
  'anamneses_respostas', (select coalesce(jsonb_agg(to_jsonb(ar) order by ar.criado_em desc),'[]') from public.anamneses_respostas ar where ar.paciente_id = p.id),
  'odontograma', (select coalesce(jsonb_agg(to_jsonb(o) order by o.dente, o.registrado_em),'[]') from public.odontograma o where o.paciente_id = p.id),
  'evolucoes', (select coalesce(jsonb_agg(to_jsonb(e) || jsonb_build_object('profissional',(select nome from public.profissionais where id=e.profissional_id)) order by e.criado_em desc),'[]') from public.evolucoes e where e.paciente_id = p.id),
  'anexos', (select coalesce(jsonb_agg(to_jsonb(x) order by x.criado_em desc),'[]') from public.anexos x where x.paciente_id = p.id),
  'orcamentos', (select coalesce(jsonb_agg(to_jsonb(o) || jsonb_build_object('itens',(select coalesce(jsonb_agg(to_jsonb(i) order by i.ordem),'[]') from public.orcamento_itens i where i.orcamento_id=o.id),
    'total',coalesce(o.valor_total,(select coalesce(sum(i.quantidade*i.valor_unitario),0) from public.orcamento_itens i where i.orcamento_id=o.id) - o.desconto)) order by o.criado_em desc),'[]') from public.orcamentos o where o.paciente_id = p.id),
  'pagamentos', (select coalesce(jsonb_agg(to_jsonb(pg) order by pg.vencimento desc nulls last, pg.criado_em desc),'[]') from public.pagamentos pg where pg.paciente_id = p.id),
  'documentos', (select coalesce(jsonb_agg(to_jsonb(de) order by de.criado_em desc),'[]') from public.documentos_emitidos de where de.paciente_id = p.id),
  'contratos', (select coalesce(jsonb_agg(to_jsonb(c) - 'token' order by c.criado_em desc),'[]') from public.contratos c where c.paciente_id = p.id),
  'agendamentos', (select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object('profissional',(select nome from public.profissionais where id=a.profissional_id)) order by a.inicio desc),'[]') from public.agendamentos a where a.paciente_id = p.id),
  'retornos', (select coalesce(jsonb_agg(to_jsonb(r2) order by r2.previsto_para),'[]') from public.retornos r2 where r2.paciente_id = p.id),
  'acessos', (select coalesce(jsonb_agg(to_jsonb(ac) order by ac.criado_em desc),'[]') from (select * from public.acessos_prontuario where paciente_id = p.id order by criado_em desc limit 30) ac)
 ) into r from public.pacientes p where p.id = p_paciente and p.consultorio_id = atual;
 if r is null then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
 return r;
end $$;
