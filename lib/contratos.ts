/** Datas ISO 8601 com offset; datas civis YYYY-MM-DD em America/Sao_Paulo. */
export type Id = string;
export type DataHora = string;
export type DataCivil = string;
export type Json = string | number | boolean | null | Json[] | { [chave: string]: Json };
export type OrigemPaciente = 'whatsapp' | 'site' | 'campanha' | 'indicacao' | 'codental';
export type StatusPaciente = 'novo' | 'em_conversa' | 'agendado' | 'paciente' | 'fora_da_base';
export type StatusConversa = 'ativa' | 'escalada' | 'assumida' | 'encerrada';
export type DirecaoMensagem = 'entrada' | 'saida';
export type AutorMensagem = 'paciente' | 'agente' | 'dentista';
export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'documento';
export type StatusAgendamento = 'sugerido' | 'agendado' | 'confirmado' | 'cancelado' | 'faltou' | 'concluido';
export type OrigemAgendamento = 'agente' | 'painel';
export type StatusCampanhaEnvio = 'fila' | 'enviada' | 'respondida' | 'erro' | 'bloqueada';
/** Catálogo configurável: os tipos reais ainda dependem do dono. */
export type TipoAtendimento = string;
export interface Paciente {
  /** Presente em listarPacientes; demais retratos podem omitir a contagem. */
  contagem_conversas?: number;
  /** Null quando o cadastro não tem celular próprio (importação do Codental); veja telefone_contato. */
  id: Id; nome: string; telefone_e164: string | null; origem: OrigemPaciente;
  codental_id: string | null; primeiro_contato: DataHora; ultimo_contato: DataHora;
  status: StatusPaciente; observacoes: string; nao_perturbe: boolean;
  /** Cadastro clínico (multi-consultório). */
  consultorio_id?: Id; cpf?: string; nascimento?: DataCivil | null; email?: string; endereco?: string;
  convenio_id?: Id | null; numero_carteirinha?: string; convenio?: Convenio | null;
  proximo_agendamento?: Agendamento | null;
  /** Cadastro importado do Codental (migração 202610240001); só leitura no painel por enquanto. */
  telefone_contato?: string; telefone_fixo?: string; sexo?: '' | 'masculino' | 'feminino' | 'outro'; rg?: string; profissao?: string;
  cep?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string;
  responsavel_nome?: string; responsavel_nascimento?: DataCivil | null; responsavel_documento?: string;
  emergencia_nome?: string; emergencia_telefone?: string; como_conheceu?: string;
  convenio_titular?: string; convenio_titular_cpf?: string; codental_numero?: string;
  ultimo_agendamento_codental?: DataHora | null; atualizado_em?: DataHora;
}
export interface Consultorio { id: Id; nome: string; demo: boolean; papel: string; ativo: boolean }
export interface Profissional { id: Id; consultorio_id: Id; nome: string; cro: string; cor: string; user_id: Id | null; ativo: boolean; ordem: number }
export interface Convenio { id: Id; consultorio_id: Id; nome: string; cor: string; ativo: boolean }
export interface Anamnese {
  paciente_id: Id; alergias: string; medicamentos: string; doencas: string; gestante: boolean; fumante: boolean; diabetes: boolean;
  hipertensao: boolean; cardiopatia: boolean; anticoagulante: boolean; cirurgias: string; queixa_principal: string; observacoes: string;
  atualizado_em: DataHora;
}
export type FaceDente = 'todas' | 'V' | 'L' | 'M' | 'D' | 'O' | 'I' | 'P';
export type StatusOdontograma = 'existente' | 'planejado' | 'realizado';
export interface ItemOdontograma {
  id: Id; paciente_id: Id; dente: number; face: FaceDente; procedimento: string; status: StatusOdontograma; observacao: string; valor: number;
  profissional_id: Id | null; registrado_em: DataHora; realizado_em: DataHora | null;
}
export interface Evolucao {
  id: Id; paciente_id: Id; profissional_id: Id | null; profissional?: string | null; agendamento_id: Id | null; texto: string;
  corrige_id: Id | null; criado_em: DataHora; criado_por: Id | null;
}
export type CategoriaAnexo = 'raio_x' | 'foto' | 'documento' | 'exame' | 'outro';
export interface Anexo {
  id: Id; paciente_id: Id; nome: string; tipo_mime: string; categoria: CategoriaAnexo; caminho: string; tamanho: number; descricao: string; criado_em: DataHora;
}
export type StatusOrcamento = 'pendente' | 'aprovado' | 'recusado';
export interface OrcamentoItem { id?: Id; descricao: string; dente: number | null; quantidade: number; valor_unitario: number; ordem?: number }
export interface Orcamento {
  id: Id; paciente_id: Id; titulo: string; status: StatusOrcamento; desconto: number; observacao: string; validade: DataCivil | null;
  decidido_em: DataHora | null; criado_em: DataHora; itens: OrcamentoItem[]; total: number; paciente?: { id: Id; nome: string };
}
export type StatusRetorno = 'pendente' | 'contatado' | 'agendado' | 'descartado';
export interface Retorno {
  id: Id; paciente_id: Id; motivo: string; previsto_para: DataCivil; status: StatusRetorno; contatado_em: DataHora | null;
  agendamento_id: Id | null; criado_em: DataHora; paciente?: { id: Id; nome: string; telefone_e164: string };
}
export interface ContratoModelo { id: Id; nome: string; conteudo: string; ativo: boolean; criado_em: DataHora; atualizado_em: DataHora }
export type StatusContrato = 'rascunho' | 'enviado' | 'assinado' | 'cancelado';
export interface AssinaturaContrato { nome: string; cpf: string; ip: string; user_agent: string; assinado_em: DataHora; hash_documento: string }
export interface Contrato {
  id: Id; paciente_id: Id; modelo_id: Id | null; titulo: string; conteudo: string; variaveis: Record<string, string>; status: StatusContrato;
  token_expira_em: DataHora | null; pdf_caminho: string | null; pdf_assinado_caminho: string | null; assinatura: AssinaturaContrato | null;
  assinado_em: DataHora | null; provedor: 'interno' | 'zapsign' | 'clicksign'; criado_em: DataHora;
}
export interface AcessoProntuario { id: Id; paciente_id: Id; user_id: Id | null; acao: string; detalhe: string; ip: string; criado_em: DataHora }
export interface Prontuario {
  paciente: Paciente; anamnese: Anamnese | null; odontograma: ItemOdontograma[]; evolucoes: Evolucao[]; anexos: Anexo[];
  orcamentos: Orcamento[]; contratos: Contrato[]; agendamentos: (Agendamento & { profissional?: string | null })[]; retornos: Retorno[]; acessos: AcessoProntuario[];
}
export interface FinanceiroResumo {
  periodo: { inicio: DataCivil; fim: DataCivil }; previsto: number; realizado: number; faltas: number; consultas: number;
  orcamentos: { pendentes: number; aprovados: number; recusados: number; valor_pendente: number; valor_aprovado: number };
  lista_orcamentos: Orcamento[];
  faltas_lista: { id: Id; inicio: DataHora; tipo: string; paciente: { id: Id; nome: string; telefone_e164: string } }[];
  confirmacoes: { id: Id; inicio: DataHora; tipo: string; status: StatusAgendamento; confirmacao_enviada_em: DataHora | null; paciente: { id: Id; nome: string; telefone_e164: string } }[];
  retornos: Retorno[];
}
export interface NovoAgendamento {
  paciente_id: Id; tipo: string; inicio: DataHora; duracao_min: number; profissional_id?: Id | null; convenio_id?: Id | null;
  observacao?: string; valor?: number; status?: 'agendado' | 'confirmado';
}
export type DadosPaciente = Partial<Pick<Paciente, 'nome' | 'telefone_e164' | 'origem' | 'cpf' | 'nascimento' | 'email' | 'endereco' | 'convenio_id' | 'numero_carteirinha' | 'observacoes' | 'nao_perturbe'
  | 'telefone_contato' | 'telefone_fixo' | 'sexo' | 'rg' | 'profissao' | 'cep' | 'complemento' | 'bairro' | 'cidade' | 'estado'
  | 'responsavel_nome' | 'responsavel_nascimento' | 'responsavel_documento' | 'emergencia_nome' | 'emergencia_telefone' | 'como_conheceu' | 'convenio_titular' | 'convenio_titular_cpf'>>;
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
  profissional_id?: Id | null; convenio_id?: Id | null; valor?: number; confirmacao_enviada_em?: DataHora | null;
}
export interface Bloqueio { id: Id; inicio: DataHora; fim: DataHora; profissional_id?: Id | null; motivo?: string }
export type AgendamentoComPaciente = Agendamento & { paciente: Paciente; profissional?: Profissional | null; convenio?: Convenio | null };
export interface ResumoDoDia {
  data: DataCivil; escaladas: ResumoConversa[]; agenda: AgendamentoComPaciente[]; bloqueios: Bloqueio[];
  contatos_novos_24h: number; mensagens_ia_hoje: number;
  pacientes_novos_semana: number; teto_pacientes_novos_semana: number;
  faturamento_previsto?: number; faturamento_realizado?: number;
  comparecimento_30d?: { compareceram: number; faltaram: number; total: number };
  confirmacoes_pendentes?: number; retornos_pendentes?: number;
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
  profissionais?: Profissional[]; convenios?: Convenio[];
}
export interface FiltroAgendaCompleto extends FiltroAgenda { profissional_id?: Id }
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
