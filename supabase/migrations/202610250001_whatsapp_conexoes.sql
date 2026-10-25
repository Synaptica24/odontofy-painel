-- WhatsApp do consultório via UAZ-API: uma instância por consultório.
-- O token da instância NUNCA sai do servidor: a coluna instance_token não tem select para authenticated
-- (privilégio por coluna) e só o service_role escreve nesta tabela. O painel lê pela sessão (RLS por consultório)
-- e o servidor (lib/servidor/whatsapp.ts) usa o service_role para o token.
-- TODO: criptografar instance_token em repouso (pgsodium/Vault) quando o projeto adotar um padrão; hoje fica em texto
-- no banco, protegido por privilégio de coluna + RLS.

create table public.whatsapp_conexoes (
 id uuid primary key default gen_random_uuid(),
 consultorio_id uuid not null unique references public.consultorios on delete cascade,
 instance_id text not null default '',
 instance_token text not null default '',
 status text not null default 'disconnected' check (status in ('disconnected','connecting','connected','hibernated')),
 numero_e164 text check (numero_e164 is null or numero_e164 ~ '^\+[1-9][0-9]{7,14}$'),
 metodo_pareamento text check (metodo_pareamento is null or metodo_pareamento in ('qr','pair')),
 iniciado_em timestamptz,
 pareado_em timestamptz,
 teste_enviado_em timestamptz,
 ultimo_erro text not null default '',
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now()
);
create index on public.whatsapp_conexoes(status);

create or replace function privado.tocar_atualizado_em() returns trigger language plpgsql set search_path = '' as $$
begin new.atualizado_em := now(); return new; end $$;
create trigger whatsapp_conexoes_atualizado before update on public.whatsapp_conexoes for each row execute function privado.tocar_atualizado_em();

-- trilha: registra em eventos quais chaves mudaram (nunca o valor do token)
create trigger auditar_whatsapp_conexoes after insert or update or delete on public.whatsapp_conexoes for each row execute function privado.auditar();

alter table public.whatsapp_conexoes enable row level security;
revoke all on public.whatsapp_conexoes from anon, authenticated;
grant all on public.whatsapp_conexoes to service_role;
-- leitura pelo painel sem a coluna do token; escrita só pelo servidor (service_role)
grant select (id, consultorio_id, instance_id, status, numero_e164, metodo_pareamento, iniciado_em, pareado_em, teste_enviado_em, ultimo_erro, criado_em, atualizado_em) on public.whatsapp_conexoes to authenticated;
create policy consultorio_le on public.whatsapp_conexoes for select to authenticated using (consultorio_id = (select public.consultorio_atual()));
