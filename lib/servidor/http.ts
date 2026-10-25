import 'server-only';
import type { ResultadoApi } from '../contratos';

/** Origens aceitas em POSTs das rotas /api: APP_URL (endereço principal do painel) e, separadas por vírgula,
 *  APP_ORIGENS_EXTRAS (ex.: o domínio antigo, que continua servindo o site do consultório). */
function origensPermitidas(): string[] {
  return [process.env.APP_URL, ...(process.env.APP_ORIGENS_EXTRAS ?? '').split(',')]
    .map((v) => (v ?? '').trim())
    .filter(Boolean)
    .flatMap((v) => { try { return [new URL(v).origin]; } catch { return []; } });
}

export function origemValida(request: Request): boolean {
  const origem = request.headers.get('origin');
  if (!origem) return false;
  return origensPermitidas().includes(origem);
}
export function respostaApi(resultado: ResultadoApi<unknown>) {
  const status = resultado.sucesso ? 200 : { nao_autorizado: 401, nao_encontrado: 404, conflito: 409, validacao: 400, indisponivel: 503 }[resultado.erro.codigo];
  return Response.json(resultado, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
