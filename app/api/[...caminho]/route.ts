import { executarOperacao, erroSeguro } from '@/lib/servidor/painel';
import { origemValida, respostaApi } from '@/lib/servidor/http';

export const dynamic = 'force-dynamic';

async function atender(request: Request, contexto: { params: Promise<{ caminho: string[] }> }) {
  try {
    const { caminho } = await contexto.params;
    const rota = caminho.join('/');
    const metodo = request.method;
    if (metodo !== 'GET' && !origemValida(request)) throw { code: '42501' };
    const query = Object.fromEntries(new URL(request.url).searchParams);
    let a: Record<string, unknown> = query;
    if (metodo !== 'GET') {
      const corpo = await request.text();
      if (corpo.length > 64000) throw { code: '22023' };
      try { a = corpo ? JSON.parse(corpo) : {}; } catch { throw { code: '22023' }; }
      if (!a || typeof a !== 'object' || Array.isArray(a)) throw { code: '22023' };
    }
    let operacao = '';
    const estaticas: Record<string, string> = {
      'GET conversas': 'listarConversas', 'GET pacientes': 'listarPacientes', 'GET resumo': 'resumoDoDia',
      'GET agenda/dia': 'agendaDoDia', 'GET agenda/semana': 'agendaDaSemana', 'POST agenda/bloqueios': 'criarBloqueio',
      'GET conhecimento': 'listarConhecimento', 'POST conhecimento': 'salvarConhecimento',
      'GET campanha': 'statusCampanha', 'POST campanha/pausar': 'pausarCampanha', 'POST campanha/retomar': 'retomarCampanha',
      'GET config': 'lerConfig', 'PATCH config': 'salvarConfig', 'GET consumo': 'consumoDoMes',
    };
    operacao = estaticas[`${metodo} ${rota}`] ?? '';
    if (caminho[0] === 'conversas' && caminho.length >= 2) {
      a.id = caminho[1];
      operacao = caminho.length === 2 && metodo === 'GET' ? 'abrirConversa' : metodo === 'POST' && caminho.length === 3 ? ({ assumir: 'assumirConversa', devolver: 'devolverParaIA', mensagens: 'enviarMensagem' }[caminho[2]] ?? '') : '';
    }
    if (caminho[0] === 'pacientes' && caminho.length >= 2) {
      a.id = caminho[1]; operacao = caminho.length === 2 && metodo === 'GET' ? 'buscarPaciente' : caminho.length === 3 && caminho[2] === 'observacao' && metodo === 'PATCH' ? 'salvarObservacao' : '';
    }
    if (caminho[0] === 'agendamentos' && caminho.length === 3 && metodo === 'POST') {
      a.id = caminho[1]; operacao = { confirmar: 'confirmarSugestao', falta: 'marcarFalta', remarcar: 'remarcarAgendamento', cancelar: 'cancelarAgendamento' }[caminho[2]] ?? '';
    }
    if (caminho[0] === 'conhecimento' && caminho.length === 2) {
      a.id = caminho[1];
      operacao = metodo === 'DELETE' ? 'excluirConhecimento' : metodo === 'PATCH' ? 'alternarConhecimento' : metodo === 'PUT' ? 'salvarConhecimento' : '';
      if (metodo === 'PUT') a = { entrada: { ...a, id: caminho[1] } };
    }
    if (!operacao) return new Response('Rota não encontrada.', { status: 404 });
    if (metodo === 'GET' && operacao === 'listarConversas') {
      for (const campo of ['limite', 'deslocamento']) if (a[campo] !== undefined) a[campo] = Number(a[campo]);
      if (a.urgente !== undefined) { if (!['true','false'].includes(String(a.urgente))) throw { code: '22023' }; a.urgente = a.urgente === 'true'; }
    }
    if (operacao === 'agendaDoDia' || operacao === 'agendaDaSemana') a = { data: a.data ?? a.inicio, filtro: { ...(a.status ? { status: a.status } : {}), ...(a.paciente_id ? { paciente_id: a.paciente_id } : {}) } };
    if (metodo === 'POST' && rota === 'conhecimento') a = { entrada: a };
    if (operacao === 'salvarConfig') a = { alteracoes: a };
    return respostaApi(await executarOperacao(operacao, a));
  } catch (erro) { return respostaApi(erroSeguro(erro)); }
}
export const GET = atender;
export const POST = atender;
export const PATCH = atender;
export const PUT = atender;
export const DELETE = atender;
