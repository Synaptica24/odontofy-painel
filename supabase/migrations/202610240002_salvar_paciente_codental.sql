-- salvar_paciente passa a gravar os campos cadastrais importados do Codental e aceita telefone opcional.
-- Escrita por Claude Code a pedido direto do Gabriel (2026-10-24); ver docs/PEDIDOS.md.
begin;

create or replace function public.salvar_paciente(p_id uuid, p_dados jsonb) returns public.pacientes language plpgsql security definer set search_path = '' as $$
declare p public.pacientes; atual uuid := public.consultorio_atual(); tel text;
begin
 perform privado.exigir_acesso();
 tel := nullif(btrim(coalesce(p_dados->>'telefone_e164','')),'');
 if p_id is null then
  -- Sem celular próprio só com outro número de contato (familiar) ou fixo: ninguém fica sem forma de contato.
  if tel is null and coalesce(btrim(p_dados->>'telefone_contato'),'') = '' and coalesce(btrim(p_dados->>'telefone_fixo'),'') = '' then
   raise exception 'Informe um telefone' using errcode='22023';
  end if;
  insert into public.pacientes(consultorio_id,nome,telefone_e164,origem,cpf,nascimento,email,endereco,convenio_id,numero_carteirinha,observacoes,criado_por,status,nao_perturbe,
   telefone_contato,telefone_fixo,sexo,rg,profissao,cep,complemento,bairro,cidade,estado,responsavel_nome,responsavel_nascimento,responsavel_documento,
   emergencia_nome,emergencia_telefone,como_conheceu,convenio_titular,convenio_titular_cpf)
  values(atual, btrim(p_dados->>'nome'), tel, coalesce(p_dados->>'origem','indicacao'), regexp_replace(coalesce(p_dados->>'cpf',''),'\D','','g'),
   nullif(p_dados->>'nascimento','')::date, coalesce(p_dados->>'email',''), coalesce(p_dados->>'endereco',''), nullif(p_dados->>'convenio_id','')::uuid, coalesce(p_dados->>'numero_carteirinha',''), coalesce(p_dados->>'observacoes',''), auth.uid(), 'paciente', coalesce((p_dados->>'nao_perturbe')::boolean,false),
   coalesce(p_dados->>'telefone_contato',''), coalesce(p_dados->>'telefone_fixo',''), coalesce(p_dados->>'sexo',''), coalesce(p_dados->>'rg',''), coalesce(p_dados->>'profissao',''),
   coalesce(p_dados->>'cep',''), coalesce(p_dados->>'complemento',''), coalesce(p_dados->>'bairro',''), coalesce(p_dados->>'cidade',''), coalesce(p_dados->>'estado',''),
   coalesce(p_dados->>'responsavel_nome',''), nullif(p_dados->>'responsavel_nascimento','')::date, coalesce(p_dados->>'responsavel_documento',''),
   coalesce(p_dados->>'emergencia_nome',''), coalesce(p_dados->>'emergencia_telefone',''), coalesce(p_dados->>'como_conheceu',''),
   coalesce(p_dados->>'convenio_titular',''), regexp_replace(coalesce(p_dados->>'convenio_titular_cpf',''),'\D','','g'))
  returning * into p;
 else
  update public.pacientes set
   nome = coalesce(nullif(btrim(p_dados->>'nome'),''), nome),
   -- chave presente = pode limpar (null) desde que sobre outro contato; chave ausente = mantém
   telefone_e164 = case when p_dados ? 'telefone_e164' then tel else telefone_e164 end,
   cpf = case when p_dados ? 'cpf' then regexp_replace(coalesce(p_dados->>'cpf',''),'\D','','g') else cpf end,
   nascimento = case when p_dados ? 'nascimento' then nullif(p_dados->>'nascimento','')::date else nascimento end,
   email = coalesce(p_dados->>'email', email), endereco = coalesce(p_dados->>'endereco', endereco),
   convenio_id = case when p_dados ? 'convenio_id' then nullif(p_dados->>'convenio_id','')::uuid else convenio_id end,
   numero_carteirinha = coalesce(p_dados->>'numero_carteirinha', numero_carteirinha),
   observacoes = coalesce(p_dados->>'observacoes', observacoes), nao_perturbe = coalesce((p_dados->>'nao_perturbe')::boolean, nao_perturbe),
   telefone_contato = coalesce(p_dados->>'telefone_contato', telefone_contato), telefone_fixo = coalesce(p_dados->>'telefone_fixo', telefone_fixo),
   sexo = coalesce(p_dados->>'sexo', sexo), rg = coalesce(p_dados->>'rg', rg), profissao = coalesce(p_dados->>'profissao', profissao),
   cep = coalesce(p_dados->>'cep', cep), complemento = coalesce(p_dados->>'complemento', complemento), bairro = coalesce(p_dados->>'bairro', bairro),
   cidade = coalesce(p_dados->>'cidade', cidade), estado = coalesce(p_dados->>'estado', estado),
   responsavel_nome = coalesce(p_dados->>'responsavel_nome', responsavel_nome),
   responsavel_nascimento = case when p_dados ? 'responsavel_nascimento' then nullif(p_dados->>'responsavel_nascimento','')::date else responsavel_nascimento end,
   responsavel_documento = coalesce(p_dados->>'responsavel_documento', responsavel_documento),
   emergencia_nome = coalesce(p_dados->>'emergencia_nome', emergencia_nome), emergencia_telefone = coalesce(p_dados->>'emergencia_telefone', emergencia_telefone),
   como_conheceu = coalesce(p_dados->>'como_conheceu', como_conheceu),
   convenio_titular = coalesce(p_dados->>'convenio_titular', convenio_titular),
   convenio_titular_cpf = case when p_dados ? 'convenio_titular_cpf' then regexp_replace(coalesce(p_dados->>'convenio_titular_cpf',''),'\D','','g') else convenio_titular_cpf end
  where id = p_id and consultorio_id = atual returning * into p;
  if not found then raise exception 'Paciente não encontrado' using errcode='P0002'; end if;
  if p.telefone_e164 is null and p.telefone_contato = '' and p.telefone_fixo = '' then
   raise exception 'Informe um telefone' using errcode='22023';
  end if;
 end if;
 return p;
end $$;
revoke all on function public.salvar_paciente(uuid, jsonb) from public, anon;
grant execute on function public.salvar_paciente(uuid, jsonb) to authenticated, service_role;

commit;
