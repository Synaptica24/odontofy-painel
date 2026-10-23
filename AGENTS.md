<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Painel do consultório — regras compartilhadas (Codex + Claude Code)

Dois agentes constroem este projeto em paralelo. Leia isto antes de qualquer edição.

## Donos de pasta
- **Codex (backend)**: `supabase/`, `lib/`, `app/api/`, `middleware.ts`, tipos gerados, `docs/BACKEND-*.md`.
- **Claude Code (front-end)**: `app/(painel)/`, `components/`, `styles/`, `app/globals.css`, `app/layout.tsx`, `docs/FRONTEND-*.md`.
- Compartilhado (só mudanças pequenas, avise no `docs/PEDIDOS.md`): `package.json`, `next.config.ts`, `tsconfig.json`, `.env.example`, `README.md`.
- Nunca edite a pasta do outro. Precisa de algo lá? Escreva um pedido em `docs/PEDIDOS.md`.

## Canal de comunicação: `docs/PEDIDOS.md`
Formato de cada item: `- [ ] (de → para) pedido curto — data`. Quem atende marca `[x]` e escreve uma linha de resposta abaixo. Perguntas ao dono do projeto (Gabriel) vão em `docs/PENDENCIAS.md`, nunca inventadas.

## Contrato
- `lib/contratos.ts` (tipos) e `lib/api.ts` (funções) são o contrato entre os dois lados. O front NUNCA fala com Supabase direto.
- Assinatura em `lib/api.ts` não muda sem anotar em `docs/PEDIDOS.md` antes.
- Enquanto o backend não existe, `lib/api.ts` devolve fixture obviamente fictícia (nomes tipo "Paciente Teste 01", telefones +55 11 90000-0001).

## Regras do projeto inteiro
- Português do Brasil em tudo (código pode ter identificadores em português). Fuso `America/Sao_Paulo`.
- Dado de saúde é sensível (LGPD): nada de conversa de paciente em log de terceiro, analytics ou fixture com cara de real.
- Credencial só em variável de ambiente. `.env.local` nunca é commitado; `.env.example` lista as chaves.
- Briefs completos: `docs/BRIEF-BACKEND.md` (Codex) e `docs/BRIEF-FRONTEND.md` (Claude).
