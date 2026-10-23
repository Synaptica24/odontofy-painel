/** Datas ISO 8601 com offset; datas civis YYYY-MM-DD em America/Sao_Paulo. */
export type Id = string;
export type DataHora = string;
export type DataCivil = string;
export type Json = string | number | boolean | null | Json[] | { [chave: string]: Json };
export type OrigemPaciente = 'whatsapp' | 'site' | 'campanha' | 'indicacao';
export type StatusPaciente = 'novo' | 'em_conversa' | 'agendado' | 'paciente' | 'fora_da_base';
export type StatusConversa = 'ativa' | 'escalada' | 'assumida' | 'encerrada';
export type DirecaoMensagem = 'entrada' | 'saida';
export type AutorMensagem = 'paciente' | 'agente' | 'dentista';
export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'documento';
export type StatusAgendamento = 'sugerido' | 'confirmado' | 'cancelado' | 'faltou';
export type OrigemAgendamento = 'agente' | 'painel';
export type StatusCampanhaEnvio = 'fila' | 'enviada' | 'respondida' | 'erro' | 'bloqueada';
/** Catálogo configurável: os tipos reais ainda dependem do dono. */
export type TipoAtendimento = string;
export interface Paciente {
  /** Presente em listarPacientes; demais retratos podem omitir a contagem. */
  contagem_conversas?: number;
  id: Id; nome: string; telefone_e164: string; origem: OrigemPaciente;
  codental_id: string | null; primeiro_contato: DataHora; ultimo_contato: DataHora;
  status: StatusPaciente; observacoes: string; nao_perturbe: boolean;
}
export interface Conversa {
  id: Id; paciente_id: Id; iniciada_em: DataHora; encerrada_em: DataHora | null;
  status: StatusConversa; motivo_escalonamento: string | null; resumo_gerado: string | null;
  agente_pausado_ate: DataHora | null; urgente: boolean;
}
export interface Mensagem {
  id: Id; conversa_id: Id; direcao: DirecaoMensagem; autor: AutorMensagem; texto: string;
  tipo: TipoMensagem; transcricao: string | null; midia_url: string | null;
  wa_message_id: string | null; criada_em: DataHora;
}
export interface Agendamento {
  id: Id; paciente_id: Id; tipo: TipoAtendimento; inicio: DataHora; fim: DataHora;
  status: StatusAgendamento; confirmado_em: DataHora | null;
  origem: OrigemAgendamento; observacao: string; paciente_novo: boolean;
  campanha_envio_id: Id | null;
}
export interface Bloqueio { id: Id; inicio: DataHora; fim: DataHora }
export type AgendamentoComPaciente = Agendamento & { paciente: Paciente };
export interface ResumoDoDia {
  data: DataCivil; escaladas: ResumoConversa[]; agenda: AgendamentoComPaciente[]; bloqueios: Bloqueio[];
  contatos_novos_24h: number; mensagens_ia_hoje: number;
  pacientes_novos_semana: number; teto_pacientes_novos_semana: number;
}
export interface CampanhaEnvio {
  id: Id; paciente_id: Id; leva: number; enviada_em: DataHora | null;
  status: StatusCampanhaEnvio; respondida_em: DataHora | null; erro: string | null;
}
export interface ItemConhecimento {
  id: Id; pergunta: string; resposta: string; palavras_chave: string[]; ativo: boolean;
}
export type EntradaConhecimento = Omit<ItemConhecimento, 'id'> & { id?: Id };
/** Texto configurável; o brief não enumera gatilhos nem ações. */
export interface RegraEscalonamento { id: Id; gatilho: string; acao: string; ativo: boolean }
export interface Evento { id: Id; tipo: string; payload: Json; criado_em: DataHora }
export type DiaSemana = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';
export interface FaixaHorario { inicio: string; fim: string }
export interface Config {
  fuso_horario: 'America/Sao_Paulo';
  horarios_atendimento: Record<DiaSemana, FaixaHorario[]>;
  duracoes_por_tipo: Record<TipoAtendimento, number>;
  teto_pacientes_novos_semana: number;
  antecedencia_minima_minutos: number;
  confirmacao_ativa: boolean;
  confirmacao_antecedencia_horas: number;
  confirmacao_horario: string;
  pausa_agente_minutos: number;
  agente_ativo: boolean;
  agenda_ativa: boolean;
  campanha_pausada: boolean;
  canal_urgencia: { tipo: 'nao_configurado' | 'whatsapp' | 'email'; destino: string };
  teto_gasto_ia_brl: number;
  consumo_fonte: string;
  cambio_fonte: string;
  cambio_usd_brl: number;
}
/** Padrões técnicos seguros, NÃO valores operacionais aprovados. Zero/vazio = não configurado. */
export const CONFIG_PADRAO: Readonly<Config> = {
  fuso_horario: 'America/Sao_Paulo',
  horarios_atendimento: { segunda: [], terca: [], quarta: [], quinta: [], sexta: [], sabado: [], domingo: [] },
  duracoes_por_tipo: {}, teto_pacientes_novos_semana: 0, antecedencia_minima_minutos: 0,
  confirmacao_ativa: false, confirmacao_antecedencia_horas: 0, confirmacao_horario: '',
  pausa_agente_minutos: 30, agente_ativo: false, agenda_ativa: false, campanha_pausada: true,
  canal_urgencia: { tipo: 'nao_configurado', destino: '' }, teto_gasto_ia_brl: 0,
  consumo_fonte: '', cambio_fonte: '', cambio_usd_brl: 0,
};
export type CodigoErro = 'nao_encontrado' | 'validacao' | 'nao_autorizado' | 'conflito' | 'indisponivel';
export interface ErroApi { codigo: CodigoErro; mensagem: string }
export type ResultadoApi<T> = { sucesso: true; dados: T; erro: null } | { sucesso: false; dados: null; erro: ErroApi };
export interface FiltroConversas {
  status?: StatusConversa | 'todas'; busca?: string; paciente_id?: Id;
  urgente?: boolean; limite?: number; deslocamento?: number;
}
export interface FiltroAgenda { status?: StatusAgendamento; paciente_id?: Id }
export interface ResumoConversa extends Conversa { paciente: Paciente; ultima_mensagem: Mensagem | null }
export interface DetalheConversa { conversa: Conversa; paciente: Paciente; mensagens: Mensagem[] }
export interface DetalhePaciente { paciente: Paciente; conversas: Conversa[]; agendamentos: Agendamento[] }
export interface ResultadoAgenda {
  inicio: DataCivil; fim_exclusivo: DataCivil; agendamentos: AgendamentoComPaciente[]; bloqueios: Bloqueio[];
  pacientes_novos_semana: number; teto_pacientes_novos_semana: number;
}
export interface ResultadoStatusCampanha {
  pausada: boolean; total: number; fila: number; enviadas: number; respondidas: number;
  agendadas: number; erro: number; bloqueadas: number; envios: CampanhaEnvio[];
}
export interface ResultadoConsumoDoMes {
  mes: string; gasto_usd: number | null; gasto_brl: number | null; teto_brl: number;
  cambio_usd_brl: number | null; fonte_consumo: string; fonte_cambio: string;
  atualizado_em: DataHora | null; status: 'disponivel' | 'nao_configurado';
}
export type CancelarInscricao = () => void;
/** Cada notificação contém o retrato completo atualizado, inclusive na inscrição inicial. */
export type CallbackConversas = (resultado: ResultadoApi<ResumoConversa[]>) => void;
export type CallbackMensagens = (resultado: ResultadoApi<Mensagem[]>) => void;
