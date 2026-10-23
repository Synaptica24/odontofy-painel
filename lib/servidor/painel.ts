import 'server-only';
import { sessaoAutorizada } from '../supabase/server';
import type { CodigoErro, Json, ResultadoApi } from '../contratos';

type Argumentos = Record<string, unknown>;
const objeto = (v: unknown): Argumentos => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw { code: '22023' };
  return v as Argumentos;
};
function texto(v: unknown, limite = 20000): string {
  if (typeof v !== 'string' || v.length > limite) throw { code: '22023' };
  return v;
}
function id(v: unknown): string {
  const s = texto(v, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) throw { code: '22023' };
  return s;
}
function instante(v: unknown): string {
  const s = texto(v, 40);
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s) || !Number.isFinite(Date.parse(s))) throw { code: '22023' };
  return s;
}
export function erroSeguro(erro: unknown): ResultadoApi<never> {
  const code = erro && typeof erro === 'object' && 'code' in erro ? String(erro.code) : '';
  const codigo: CodigoErro = code === '42501' ? 'nao_autorizado' : ['P0002','PGRST116'].includes(code) ? 'nao_encontrado' : ['23505','23514','23P01','40001','40P01'].includes(code) ? 'conflito' : code.startsWith('22') || ['23502','23503'].includes(code) ? 'validacao' : 'indisponivel';
  const mensagens: Record<CodigoErro, string> = {
    nao_autorizado: 'Entre com a conta autorizada.', nao_encontrado: 'Registro não encontrado. Atualize a tela.',
    conflito: 'A operação conflita com o estado atual ou com as regras da agenda. Atualize e revise os ajustes.',
    validacao: 'Revise os campos informados.', indisponivel: 'Não foi possível concluir. Em envios, verifique o histórico antes de tentar novamente.',
  };
  return { sucesso: false, dados: null, erro: { codigo, mensagem: mensagens[codigo] } };
}

export async function executarOperacao(operacao: string, entrada: unknown): Promise<ResultadoApi<Json>> {
  try {
    const cliente = await sessaoAutorizada();
    const a = objeto(entrada);
    const rpc = async (nome: string, parametros: Argumentos = {}) => {
      const { data, error } = await cliente.rpc(nome, parametros);
      if (error) throw error;
      return data as Json;
    };
    let dados: Json;
    switch (operacao) {
      case 'retratoConversas': dados = await rpc('retrato_conversas'); break;
      case 'listarConversas': dados = await rpc('painel_leitura', { p_operacao: 'conversas', p_argumentos: a }); break;
      case 'abrirConversa': dados = await rpc('painel_leitura', { p_operacao: 'conversa', p_argumentos: { id: id(a.id) } }); break;
      case 'buscarPaciente': dados = await rpc('painel_leitura', { p_operacao: 'paciente', p_argumentos: { id: id(a.id) } }); break;
      case 'listarPacientes': dados = await rpc('painel_leitura', { p_operacao: 'pacientes', p_argumentos: { busca: texto(a.busca ?? '', 200) } }); break;
      case 'agendaDoDia': case 'agendaDaSemana': {
        const data = texto(a.data, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw { code: '22023' };
        dados = await rpc('painel_leitura', { p_operacao: 'agenda', p_argumentos: { data, dias: operacao === 'agendaDoDia' ? 1 : 7, filtro: objeto(a.filtro ?? {}) } }); break;
      }
      case 'resumoDoDia': dados = await rpc('resumo_do_dia', a.data ? { p_data: texto(a.data, 10) } : {}); break;
      case 'statusCampanha': case 'consumoDoMes': dados = await rpc('painel_leitura', { p_operacao: operacao === 'statusCampanha' ? 'campanha' : 'consumo' }); break;
      case 'assumirConversa': dados = await rpc('assumir_conversa', { p_conversa_id: id(a.id), ...(a.ate ? { p_ate: instante(a.ate) } : {}) }); break;
      case 'devolverParaIA': dados = await rpc('devolver_para_ia', { p_conversa_id: id(a.id) }); break;
      case 'criarBloqueio': dados = await rpc('criar_bloqueio', { p_inicio: instante(a.inicio), p_fim: instante(a.fim) }); break;
      case 'confirmarSugestao': case 'marcarFalta': case 'cancelarAgendamento': case 'remarcarAgendamento': {
        const nomes = { confirmarSugestao: 'confirmar_sugestao', marcarFalta: 'marcar_falta', cancelarAgendamento: 'cancelar_agendamento', remarcarAgendamento: 'remarcar_agendamento' };
        dados = await rpc(nomes[operacao], { p_agendamento_id: id(a.id), ...(operacao === 'remarcarAgendamento' ? { p_novo_inicio: instante(a.novoInicio) } : {}) }); break;
      }
      case 'lerConfig': dados = await rpc('ler_config'); break;
      case 'salvarConfig': dados = await rpc('salvar_config', { p_alteracoes: objeto(a.alteracoes) }); break;
      case 'pausarCampanha': case 'retomarCampanha': dados = await rpc('salvar_config', { p_alteracoes: { campanha_pausada: operacao === 'pausarCampanha' } }); break;
      case 'salvarObservacao': {
        const { data, error } = await cliente.from('pacientes').update({ observacoes: texto(a.txt) }).eq('id', id(a.id)).select().single();
        if (error) throw error; dados = data; break;
      }
      case 'listarConhecimento': {
        const { data, error } = await cliente.from('base_conhecimento').select('*').order('pergunta').order('id');
        if (error) throw error; dados = data; break;
      }
      case 'salvarConhecimento': {
        const e = objeto(a.entrada);
        if (typeof e.ativo !== 'boolean' || !Array.isArray(e.palavras_chave) || e.palavras_chave.length > 100) throw { code: '22023' };
        const campos = { pergunta: texto(e.pergunta, 2000), resposta: texto(e.resposta), ativo: e.ativo, palavras_chave: e.palavras_chave.map((p) => texto(p, 200)) };
        const consulta = e.id ? cliente.from('base_conhecimento').update(campos).eq('id', id(e.id)) : cliente.from('base_conhecimento').insert(campos);
        const { data, error } = await consulta.select().single();
        if (error) throw error; dados = data; break;
      }
      case 'excluirConhecimento': case 'alternarConhecimento': {
        if (operacao === 'alternarConhecimento' && typeof a.ativo !== 'boolean') throw { code: '22023' };
        const consulta = operacao === 'excluirConhecimento' ? cliente.from('base_conhecimento').delete() : cliente.from('base_conhecimento').update({ ativo: a.ativo });
        const { data, error } = await consulta.eq('id', id(a.id)).select().single();
        if (error) throw error; dados = operacao === 'excluirConhecimento' ? null : data; break;
      }
      case 'enviarMensagem': {
        // O fluxo n8n deve adotar o contrato documentado antes de habilitar este envio.
        const webhook = process.env.N8N_ENVIO_WEBHOOK_URL;
        const segredo = process.env.N8N_ENVIO_WEBHOOK_SECRET;
        if (!webhook || !segredo || process.env.N8N_ENVIO_PROTOCOLO !== 'correlacao-v1') throw new Error('Envio não configurado');
        const url = new URL(webhook);
        if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error('Webhook inválido');
        const conversaId = id(a.id), mensagemId = id(a.correlacao), conteudo = texto(a.texto);
        if (!conteudo.trim()) throw { code: '22023' };
        const pendente = await rpc('preparar_envio', { p_conversa_id: conversaId, p_texto: conteudo, p_id: mensagemId }) as Record<string, Json>;
        if (pendente.wa_message_id) { dados = pendente; break; }
        const resposta = await fetch(url, {
          method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}`, 'Idempotency-Key': mensagemId },
          body: JSON.stringify({ versao: 'correlacao-v1', mensagem_id: mensagemId, conversa_id: conversaId, texto: conteudo }),
        });
        if (!resposta.ok) throw new Error('Envio pendente');
        const ack = objeto(await resposta.json());
        if (ack.mensagem_id !== mensagemId || ack.status !== 'enviada' || typeof ack.wa_message_id !== 'string') throw new Error('Confirmação inválida');
        const { data, error } = await cliente.from('mensagens').select('*').eq('id', mensagemId).single();
        if (error || !data?.wa_message_id || data.wa_message_id !== ack.wa_message_id) throw new Error('Confirmação não persistida');
        dados = data; break;
      }
      default: throw { code: '22023' };
    }
    return { sucesso: true, dados, erro: null };
  } catch (erro) { return erroSeguro(erro); }
}
