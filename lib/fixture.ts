/** Fase 1: memória local, sem rede, persistência ou integração com Supabase/WhatsApp. */
import { CONFIG_PADRAO } from './contratos';
import type {
  Agendamento, Bloqueio, CallbackConversas, CallbackMensagens, CancelarInscricao,
  CampanhaEnvio, CodigoErro, Config, DataCivil, DataHora, DetalheConversa, DetalhePaciente,
  EntradaConhecimento, Evento, FiltroAgenda, FiltroConversas, Id, ItemConhecimento,
  Mensagem, Paciente, Conversa, ResultadoAgenda, ResultadoApi, ResultadoConsumoDoMes,
  ResultadoStatusCampanha, ResumoConversa, ResumoDoDia,
} from './contratos';

export const FIXTURE_ATIVA = true;
const copiar = <T>(valor: T): T => structuredClone(valor);
const sucesso = <T>(dados: T): ResultadoApi<T> => ({ sucesso: true, dados: copiar(dados), erro: null });
const falha = <T>(codigo: CodigoErro, mensagem: string): ResultadoApi<T> => ({ sucesso: false, dados: null, erro: { codigo, mensagem } });
const esperar = () => new Promise<void>((resolve) => setTimeout(resolve, 250));
const agora = () => new Date().toISOString();
let sequencia = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++sequencia).padStart(12, '0')}`;
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const instanteInicial = Date.now();
const dataInicial = hoje();
const relativo = (minutos: number) => new Date(instanteInicial + minutos * 60000).toISOString();
const deslocarDia = (data: DataCivil, dias: number) => new Date(Date.parse(`${data}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
const segunda = deslocarDia(dataInicial, -((new Date(`${dataInicial}T12:00:00Z`).getUTCDay() + 6) % 7));
const horario = (data: DataCivil, hora: string) => `${data}T${hora}:00-03:00`;
const pacientes: Paciente[] = Array.from({ length: 12 }, (_, i) => ({
  id: novoId(), nome: `Paciente Teste ${String(i + 1).padStart(2, '0')}`,
  telefone_e164: `+551190000${String(i + 1).padStart(4, '0')}`,
  origem: (['whatsapp', 'site', 'campanha', 'indicacao'] as const)[i % 4],
  codental_id: null, primeiro_contato: relativo(i < 3 ? -60 : -(i + 2) * 1440),
  ultimo_contato: relativo(-i),
  status: (['em_conversa', 'novo', 'agendado', 'paciente', 'fora_da_base'] as const)[i % 5],
  observacoes: 'TESTE: cadastro fictício para demonstração do consultório.', nao_perturbe: i === 11,
}));
const conversas: Conversa[] = (['escalada', 'escalada', 'ativa', 'ativa', 'assumida', 'encerrada'] as const).map((status, i) => ({
  id: novoId(), paciente_id: pacientes[i].id, iniciada_em: relativo(-48 + i),
  encerrada_em: status === 'encerrada' ? relativo(-1) : null, status,
  motivo_escalonamento: i === 0 ? 'Dor forte, pediu pra falar com você' : i === 1 ? 'TESTE: pediu orientação sobre convênio com o dentista.' : null,
  resumo_gerado: status === 'encerrada' ? 'TESTE: paciente consultou horários e confirmou avaliação. Atendimento encerrado, sem pendências.' : null,
  agente_pausado_ate: status === 'assumida' ? relativo(20) : null, urgente: i === 0,
}));
const roteiros = [
  ['Olá, estou com dor forte.', 'Vou registrar seu pedido para o dentista.', 'Começou hoje e quero falar com ele.', 'Vou sinalizar a urgência do seu contato.', 'Posso enviar um áudio?', 'Pode enviar sua mensagem.', 'Dói bastante, pode pedir para ele falar comigo?', 'Pedido encaminhado ao dentista.'],
  ['Vocês atendem por convênio?', 'A cobertura precisa ser conferida com a equipe.', 'Tenho dúvidas sobre a autorização.', 'Você gostaria de falar com o dentista?', 'Sim, antes de marcar.', 'Vou encaminhar sua dúvida.', 'Obrigada, aguardo o retorno.', 'Seu pedido está aguardando atendimento humano.'],
  ['Quero marcar uma limpeza.', 'Tem preferência de horário?', 'Prefiro de manhã.', 'A limpeza tem duração prevista de 45 minutos.', 'E quanto custa?', 'Sobre o valor, consulte a equipe do consultório.', 'Pode sugerir um horário?', 'Deixei uma sugestão para confirmação na agenda.'],
  ['Gostaria de uma avaliação.', 'Você prefere manhã ou tarde?', 'À tarde, por favor.', 'A avaliação tem duração prevista de 30 minutos.', 'Há estacionamento?', 'Neste exemplo, há estacionamento próximo; consulte a equipe.', 'Certo, pode confirmar.', 'Sua avaliação foi confirmada na agenda de teste.'],
  ['Preciso remarcar minha consulta.', 'Qual período fica melhor?', 'Na parte da tarde.', 'Vou pedir ajuda ao dentista para ajustar.', 'Vou enviar a imagem do cartão de teste.', 'Pode enviar; vou registrar aqui.', 'Pode me atender pessoalmente?', 'O dentista assumiu a conversa para combinar o horário.'],
  ['Quero confirmar minha avaliação.', 'Vou conferir o horário reservado.', 'Será no consultório?', 'Sim, a consulta deste exemplo é presencial.', 'Tudo certo com a reserva?', 'Sim, avaliação confirmada.', 'Obrigada pela ajuda.', 'Atendimento de teste encerrado. Até a consulta!'],
];
// Retratos de oito mensagens por conversa; o indicador diário também inclui atividade histórica de teste.
const inicioDoDia = Date.parse(horario(dataInicial, '00:00'));
const mensagens: Mensagem[] = conversas.flatMap((conversa, i) => roteiros[i].map((texto, j) => {
  const audio = i === 0 && j === 6, imagem = i === 4 && j === 4;
  return {
    id: novoId(), conversa_id: conversa.id, direcao: j % 2 ? 'saida' : 'entrada',
    autor: j % 2 ? 'agente' : 'paciente', texto: `[TESTE] ${texto}`,
    tipo: audio ? 'audio' : imagem ? 'imagem' : 'texto',
    transcricao: audio ? `[TESTE] ${texto}` : null,
    midia_url: imagem ? `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160"><rect width="320" height="160" fill="#e2e8f0"/><text x="25" y="85" font-size="22">CARTÃO DE TESTE</text></svg>')}` : null,
    wa_message_id: `TESTE-${i + 1}-${j + 1}`,
    criada_em: new Date(Math.max(inicioDoDia, instanteInicial - (48 - i * 8 - j) * 60000)).toISOString(),
  };
}));
const mensagensIaHistoricasHoje = 17;
const envios: CampanhaEnvio[] = Array.from({ length: 40 }, (_, i) => {
  // Em cada leva: 9 na fila, 6 enviadas, 3 respondidas, 1 erro e 1 bloqueada.
  const posicao = i % 20;
  const status = posicao < 9 ? 'fila' : posicao < 15 ? 'enviada' : posicao < 18 ? 'respondida' : posicao === 18 ? 'erro' : 'bloqueada';
  return { id: novoId(), paciente_id: pacientes[status === 'bloqueada' ? 11 : i % 11].id,
    leva: Math.floor(i / 20) + 1, status,
    enviada_em: status === 'enviada' || status === 'respondida' ? relativo(-2880 + Math.floor(i / 20) * 1440) : null,
    respondida_em: status === 'respondida' ? relativo(-120) : null,
    erro: status === 'erro' ? 'TESTE: falha simulada de entrega.' : null };
});
const respondidos = envios.filter((envio) => envio.status === 'respondida');
const outrosDias = Array.from({ length: 6 }, (_, i) => deslocarDia(segunda, i)).filter((dia) => dia !== dataInicial);
const agendamentos: Agendamento[] = Array.from({ length: 10 }, (_, i) => {
  const dia = i < 4 ? dataInicial : outrosDias[(i - 4) % outrosDias.length];
  const hora = i < 4 ? ['08:00', '10:00', '14:00', '15:00'][i] : i === 9 ? '10:00' : '08:00';
  const tipo = (['Avaliação', 'Limpeza', 'Canal', 'Restauração'] as const)[i % 4];
  const duracao = { 'Avaliação': 30, Limpeza: 45, Canal: 90, 'Restauração': 60 }[tipo];
  const status = i === 1 ? 'sugerido' : i === 7 ? 'faltou' : i === 8 ? 'cancelado' : 'confirmado';
  const envio = i >= 4 && i <= 6 ? respondidos[i - 4] : null;
  // O primeiro atendimento já passou; antes das 08h, usa o início do dia para a demonstração.
  const inicio = i === 0 && instanteInicial < Date.parse(horario(dia, '08:30'))
    ? new Date(Math.max(inicioDoDia, instanteInicial - 31 * 60000)).toISOString() : horario(dia, hora);
  return { id: novoId(), paciente_id: envio?.paciente_id ?? pacientes[i === 1 ? 2 : i].id,
    tipo, inicio, fim: new Date(Date.parse(inicio) + duracao * 60000).toISOString(), status,
    confirmado_em: status === 'sugerido' ? null : relativo(-180),
    origem: i === 3 ? 'painel' : 'agente',
    observacao: i === 0 ? 'TESTE: atendimento anterior ao horário atual.' : 'TESTE: reserva fictícia para visualizar a agenda.',
    paciente_novo: [1, 2, 3].includes(i), campanha_envio_id: envio?.id ?? null };
});
const bloqueios: Bloqueio[] = [
  { id: novoId(), inicio: horario(dataInicial, '12:00'), fim: horario(dataInicial, '14:00') },
  { id: novoId(), inicio: horario(outrosDias[0], '11:00'), fim: horario(outrosDias[0], '12:00') },
];
const conhecimento: ItemConhecimento[] = [
  { pergunta: 'Vocês atendem convênio?', resposta: 'Consulte a equipe para verificar convênios e cobertura antes de agendar.', palavras_chave: ['convênio', 'plano', 'cobertura'] },
  { pergunta: 'Qual o valor da limpeza?', resposta: 'Valor da limpeza: consulte a equipe do consultório.', palavras_chave: ['limpeza', 'valor', 'preço'] },
  { pergunta: 'Há estacionamento?', resposta: 'Neste consultório fictício, há estacionamento próximo. Consulte disponibilidade e valores.', palavras_chave: ['estacionamento', 'carro', 'vaga'] },
  { pergunta: 'Qual o horário de atendimento?', resposta: 'Segunda a sexta, 08:00–12:00 e 14:00–18:00; sábado, 08:00–12:00.', palavras_chave: ['horário', 'sábado', 'atendimento'] },
  { pergunta: 'Como agendar tratamento de canal?', resposta: 'Agende uma avaliação com o dentista para definir o tratamento e as sessões necessárias.', palavras_chave: ['canal', 'endodontia', 'tratamento'] },
  { pergunta: 'Vocês fazem clareamento?', resposta: 'Consulte o dentista para avaliar a indicação e as opções de clareamento.', palavras_chave: ['clareamento', 'estética', 'dentes'] },
  { pergunta: 'Como solicitar atendimento de emergência?', resposta: 'Avise a equipe pelo WhatsApp de teste +55 11 90000-0000 para solicitar contato do dentista.', palavras_chave: ['emergência', 'urgência', 'dor'] },
  { pergunta: 'Qual é o endereço?', resposta: 'Endereço fictício: Rua de Teste, 000, Consultório Demonstração, São Paulo. Não se dirija a este endereço.', palavras_chave: ['endereço', 'localização', 'chegar'] },
].map((item, i) => ({ ...item, id: novoId(), resposta: `[TESTE] ${item.resposta}`, ativo: i !== 5 }));
const turnoCompleto = [{ inicio: '08:00', fim: '12:00' }, { inicio: '14:00', fim: '18:00' }];
let config: Config = copiar({ ...CONFIG_PADRAO,
  horarios_atendimento: { segunda: turnoCompleto, terca: turnoCompleto, quarta: turnoCompleto, quinta: turnoCompleto, sexta: turnoCompleto, sabado: [{ inicio: '08:00', fim: '12:00' }], domingo: [] },
  duracoes_por_tipo: { Limpeza: 45, 'Avaliação': 30, Canal: 90, 'Restauração': 60 },
  teto_pacientes_novos_semana: 5, antecedencia_minima_minutos: 120,
  confirmacao_ativa: true, confirmacao_antecedencia_horas: 24, confirmacao_horario: '09:00',
  pausa_agente_minutos: 30, agente_ativo: true, agenda_ativa: true, campanha_pausada: false,
  canal_urgencia: { tipo: 'whatsapp', destino: '+5511900000000' }, teto_gasto_ia_brl: 300,
  consumo_fonte: 'teste', cambio_fonte: 'teste', cambio_usd_brl: 5.20,
});
const eventos: Evento[] = [];
const ouvintesConversas = new Set<CallbackConversas>();
const ouvintesMensagens = new Map<Id, Set<CallbackMensagens>>();
const resumos = (): ResumoConversa[] => conversas.map((conversa) => ({
  ...conversa, paciente: pacientes.find((p) => p.id === conversa.paciente_id)!,
  ultima_mensagem: mensagens.filter((m) => m.conversa_id === conversa.id).at(-1) ?? null,
}));
// Erros do consumidor não devem converter uma mutação concluída em erro nem gerar logs.
function entregar<T>(cb: (valor: ResultadoApi<T>) => void, valor: ResultadoApi<T>): void {
  try { cb(copiar(valor)); } catch { /* Callback pertence ao consumidor. */ }
}
function notificar(conversaId?: Id): void {
  ouvintesConversas.forEach((cb) => entregar(cb, sucesso(resumos())));
  if (conversaId) ouvintesMensagens.get(conversaId)?.forEach((cb) => entregar(cb, sucesso(mensagens.filter((m) => m.conversa_id === conversaId))));
}
function auditar(tipo: string, id: string): void {
  eventos.push({ id: novoId(), tipo, payload: { referencia: id, fixture: true }, criado_em: agora() });
}
const dataValida = (data: string) => /^\d{4}-\d{2}-\d{2}$/.test(data) && Number.isFinite(Date.parse(data)) && new Date(data).toISOString().slice(0, 10) === data;
const instanteValido = (data: string) => /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data) && Number.isFinite(Date.parse(data));
const somarDias = (data: string, dias: number) => new Date(Date.parse(`${data}T12:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);

// STUB
export async function listarConversas(filtro: FiltroConversas = {}): Promise<ResultadoApi<ResumoConversa[]>> {
  await esperar();
  const { limite = 50, deslocamento = 0 } = filtro;
  if (!Number.isInteger(limite) || limite < 1 || limite > 100 || !Number.isInteger(deslocamento) || deslocamento < 0) return falha('validacao', 'Informe um limite entre 1 e 100 e um deslocamento válido.');
  const busca = filtro.busca?.toLocaleLowerCase('pt-BR');
  return sucesso(resumos().filter((c) => (!filtro.status || filtro.status === 'todas' || c.status === filtro.status)
    && (!filtro.paciente_id || c.paciente_id === filtro.paciente_id) && (filtro.urgente === undefined || c.urgente === filtro.urgente)
    && (!busca || c.paciente.nome.toLocaleLowerCase('pt-BR').includes(busca) || c.paciente.telefone_e164.includes(busca)))
    .sort((a, b) => Date.parse(b.ultima_mensagem?.criada_em ?? b.iniciada_em) - Date.parse(a.ultima_mensagem?.criada_em ?? a.iniciada_em))
    .slice(deslocamento, deslocamento + limite));
}
// STUB
export async function abrirConversa(id: Id): Promise<ResultadoApi<DetalheConversa>> {
  await esperar();
  const conversa = conversas.find((c) => c.id === id);
  if (!conversa) return falha('nao_encontrado', 'Conversa não encontrada. Atualize a lista.');
  return sucesso({ conversa, paciente: pacientes.find((p) => p.id === conversa.paciente_id)!, mensagens: mensagens.filter((m) => m.conversa_id === id) });
}
// STUB
export async function assumirConversa(conversaId: Id, ate?: DataHora): Promise<ResultadoApi<Conversa>> {
  await esperar();
  const conversa = conversas.find((c) => c.id === conversaId);
  if (!conversa) return falha('nao_encontrado', 'Conversa não encontrada. Atualize a lista.');
  if (conversa.status === 'encerrada') return falha('conflito', 'Esta conversa já foi encerrada.');
  const prazo = ate ?? new Date(Date.now() + config.pausa_agente_minutos * 60000).toISOString();
  if (!instanteValido(prazo) || Date.parse(prazo) <= Date.now()) return falha('validacao', 'Escolha um prazo futuro para a pausa.');
  conversa.status = 'assumida'; conversa.agente_pausado_ate = prazo;
  notificar(); return sucesso(conversa);
}
// STUB
export async function devolverParaIA(conversaId: Id): Promise<ResultadoApi<Conversa>> {
  await esperar();
  const conversa = conversas.find((c) => c.id === conversaId);
  if (!conversa) return falha('nao_encontrado', 'Conversa não encontrada. Atualize a lista.');
  if (conversa.status === 'encerrada') return falha('conflito', 'Esta conversa já foi encerrada.');
  conversa.status = 'ativa'; conversa.agente_pausado_ate = null; conversa.urgente = false; conversa.motivo_escalonamento = null;
  notificar(); return sucesso(conversa);
}
// STUB: não envia nada ao WhatsApp ou n8n.
export async function enviarMensagem(conversaId: Id, texto: string): Promise<ResultadoApi<Mensagem>> {
  await esperar();
  const conversa = conversas.find((c) => c.id === conversaId);
  if (!conversa) return falha('nao_encontrado', 'Conversa não encontrada. Atualize a lista.');
  if (!texto.trim()) return falha('validacao', 'Escreva uma mensagem antes de enviar.');
  if (conversa.status !== 'assumida' || !conversa.agente_pausado_ate || Date.parse(conversa.agente_pausado_ate) <= Date.now()) return falha('conflito', 'Assuma a conversa antes de enviar uma mensagem.');
  const mensagem: Mensagem = { id: novoId(), conversa_id: conversaId, direcao: 'saida', autor: 'dentista',
    texto: `[TESTE — NÃO ENVIADA] ${texto}`, tipo: 'texto', transcricao: null, midia_url: null, wa_message_id: null, criada_em: agora() };
  mensagens.push(mensagem); pacientes.find((p) => p.id === conversa.paciente_id)!.ultimo_contato = mensagem.criada_em;
  notificar(conversaId); return sucesso(mensagem);
}
// STUB
export async function buscarPaciente(id: Id): Promise<ResultadoApi<DetalhePaciente>> {
  await esperar(); const paciente = pacientes.find((p) => p.id === id);
  return paciente ? sucesso({ paciente, conversas: conversas.filter((c) => c.paciente_id === id), agendamentos: agendamentos.filter((a) => a.paciente_id === id) }) : falha('nao_encontrado', 'Paciente não encontrado. Atualize a lista.');
}
// STUB
export async function salvarObservacao(pacienteId: Id, txt: string): Promise<ResultadoApi<Paciente>> {
  await esperar(); const paciente = pacientes.find((p) => p.id === pacienteId);
  if (!paciente) return falha('nao_encontrado', 'Paciente não encontrado. Atualize a lista.');
  paciente.observacoes = txt; notificar(); return sucesso(paciente);
}
function agenda(inicio: DataCivil, dias: number, filtro: FiltroAgenda): ResultadoApi<ResultadoAgenda> {
  if (!dataValida(inicio)) return falha('validacao', 'Informe uma data válida no formato AAAA-MM-DD.');
  const fim = somarDias(inicio, dias);
  const inicioMs = Date.parse(`${inicio}T00:00:00-03:00`), fimMs = Date.parse(`${fim}T00:00:00-03:00`);
  const diaSemana = new Date(`${inicio}T12:00:00Z`).getUTCDay();
  const segunda = somarDias(inicio, -((diaSemana + 6) % 7));
  const semanaMs = Date.parse(`${segunda}T00:00:00-03:00`);
  return sucesso({ inicio, fim_exclusivo: fim,
    agendamentos: agendamentos.filter((a) => Date.parse(a.inicio) < fimMs && Date.parse(a.fim) > inicioMs && (!filtro.status || a.status === filtro.status) && (!filtro.paciente_id || a.paciente_id === filtro.paciente_id)).map((a) => ({ ...a, paciente: pacientes.find((p) => p.id === a.paciente_id)! })),
    bloqueios: bloqueios.filter((b) => Date.parse(b.inicio) < fimMs && Date.parse(b.fim) > inicioMs),
    pacientes_novos_semana: agendamentos.filter((a) => a.paciente_novo && a.status !== 'cancelado' && Date.parse(a.inicio) >= semanaMs && Date.parse(a.inicio) < semanaMs + 7 * 86400000).length,
    teto_pacientes_novos_semana: config.teto_pacientes_novos_semana });
}
// STUB
export async function agendaDoDia(data: DataCivil, filtro: FiltroAgenda = {}): Promise<ResultadoApi<ResultadoAgenda>> { await esperar(); return agenda(data, 1, filtro); }
// STUB: sete dias a partir de inicio; contador da semana civil que contém inicio.
export async function agendaDaSemana(inicio: DataCivil, filtro: FiltroAgenda = {}): Promise<ResultadoApi<ResultadoAgenda>> { await esperar(); return agenda(inicio, 7, filtro); }
// STUB: validação apenas demonstrativa; na Fase 2 toda regra fica no banco.
export async function criarBloqueio(inicio: DataHora, fim: DataHora): Promise<ResultadoApi<Bloqueio>> {
  await esperar();
  if (!instanteValido(inicio) || !instanteValido(fim) || Date.parse(fim) <= Date.parse(inicio)) return falha('validacao', 'Informe início e fim válidos; o fim deve ser posterior ao início.');
  if ([...bloqueios, ...agendamentos.filter((a) => a.status === 'sugerido' || a.status === 'confirmado')].some((a) => Date.parse(a.inicio) < Date.parse(fim) && Date.parse(a.fim) > Date.parse(inicio))) return falha('conflito', 'Já existe uma reserva nesse intervalo. Escolha outro horário.');
  const bloqueio = { id: novoId(), inicio, fim }; bloqueios.push(bloqueio); return sucesso(bloqueio);
}
// STUB
export async function confirmarSugestao(agendamentoId: Id): Promise<ResultadoApi<Agendamento>> {
  await esperar(); const item = agendamentos.find((a) => a.id === agendamentoId);
  if (!item) return falha('nao_encontrado', 'Agendamento não encontrado. Atualize a agenda.');
  if (item.status !== 'sugerido') return falha('conflito', 'Somente sugestões podem ser confirmadas.');
  item.status = 'confirmado'; item.confirmado_em = agora(); return sucesso(item);
}
// STUB
export async function marcarFalta(agendamentoId: Id): Promise<ResultadoApi<Agendamento>> {
  await esperar(); const item = agendamentos.find((a) => a.id === agendamentoId);
  if (!item) return falha('nao_encontrado', 'Agendamento não encontrado. Atualize a agenda.');
  if (item.status !== 'confirmado') return falha('conflito', 'Somente agendamentos confirmados podem receber falta.');
  item.status = 'faltou'; return sucesso(item);
}
// STUB
export async function listarConhecimento(): Promise<ResultadoApi<ItemConhecimento[]>> { await esperar(); return sucesso(conhecimento); }
// STUB: id ausente cria, id presente atualiza.
export async function salvarConhecimento(entrada: EntradaConhecimento): Promise<ResultadoApi<ItemConhecimento>> {
  await esperar();
  if (!entrada.pergunta.trim() || !entrada.resposta.trim()) return falha('validacao', 'Preencha a pergunta e a resposta antes de salvar.');
  const existente = conhecimento.find((i) => i.id === entrada.id);
  if (entrada.id && !existente) return falha('nao_encontrado', 'Resposta não encontrada. Atualize a lista.');
  const item = { ...copiar(entrada), id: entrada.id ?? novoId() };
  if (existente) Object.assign(existente, item); else conhecimento.push(item);
  auditar('conhecimento_salvo', item.id); return sucesso(item);
}
// STUB: contagens por status atual; agendadas é um subconjunto independente.
export async function statusCampanha(): Promise<ResultadoApi<ResultadoStatusCampanha>> {
  await esperar(); const contar = (status: CampanhaEnvio['status']) => envios.filter((e) => e.status === status).length;
  return sucesso({ pausada: config.campanha_pausada, total: envios.length, fila: contar('fila'), enviadas: contar('enviada'), respondidas: contar('respondida'), erro: contar('erro'), bloqueadas: contar('bloqueada'),
    agendadas: new Set(agendamentos.filter((a) => a.campanha_envio_id && a.status === 'confirmado').map((a) => a.paciente_id)).size, envios });
}
// STUB
export async function pausarCampanha(): Promise<ResultadoApi<Config>> { return salvarConfig({ campanha_pausada: true }); }
// STUB
export async function retomarCampanha(): Promise<ResultadoApi<Config>> { return salvarConfig({ campanha_pausada: false }); }
// STUB
export async function lerConfig(): Promise<ResultadoApi<Config>> { await esperar(); return sucesso(config); }
// STUB: atualização parcial de chaves; objetos/arrays de cada chave são substituídos integralmente.
export async function salvarConfig(alteracoes: Partial<Config>): Promise<ResultadoApi<Config>> {
  await esperar();
  const proxima = { ...config, ...copiar(alteracoes) };
  if (Object.values(proxima).some((v) => v === null || v === undefined) || proxima.fuso_horario !== 'America/Sao_Paulo'
    || [proxima.teto_pacientes_novos_semana, proxima.antecedencia_minima_minutos, proxima.confirmacao_antecedencia_horas].some((n) => !Number.isInteger(n) || n < 0)
    || !Number.isInteger(proxima.pausa_agente_minutos) || proxima.pausa_agente_minutos <= 0
    || [proxima.teto_gasto_ia_brl, proxima.cambio_usd_brl].some((n) => !Number.isFinite(n) || n < 0)) return falha('validacao', 'Revise os ajustes: use valores válidos e não negativos, com pausa maior que zero.');
  config = proxima; auditar('config_salva', Object.keys(alteracoes).join(',')); return sucesso(config);
}
// STUB: valores demonstrativos, sem consulta a provedores externos.
export async function consumoDoMes(): Promise<ResultadoApi<ResultadoConsumoDoMes>> {
  await esperar(); const gastoUsd = 23.40;
  return sucesso({ mes: hoje().slice(0, 7), gasto_usd: gastoUsd, gasto_brl: Number((gastoUsd * config.cambio_usd_brl).toFixed(2)),
    teto_brl: config.teto_gasto_ia_brl, cambio_usd_brl: config.cambio_usd_brl, fonte_consumo: config.consumo_fonte,
    fonte_cambio: config.cambio_fonte, atualizado_em: relativo(-120), status: 'disponivel' });
}
// STUB: entrega inicial após 250 ms e a cada alteração local; cancelar é idempotente.
export function inscreverEmConversas(cb: CallbackConversas): CancelarInscricao {
  const ouvinte: CallbackConversas = (resultado) => cb(resultado);
  ouvintesConversas.add(ouvinte);
  const timer = setTimeout(() => entregar(ouvinte, sucesso(resumos())), 250);
  return () => { clearTimeout(timer); ouvintesConversas.delete(ouvinte); };
}
// STUB
export function inscreverEmMensagens(conversaId: Id, cb: CallbackMensagens): CancelarInscricao {
  const ouvinte: CallbackMensagens = (resultado) => cb(resultado);
  const grupo = ouvintesMensagens.get(conversaId) ?? new Set<CallbackMensagens>();
  grupo.add(ouvinte); ouvintesMensagens.set(conversaId, grupo);
  const timer = setTimeout(() => entregar(ouvinte, conversas.some((c) => c.id === conversaId)
    ? sucesso(mensagens.filter((m) => m.conversa_id === conversaId)) : falha('nao_encontrado', 'Conversa não encontrada. Atualize a lista.')), 250);
  return () => { clearTimeout(timer); grupo.delete(ouvinte); if (!grupo.size) ouvintesMensagens.delete(conversaId); };
}

export async function resumoDoDia(data: DataCivil = hoje()): Promise<ResultadoApi<ResumoDoDia>> {
  await esperar(); const resultado = agenda(data, 1, {});
  if (!resultado.sucesso) return resultado;
  const a = resultado.dados, inicio = Date.parse(`${data}T00:00:00-03:00`);
  return sucesso({ data, escaladas: resumos().filter((c) => c.status === 'escalada'), agenda: a.agendamentos, bloqueios: a.bloqueios,
    contatos_novos_24h: pacientes.filter((p) => Date.parse(p.primeiro_contato) >= Date.now() - 86400000).length,
    mensagens_ia_hoje: (data === dataInicial ? mensagensIaHistoricasHoje : 0) + mensagens.filter((m) => m.autor === 'agente' && Date.parse(m.criada_em) >= inicio && Date.parse(m.criada_em) < inicio + 86400000).length,
    pacientes_novos_semana: a.pacientes_novos_semana, teto_pacientes_novos_semana: a.teto_pacientes_novos_semana });
}
export async function listarPacientes(busca = ''): Promise<ResultadoApi<Paciente[]>> {
  await esperar();
  return sucesso(pacientes.filter((p) => p.nome.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')) || p.telefone_e164.includes(busca))
    .map((p) => ({ ...p, contagem_conversas: conversas.filter((c) => c.paciente_id === p.id).length })));
}
export async function remarcarAgendamento(id: Id, novoInicio: DataHora): Promise<ResultadoApi<Agendamento>> {
  await esperar(); const a = agendamentos.find((item) => item.id === id);
  if (!a) return falha('nao_encontrado', 'Agendamento não encontrado.');
  if (!instanteValido(novoInicio)) return falha('validacao', 'Informe uma data válida.');
  if (!['sugerido', 'confirmado'].includes(a.status)) return falha('conflito', 'Agendamento encerrado.');
  const inicio = Date.parse(novoInicio), fim = inicio + Date.parse(a.fim) - Date.parse(a.inicio);
  if ([...bloqueios, ...agendamentos.filter((outro) => outro.id !== id && ['sugerido','confirmado'].includes(outro.status))].some((outro) => Date.parse(outro.inicio) < fim && Date.parse(outro.fim) > inicio)) return falha('conflito', 'Horário ocupado na demonstração.');
  a.inicio = novoInicio; a.fim = new Date(fim).toISOString(); return sucesso(a);
}
export async function cancelarAgendamento(id: Id): Promise<ResultadoApi<Agendamento>> {
  await esperar(); const a = agendamentos.find((item) => item.id === id);
  if (!a) return falha('nao_encontrado', 'Agendamento não encontrado.');
  if (!['sugerido','confirmado'].includes(a.status)) return falha('conflito', 'Agendamento encerrado.');
  a.status = 'cancelado'; return sucesso(a);
}
export async function excluirConhecimento(id: Id): Promise<ResultadoApi<null>> {
  await esperar(); const indice = conhecimento.findIndex((item) => item.id === id);
  if (indice === -1) return falha('nao_encontrado', 'Resposta não encontrada.');
  conhecimento.splice(indice, 1); auditar('conhecimento_excluido', id); return sucesso(null);
}
export async function alternarConhecimento(id: Id, ativo: boolean): Promise<ResultadoApi<ItemConhecimento>> {
  await esperar(); const item = conhecimento.find((item) => item.id === id);
  if (!item) return falha('nao_encontrado', 'Resposta não encontrada.');
  item.ativo = ativo; auditar('conhecimento_alterado', id); return sucesso(item);
}
