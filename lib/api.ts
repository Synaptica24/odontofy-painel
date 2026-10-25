/** Contrato único do front: fixture sem URL, operações autenticadas com URL. */
import * as fixture from './fixture';
import { operacaoPainel, operacaoPainelLote } from './painel-actions';
import { clienteBrowser } from './supabase/browser';
import type {
  Agendamento, Anamnese, Anexo, Bloqueio, CallbackConversas, CallbackMensagens, CancelarInscricao, Config,
  Consultorio, Contrato, ContratoModelo, Convenio, Conversa, DadosPaciente, DataCivil, DataHora, DetalheConversa, DetalhePaciente, EntradaConhecimento,
  Evolucao, FiltroAgenda, FiltroAgendaCompleto, FiltroConversas, FinanceiroResumo, Id, ItemConhecimento, ItemOdontograma, Mensagem, NovoAgendamento,
  Orcamento, OrcamentoItem, Paciente, Profissional, Prontuario, ResultadoAgenda,
  ResultadoApi, ResultadoConsumoDoMes, ResultadoStatusCampanha, ResumoConversa, ResumoDoDia, Retorno, StatusOrcamento, StatusRetorno, WhatsappConexao,
} from './contratos';

export const FIXTURE_ATIVA = !process.env.NEXT_PUBLIC_SUPABASE_URL;
const indisponivel = <T>(): ResultadoApi<T> => ({ sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Não foi possível atualizar. Tente novamente.' } });
/* No navegador, server actions rodam uma de cada vez. Uma tela que pede 6 coisas esperaria 6 viagens em fila.
   Aqui as chamadas feitas no mesmo instante entram numa fila curta e saem juntas numa única action (lote),
   que o servidor executa em paralelo. No servidor (Server Components) a chamada vai direto. */
type Pendente = { operacao: string; argumentos: Record<string, unknown>; resolver: (r: ResultadoApi<unknown>) => void };
let fila: Pendente[] = [];
let agendado = false;
function despachar() {
  const lote = fila;
  fila = [];
  agendado = false;
  if (lote.length === 1) {
    const [p] = lote;
    operacaoPainel(p.operacao, p.argumentos).then((r) => p.resolver(r as ResultadoApi<unknown>), () => p.resolver(indisponivel()));
    return;
  }
  for (let i = 0; i < lote.length; i += 25) {
    const parte = lote.slice(i, i + 25);
    operacaoPainelLote(parte.map((p) => ({ operacao: p.operacao, argumentos: p.argumentos })))
      .then((rs) => parte.forEach((p, j) => p.resolver((rs[j] as ResultadoApi<unknown>) ?? indisponivel())))
      .catch(() => parte.forEach((p) => p.resolver(indisponivel())));
  }
}
async function real<T>(operacao: string, argumentos: Record<string, unknown> = {}): Promise<ResultadoApi<T>> {
  if (typeof window === 'undefined') {
    try { return await operacaoPainel(operacao, argumentos) as ResultadoApi<T>; }
    catch { return indisponivel(); }
  }
  return new Promise<ResultadoApi<T>>((resolver) => {
    fila.push({ operacao, argumentos, resolver: resolver as (r: ResultadoApi<unknown>) => void });
    if (!agendado) { agendado = true; window.setTimeout(despachar, 0); }
  });
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
/* ---------- Clínica: consultórios, agenda do painel, prontuário, orçamentos, retornos, contratos, financeiro ----------
   Sem Supabase (fixture) estas funções devolvem "indisponível": a demonstração real vive no consultório "Demonstração". */
const semFixture = <T>(): Promise<ResultadoApi<T>> => Promise.resolve({ sucesso: false, dados: null, erro: { codigo: 'indisponivel', mensagem: 'Disponível só com o Supabase configurado.' } });
const clinica = <T>(operacao: string, argumentos: Record<string, unknown> = {}) => (FIXTURE_ATIVA ? semFixture<T>() : real<T>(operacao, argumentos));

/* ---------- WhatsApp do consultório (UAZ-API) ----------
   O navegador só recebe WhatsappConexao (status, número mascarado, QR/código temporários). Tokens ficam no servidor. */
export const whatsappStatus = () => clinica<WhatsappConexao>('whatsappStatus');
export const whatsappIniciar = (metodo: 'qr' | 'pair', telefone?: string) => clinica<WhatsappConexao>('whatsappIniciar', { metodo, telefone });
export const whatsappAtualizarStatus = () => clinica<WhatsappConexao>('whatsappAtualizarStatus');
export const whatsappDesconectar = () => clinica<WhatsappConexao>('whatsappDesconectar');
export const whatsappEnviarTeste = () => clinica<WhatsappConexao>('whatsappEnviarTeste');

export const meusConsultorios = () => clinica<Consultorio[]>('meusConsultorios');
export const escolherConsultorio = (id: Id) => clinica<Id>('escolherConsultorio', { id });
export const listarProfissionais = () => clinica<Profissional[]>('listarProfissionais');
export const salvarProfissional = (profissional: Partial<Profissional>) => clinica<Profissional>('salvarProfissional', { profissional });
export const listarConvenios = () => clinica<Convenio[]>('listarConvenios');
export const salvarConvenio = (convenio: Partial<Convenio>) => clinica<Convenio>('salvarConvenio', { convenio });
export const excluirConvenio = (id: Id) => clinica<null>('excluirConvenio', { id });

export const salvarPaciente = (id: Id | null, dados: DadosPaciente) => clinica<Paciente>('salvarPaciente', { id, dados });
export const criarAgendamento = (dados: NovoAgendamento) => clinica<Agendamento>('criarAgendamento', { dados });
export const editarAgendamento = (id: Id, alteracoes: Partial<NovoAgendamento>) => clinica<Agendamento>('editarAgendamento', { id, alteracoes });
export const concluirAgendamento = (id: Id) => clinica<Agendamento>('concluirAgendamento', { id });
export const criarBloqueioPainel = (inicio: DataHora, fim: DataHora, profissional_id?: Id | null, motivo?: string) => clinica<Bloqueio>('criarBloqueioPainel', { inicio, fim, profissional_id, motivo });
export const removerBloqueio = (id: Id) => clinica<null>('removerBloqueio', { id });
export const marcarConfirmacaoEnviada = (id: Id) => clinica<Agendamento>('marcarConfirmacaoEnviada', { id });
export const agendaFiltrada = (data: DataCivil, dias: 1 | 7, filtro: FiltroAgendaCompleto = {}) => clinica<ResultadoAgenda>('agendaFiltrada', { data, dias, filtro });

export const prontuario = (id: Id) => clinica<Prontuario>('prontuario', { id });
export const salvarAnamnese = (id: Id, anamnese: Partial<Anamnese>) => clinica<Anamnese>('salvarAnamnese', { id, anamnese });
export const salvarItemOdontograma = (item: Partial<ItemOdontograma> & { paciente_id: Id; dente: number; procedimento: string }) => clinica<ItemOdontograma>('salvarItemOdontograma', { item });
export const removerItemOdontograma = (id: Id) => clinica<null>('removerItemOdontograma', { id });
export const adicionarEvolucao = (id: Id, texto: string, extras: { profissional_id?: Id | null; agendamento_id?: Id | null; corrige_id?: Id | null } = {}) => clinica<Evolucao>('adicionarEvolucao', { id, texto, ...extras });
export const urlAnexo = (id: Id) => clinica<{ url: string }>('urlAnexo', { id });
export const removerAnexo = (id: Id) => clinica<null>('removerAnexo', { id });
export type { Anexo };

export const salvarOrcamento = (orcamento: { id?: Id; paciente_id: Id; titulo?: string; desconto?: number; observacao?: string; validade?: DataCivil | null; itens: OrcamentoItem[] }) => clinica<Orcamento>('salvarOrcamento', { orcamento });
export const decidirOrcamento = (id: Id, status: StatusOrcamento) => clinica<Orcamento>('decidirOrcamento', { id, status });
export const excluirOrcamento = (id: Id) => clinica<null>('excluirOrcamento', { id });
export const criarRetorno = (paciente_id: Id, motivo: string, previsto_para: DataCivil) => clinica<Retorno>('criarRetorno', { paciente_id, motivo, previsto_para });
export const atualizarRetorno = (id: Id, status: StatusRetorno, agendamento_id?: Id | null) => clinica<Retorno>('atualizarRetorno', { id, status, agendamento_id });
export const financeiroResumo = (inicio: DataCivil, fim: DataCivil) => clinica<FinanceiroResumo>('financeiroResumo', { inicio, fim });

export const listarModelos = () => clinica<ContratoModelo[]>('listarModelos');
export const salvarModelo = (modelo: Partial<ContratoModelo>) => clinica<ContratoModelo>('salvarModelo', { modelo });
export const excluirModelo = (id: Id) => clinica<null>('excluirModelo', { id });
export const gerarContrato = (entrada: { paciente_id: Id; modelo_id?: Id | null; titulo?: string; conteudo?: string; variaveis?: Record<string, string> }) => clinica<Contrato>('gerarContrato', { ...entrada });
export const enviarContrato = (id: Id) => clinica<Contrato & { link: string }>('enviarContrato', { id });
export const cancelarContrato = (id: Id) => clinica<Contrato>('cancelarContrato', { id });
export const urlContrato = (id: Id, assinado = false) => clinica<{ url: string }>('urlContrato', { id, assinado });

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
