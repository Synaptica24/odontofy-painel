Você é o CODEX, dono do backend deste repositório. Leia, nesta ordem, antes de escrever qualquer coisa:
1. AGENTS.md (regras compartilhadas, donos de pasta, canal docs/PEDIDOS.md)
2. docs/BRIEF-BACKEND.md (seu brief completo, do dono do projeto)

Situação: repositório recém-criado com Next.js 16 (App Router, TypeScript, Tailwind 4). `npm install` está rodando em paralelo por outro processo — NÃO rode npm install nem npm run. As dependências @supabase/supabase-js, @supabase/ssr, sonner e lucide-react já estão sendo instaladas. Se precisar de outra, anote em docs/PEDIDOS.md em vez de instalar.

Esta é a FASE 1. Entregue exatamente isto e pare:

A) `lib/contratos.ts` — todos os tipos do domínio (Paciente, Conversa, Mensagem, Agendamento, CampanhaEnvio, ItemConhecimento, RegraEscalonamento, Config com TODOS os valores padrão tipados, Evento, filtros, resultados de statusCampanha e consumoDoMes, ResultadoApi<T> com erro tratado em português). Enums como union de string literal, nomes em português, iguais aos do brief.

B) `lib/api.ts` — TODAS as funções da seção 5 do brief com a assinatura final, devolvendo fixture obviamente fictícia (nomes "Paciente Teste 01", telefones +55 11 90000-00xx, textos de mensagem claramente de teste). Inclua inscreverEmConversas/inscreverEmMensagens devolvendo função de cancelamento. Marque com comentário `// STUB` cada função. Sem falar com Supabase ainda. Uma pequena latência simulada (200–400ms) é bem-vinda para o front testar skeleton. Exporte também uma constante `FIXTURE_ATIVA = true` para o front saber.

C) `docs/BACKEND-MODELO.md` — o modelo de dados final (tabelas, colunas, tipos Postgres, índices, constraints, o que vai em `config` com valor padrão de cada chave), a lista de RPCs para o n8n (assinaturas SQL), a lista de rotas em app/api/, e a estratégia de auth (magic link, uma conta, middleware). Em português.

D) `docs/PENDENCIAS.md`, seção "Backend (Codex)" — tudo que você precisa do dono do projeto e não está no brief (URL do Supabase, webhook do n8n, e-mail da conta única, canal de urgência, horários de atendimento reais, durações por tipo, teto semanal, câmbio/fonte do consumo de IA, etc.). Não invente nenhum desses valores; nos stubs use placeholders óbvios.

E) `.env.example` com as chaves que o backend vai precisar (sem valores).

Não crie migrações nem implementação real ainda: o brief exige aprovação do modelo antes. Assim que o dono aprovar, você recebe a FASE 2. Confirme que os arquivos compilam com `npx tsc --noEmit` só se node_modules já existir; se não existir, não rode nada.

Ao terminar, responda com um resumo curto em português: arquivos criados, decisões que tomou, e as 5 pendências mais importantes.
