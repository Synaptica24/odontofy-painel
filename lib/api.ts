/** Contrato único do front: fixture sem URL, operações autenticadas com URL. */
import * as fixture from './fixture';
import { operacaoPainel } from './painel-actions';
import { clienteBrowser } from './supabase/browser';
import type {
  Agendamento, Bloqueio, CallbackConversas, CallbackMensagens, CancelarInscricao, Config,
  Conversa, DataCivil, DataHora, DetalheConversa, DetalhePaciente, EntradaConhecimento,
  FiltroAgenda, FiltroConversas, Id, ItemConhecimento, Mensagem, Paciente, ResultadoAgenda,
  ResultadoApi, ResultadoConsumoDoMes, ResultadoStatusCampanha, ResumoConversa, ResumoDoDia,
} from './contratos';

export const FIXTURE_ATIVA = !process.env.NEXT_PUBLIC_SUPABASE_URL;
const indisponivel = <T>(): ResultadoApi<T> => ({ sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Não foi possível atualizar. Tente novamente.' } });
async function real<T>(operacao: string, argumentos: Record<string, unknown> = {}): Promise<ResultadoApi<T>> {
  try { return await operacaoPainel(operacao, argumentos) as ResultadoApi<T>; }
  catch { return indisponivel(); }
}
export async function listarConversas(filtro: FiltroConversas = {}): Promise<ResultadoApi<ResumoConversa[]>> {
  return FIXTURE_ATIVA ? fixture.listarConversas(filtro) : real('listarConversas', { ...filtro });
}
export async function abrirConversa(id: Id): Promise<ResultadoApi<DetalheConversa>> {
  return FIXTURE_ATIVA ? fixture.abrirConversa(id) : real('abrirConversa', { id });
}
export async function assumirConversa(conversaId: Id, ate?: DataHora): Promise<ResultadoApi<Conversa>> {
  return FIXTURE_ATIVA ? fixture.assumirConversa(conversaId, ate) : real('assumirConversa', { id: conversaId, ate });
}
export async function devolverParaIA(conversaId: Id): Promise<ResultadoApi<Conversa>> {
  return FIXTURE_ATIVA ? fixture.devolverParaIA(conversaId) : real('devolverParaIA', { id: conversaId });
}
// Uma tentativa ambígua mantém a correlação nesta aba; retry não cria outra mensagem.
const enviosPendentes = new Map<string, string>();
export async function enviarMensagem(conversaId: Id, texto: string): Promise<ResultadoApi<Mensagem>> {
  if (FIXTURE_ATIVA) return fixture.enviarMensagem(conversaId, texto);
  const chave = JSON.stringify([conversaId, texto]);
  const correlacao = enviosPendentes.get(chave) ?? crypto.randomUUID();
  enviosPendentes.set(chave, correlacao);
  try {
    const resultado: ResultadoApi<Mensagem> = typeof window === 'undefined'
      ? await real('enviarMensagem', { id: conversaId, texto, correlacao })
      : await fetch(`/api/conversas/${encodeURIComponent(conversaId)}/mensagens`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, correlacao }), cache: 'no-store' }).then((r) => r.json());
    if (resultado.sucesso || resultado.erro.codigo !== 'indisponivel') enviosPendentes.delete(chave);
    return resultado;
  } catch { return { sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Envio sem confirmação. Verifique o histórico antes de tentar novamente.' } }; }
}
export async function buscarPaciente(id: Id): Promise<ResultadoApi<DetalhePaciente>> {
  return FIXTURE_ATIVA ? fixture.buscarPaciente(id) : real('buscarPaciente', { id });
}
export async function salvarObservacao(pacienteId: Id, txt: string): Promise<ResultadoApi<Paciente>> {
  return FIXTURE_ATIVA ? fixture.salvarObservacao(pacienteId, txt) : real('salvarObservacao', { id: pacienteId, txt });
}
export async function agendaDoDia(data: DataCivil, filtro: FiltroAgenda = {}): Promise<ResultadoApi<ResultadoAgenda>> {
  return FIXTURE_ATIVA ? fixture.agendaDoDia(data, filtro) : real('agendaDoDia', { data, filtro });
}
export async function agendaDaSemana(inicio: DataCivil, filtro: FiltroAgenda = {}): Promise<ResultadoApi<ResultadoAgenda>> {
  return FIXTURE_ATIVA ? fixture.agendaDaSemana(inicio, filtro) : real('agendaDaSemana', { data: inicio, filtro });
}
export async function criarBloqueio(inicio: DataHora, fim: DataHora): Promise<ResultadoApi<Bloqueio>> {
  return FIXTURE_ATIVA ? fixture.criarBloqueio(inicio, fim) : real('criarBloqueio', { inicio, fim });
}
export async function confirmarSugestao(agendamentoId: Id): Promise<ResultadoApi<Agendamento>> {
  return FIXTURE_ATIVA ? fixture.confirmarSugestao(agendamentoId) : real('confirmarSugestao', { id: agendamentoId });
}
export async function marcarFalta(agendamentoId: Id): Promise<ResultadoApi<Agendamento>> {
  return FIXTURE_ATIVA ? fixture.marcarFalta(agendamentoId) : real('marcarFalta', { id: agendamentoId });
}
export async function listarConhecimento(): Promise<ResultadoApi<ItemConhecimento[]>> {
  return FIXTURE_ATIVA ? fixture.listarConhecimento() : real('listarConhecimento');
}
export async function salvarConhecimento(entrada: EntradaConhecimento): Promise<ResultadoApi<ItemConhecimento>> {
  return FIXTURE_ATIVA ? fixture.salvarConhecimento(entrada) : real('salvarConhecimento', { entrada });
}
export async function statusCampanha(): Promise<ResultadoApi<ResultadoStatusCampanha>> {
  return FIXTURE_ATIVA ? fixture.statusCampanha() : real('statusCampanha');
}
export async function pausarCampanha(): Promise<ResultadoApi<Config>> {
  return FIXTURE_ATIVA ? fixture.pausarCampanha() : real('pausarCampanha');
}
export async function retomarCampanha(): Promise<ResultadoApi<Config>> {
  return FIXTURE_ATIVA ? fixture.retomarCampanha() : real('retomarCampanha');
}
export async function lerConfig(): Promise<ResultadoApi<Config>> {
  return FIXTURE_ATIVA ? fixture.lerConfig() : real('lerConfig');
}
export async function salvarConfig(alteracoes: Partial<Config>): Promise<ResultadoApi<Config>> {
  return FIXTURE_ATIVA ? fixture.salvarConfig(alteracoes) : real('salvarConfig', { alteracoes });
}
export async function consumoDoMes(): Promise<ResultadoApi<ResultadoConsumoDoMes>> {
  return FIXTURE_ATIVA ? fixture.consumoDoMes() : real('consumoDoMes');
}
export async function resumoDoDia(data?: DataCivil): Promise<ResultadoApi<ResumoDoDia>> {
  return FIXTURE_ATIVA ? fixture.resumoDoDia(data) : real('resumoDoDia', { data });
}
export async function listarPacientes(busca?: string): Promise<ResultadoApi<Paciente[]>> {
  return FIXTURE_ATIVA ? fixture.listarPacientes(busca) : real('listarPacientes', { busca });
}
export async function remarcarAgendamento(id: Id, novoInicio: DataHora): Promise<ResultadoApi<Agendamento>> {
  return FIXTURE_ATIVA ? fixture.remarcarAgendamento(id, novoInicio) : real('remarcarAgendamento', { id, novoInicio });
}
export async function cancelarAgendamento(id: Id): Promise<ResultadoApi<Agendamento>> {
  return FIXTURE_ATIVA ? fixture.cancelarAgendamento(id) : real('cancelarAgendamento', { id });
}
export async function excluirConhecimento(id: Id): Promise<ResultadoApi<null>> {
  return FIXTURE_ATIVA ? fixture.excluirConhecimento(id) : real('excluirConhecimento', { id });
}
export async function alternarConhecimento(id: Id, ativo: boolean): Promise<ResultadoApi<ItemConhecimento>> {
  return FIXTURE_ATIVA ? fixture.alternarConhecimento(id, ativo) : real('alternarConhecimento', { id, ativo });
}

function inscrever<T>(tabela: 'conversas' | 'mensagens', ler: () => Promise<ResultadoApi<T>>, cb: (r: ResultadoApi<T>) => void, filtro?: string): CancelarInscricao {
  let cancelada = false, executando = false, repetir = false;
  const entregar = (r: ResultadoApi<T>) => { if (!cancelada) { try { cb(r); } catch { /* Sem logs de conteúdo. */ } } };
  const atualizar = async () => {
    if (cancelada) return;
    if (executando) { repetir = true; return; }
    executando = true;
    do { repetir = false; entregar(await ler()); } while (repetir && !cancelada);
    executando = false;
  };
  try {
    const cliente = clienteBrowser();
    const canal = cliente.channel(`painel-${tabela}-${crypto.randomUUID()}`);
    canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela, ...(filtro ? { filter: filtro } : {}) }, () => { void atualizar(); });
    if (tabela === 'conversas') canal.on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => { void atualizar(); });
    canal.subscribe((status) => {
      if (status === 'SUBSCRIBED') void atualizar();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') entregar(indisponivel());
    });
    let identidade: string | undefined;
    let identidadeLida = false;
    const auth = cliente.auth.onAuthStateChange((evento, sessao) => {
      const proxima = sessao?.user.id;
      if (evento === 'SIGNED_OUT' || (identidadeLida && identidade !== proxima)) cancelar();
      identidade = proxima; identidadeLida = true;
    });
    function cancelar() {
      if (cancelada) return;
      cancelada = true; enviosPendentes.clear(); auth.data.subscription.unsubscribe(); void cliente.removeChannel(canal);
    }
    void atualizar();
    return cancelar;
  } catch { queueMicrotask(() => entregar(indisponivel())); return () => { cancelada = true; }; }
}
export function inscreverEmConversas(cb: CallbackConversas): CancelarInscricao {
  return FIXTURE_ATIVA ? fixture.inscreverEmConversas(cb) : inscrever('conversas', () => real<ResumoConversa[]>('retratoConversas'), cb);
}
export function inscreverEmMensagens(conversaId: Id, cb: CallbackMensagens): CancelarInscricao {
  if (FIXTURE_ATIVA) return fixture.inscreverEmMensagens(conversaId, cb);
  return inscrever('mensagens', async () => {
    const resultado = await abrirConversa(conversaId);
    return resultado.sucesso ? { sucesso: true, dados: resultado.dados.mensagens, erro: null } : resultado;
  }, cb, `conversa_id=eq.${conversaId}`);
}
