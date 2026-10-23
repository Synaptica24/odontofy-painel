import 'server-only';
import type { ResultadoApi } from '../contratos';

export function origemValida(request: Request): boolean {
  const origem = request.headers.get('origin');
  const esperada = process.env.APP_URL;
  if (!origem || !esperada) return false;
  try { return origem === new URL(esperada).origin; } catch { return false; }
}
export function respostaApi(resultado: ResultadoApi<unknown>) {
  const status = resultado.sucesso ? 200 : { nao_autorizado: 401, nao_encontrado: 404, conflito: 409, validacao: 400, indisponivel: 503 }[resultado.erro.codigo];
  return Response.json(resultado, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
