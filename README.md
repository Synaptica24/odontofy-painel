# Painel do consultório

Next.js, TypeScript e Supabase. Português do Brasil e calendário `America/Sao_Paulo`.

## Rodar

Com as dependências já disponíveis, execute `npm run dev` e abra `http://localhost:3000`. Sem `NEXT_PUBLIC_SUPABASE_URL`, o painel funciona com fixture fictícia, sem autenticação ou envios reais. Copie `.env.example` para `.env.local` apenas para configurar a integração; nunca publique segredos.

## Supabase

1. Crie um projeto na organização e região aprovadas. Configure URL e chave pública em `.env.local`.
2. Aplique os cinco arquivos de `supabase/migrations/` em ordem pelo SQL Editor. Alternativamente, com CLI Supabase configurada, use `supabase link --project-ref <referencia>` e `supabase db push`. Não aplique fixtures em produção.
3. Desative cadastro público em Auth, provisione a conta única e registre seu UUID pelo SQL Editor: `insert into public.conta_autorizada(id) values ('UUID-DA-CONTA');`. Configure o mesmo e-mail em `AUTH_EMAIL_PERMITIDO`.
4. Configure `APP_URL`, Site URL do Auth, callback permitido `<APP_URL>/api/auth/callback` e entrega SMTP dos magic links. O cadastro via aplicação está desabilitado.
5. n8n usa service role em seu ambiente seguro; o painel usa apenas sessão autenticada e chave pública. Configure webhook e segredo no servidor. O envio só ativa após adoção do protocolo de [BACKEND-FASE2.md](docs/BACKEND-FASE2.md).

## Configuração e verificações

Edite os ajustes pelo painel (`salvarConfig`) ou RPC `salvar_config(p_alteracoes jsonb)` com conta autorizada/service role. A atualização é parcial por chave; cada objeto/array informado substitui seu valor inteiro. Configure horários, durações e teto antes de ativar agenda. Padrões começam desativados, teto zero não concede vagas. Todas as edições de config/conhecimento são auditadas em `eventos`.

Execute `npx tsc --noEmit` e `npx eslint lib app/api proxy.ts`. Testes de banco e protocolo: [BACKEND-FASE2.md](docs/BACKEND-FASE2.md). Credenciais, parâmetros operacionais e homologação externa: [PENDENCIAS.md](docs/PENDENCIAS.md).

Para deploy na Vercel, recomendo instalar a CLI com `npm i -g vercel`, habilitando `vercel env pull`, `vercel deploy` e `vercel logs`. Nenhuma instalação ou publicação foi feita nesta entrega.

## Deploy

A Vercel publica sozinha a cada push na branch `main` do GitHub (projeto `dr-mateus-peixoto`). Deploy manual: `npx vercel deploy --prod`.
