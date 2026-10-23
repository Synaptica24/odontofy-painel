import { NextResponse } from 'next/server';
import { assinarPorToken, contratoPublico } from '@/lib/servidor/assinar-publico';

export const dynamic = 'force-dynamic';

function resposta(r: { sucesso: boolean; dados: unknown; erro: { codigo: string; mensagem: string } | null }) {
  const status = r.sucesso ? 200 : r.erro?.codigo === 'nao_encontrado' ? 404 : r.erro?.codigo === 'nao_autorizado' ? 403 : r.erro?.codigo === 'validacao' ? 400 : r.erro?.codigo === 'conflito' ? 409 : 503;
  return NextResponse.json(r, { status, headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET(_: Request, contexto: { params: Promise<{ token: string }> }) {
  const { token } = await contexto.params;
  const r = await contratoPublico(token);
  // o conteúdo já vai na página; a API devolve só o estado (sem o texto do contrato)
  return resposta(r.sucesso ? { sucesso: true, dados: { status: r.dados.status, expirado: r.dados.expirado, assinado_em: r.dados.assinado_em }, erro: null } : r);
}

export async function POST(request: Request, contexto: { params: Promise<{ token: string }> }) {
  const { token } = await contexto.params;
  let corpo: Record<string, unknown> = {};
  try {
    const texto = await request.text();
    if (texto.length > 400 * 1024) throw new Error('grande');
    corpo = texto ? JSON.parse(texto) : {};
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new Error('corpo');
  } catch {
    return resposta({ sucesso: false, dados: null, erro: { codigo: 'validacao', mensagem: 'Pedido inválido.' } });
  }
  const ip = (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? '').trim();
  const r = await assinarPorToken(token, {
    nome: String(corpo.nome ?? ''), cpf: String(corpo.cpf ?? ''), aceite: corpo.aceite === true,
    imagem_png: String(corpo.imagem_png ?? ''), ip, user_agent: request.headers.get('user-agent') ?? '',
  });
  return resposta(r);
}
