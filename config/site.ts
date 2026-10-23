/**
 * Tudo que é específico do consultório fica aqui.
 * Troque os valores entre colchetes antes de publicar.
 * Nada neste arquivo é inventado: onde não havia dado real, ficou placeholder.
 */

export const site = {
  nome: "Dr. Mateus Peixoto",
  profissao: "Cirurgião-dentista",
  cro: "[CRO]", // ex.: CRO-SP 00000
  cidade: "[CIDADE]",
  bairro: "[BAIRRO]",
  endereco: "[ENDEREÇO]", // Rua, número, complemento
  cep: "[CEP]",
  /** Somente dígitos com DDI, ex.: 5511999999999 */
  whatsapp: "[WHATSAPP]",
  whatsappBonito: "[(DDD) 9 9999-9999]",
  instagram: "[@INSTAGRAM]",
  instagramUrl: "https://instagram.com/[INSTAGRAM]",
  email: "[E-MAIL]",
  /** URL pública definitiva (para Open Graph, sitemap e schema). */
  url: "https://dr-mateus-peixoto.vercel.app",
  /** Link do Google Maps (botão "Como chegar"). */
  mapsUrl: "https://maps.google.com/?q=[ENDEREÇO]",
  /** Fotos: caminhos em /public. Vazio = moldura com rótulo. */
  fotos: {
    doutor: "", // ex.: "/fotos/dr-mateus.jpg" — [FOTO DO DR.]
    consultorio: "", // [FOTO DO CONSULTÓRIO]
    recepcao: "", // [FOTO DA RECEPÇÃO]
  },
  horarios: [
    { dias: "Segunda a sexta", horas: "[08h às 18h]" },
    { dias: "Sábado", horas: "[08h às 12h]" },
    { dias: "Domingo", horas: "Fechado" },
  ],
  /** Mensagem que já vai escrita no WhatsApp. */
  mensagemWhatsApp: "Olá, vim pelo site e quero agendar uma avaliação",
  /** Analytics: vazio = o script não carrega. */
  metaPixelId: "",
  gaId: "",
  /** Prova social curta do hero. Troque por dado real ou deixe vazio para esconder. */
  provaSocial: "[+500 pacientes atendidos] · [4,9 ★ no Google]",
};

export const linkWhatsApp = (mensagem: string = site.mensagemWhatsApp) =>
  `https://wa.me/${site.whatsapp.replace(/\D/g, "") || "0"}?text=${encodeURIComponent(mensagem)}`;

export type Tratamento = {
  slug: string;
  nome: string;
  resumo: string;
  oQueE: string;
  paraQuem: string;
  comoFunciona: string;
  destaque?: boolean;
};

export const tratamentos: Tratamento[] = [
  {
    slug: "avaliacao",
    nome: "Avaliação completa",
    resumo: "O começo de tudo. Exame, fotos e um plano explicado com calma.",
    oQueE: "Uma consulta de até uma hora em que o Dr. Mateus examina cada dente, a gengiva e a mordida, tira fotos e, se precisar, radiografias.",
    paraQuem: "Para quem está há tempo sem ir ao dentista, sente que algo mudou ou só quer saber como está.",
    comoFunciona: "Você conta o que incomoda, ele examina, mostra as fotos na tela e explica o que vale fazer primeiro. Você sai com um plano por escrito e sem compromisso.",
    destaque: true,
  },
  {
    slug: "limpeza",
    nome: "Limpeza e prevenção",
    resumo: "Remove tártaro e manchas. Dente liso, hálito limpo, gengiva sem sangrar.",
    oQueE: "Profilaxia profissional com ultrassom e polimento, mais orientação de escovação feita para a sua boca.",
    paraQuem: "Para todo mundo, a cada seis meses. Principalmente se a gengiva sangra ao escovar.",
    comoFunciona: "Dura cerca de 45 minutos. Não dói; no máximo um incômodo leve em quem tem sensibilidade, que avisamos antes.",
  },
  {
    slug: "clareamento",
    nome: "Clareamento",
    resumo: "Alguns tons mais claro, sem agredir o esmalte.",
    oQueE: "Clareamento feito no consultório ou em casa com moldeira sob medida, sempre com gel de concentração controlada.",
    paraQuem: "Para quem acha o sorriso amarelado e evita rir em foto.",
    comoFunciona: "Primeiro a limpeza, depois o clareamento. No consultório são duas sessões; em casa, duas semanas de uso. O resultado dura anos com manutenção.",
  },
  {
    slug: "restauracao",
    nome: "Restaurações e cáries",
    resumo: "Resina da cor do dente. Ninguém percebe que foi feito.",
    oQueE: "Tratamento de cáries e troca de restaurações antigas (as de metal escuro) por resina estética.",
    paraQuem: "Para quem sente dor com doce ou gelado, ou tem restauração escura à mostra.",
    comoFunciona: "Anestesia local, remoção da cárie e reconstrução em resina na mesma consulta. Você sai mastigando normalmente.",
  },
  {
    slug: "canal",
    nome: "Tratamento de canal",
    resumo: "Acaba com a dor e salva o dente. Sem o terror que você imagina.",
    oQueE: "Remoção do nervo inflamado de dentro do dente, limpeza e selamento do canal.",
    paraQuem: "Para dor forte e contínua, dente que lateja à noite ou inchaço na gengiva.",
    comoFunciona: "Com anestesia bem feita, o canal não dói. A dor some logo na primeira sessão. Em geral são uma ou duas consultas.",
  },
  {
    slug: "implante",
    nome: "Implantes e próteses",
    resumo: "Repor dentes que faltam, com estabilidade para mastigar.",
    oQueE: "Pino de titânio no lugar da raiz e uma coroa de cerâmica por cima. Para vários dentes, próteses fixas sobre implantes.",
    paraQuem: "Para quem perdeu um ou mais dentes e cansou de prótese móvel ou de mastigar de um lado só.",
    comoFunciona: "Avaliação com tomografia, cirurgia rápida sob anestesia local e alguns meses de cicatrização antes da coroa definitiva.",
  },
  {
    slug: "lentes",
    nome: "Lentes e facetas",
    resumo: "Para corrigir forma, cor e pequenos espaços, com naturalidade.",
    oQueE: "Lâminas finas de cerâmica coladas na frente dos dentes, planejadas com fotos e simulação digital.",
    paraQuem: "Para quem tem dentes manchados, desgastados ou desalinhados de leve, e quer um sorriso harmônico, não artificial.",
    comoFunciona: "Planejamento digital, prova em resina para você aprovar o desenho, e colocação das peças definitivas em cerca de três semanas.",
  },
];

export const dores = [
  {
    titulo: "Medo de dentista",
    texto: "Talvez uma experiência ruim na infância, talvez só o som do motor. Aqui, você sabe o que vai acontecer antes de acontecer, e pode levantar a mão a qualquer momento.",
  },
  {
    titulo: "Vergonha do sorriso",
    texto: "Mão na frente da boca na foto, riso contido na reunião. A maioria dos casos tem solução mais simples e mais rápida do que você imagina.",
  },
  {
    titulo: "Dor que não passa",
    texto: "Dor de dente não melhora sozinha, só muda de lugar. Se está doendo agora, a gente encaixa você esta semana.",
  },
];

export const passosPrimeiraConsulta = [
  {
    titulo: "Você manda uma mensagem",
    texto: "No WhatsApp mesmo. Conta o que sente ou só diz que quer uma avaliação. Respondemos em horário comercial, em geral em poucos minutos.",
  },
  {
    titulo: "Escolhemos o melhor horário",
    texto: "Mandamos as opções da semana. Se for dor, priorizamos o primeiro encaixe.",
  },
  {
    titulo: "A consulta, com calma",
    texto: "Conversa primeiro, exame depois. Fotos e radiografias se necessário. Tudo mostrado na tela, sem termo difícil.",
  },
  {
    titulo: "Plano por escrito",
    texto: "Você recebe o que precisa fazer, em que ordem, quanto custa e as formas de pagamento. Decide em casa, sem pressão.",
  },
];

/** EXEMPLO: trocar por depoimentos reais com autorização por escrito. */
export const depoimentos = [
  {
    nome: "[NOME DA PACIENTE]",
    contexto: "Limpeza e clareamento · EXEMPLO",
    texto: "Eu tinha pavor de dentista. Ele explicou cada passo antes de fazer e perguntava se estava tudo bem. Saí sem dor e sem medo.",
  },
  {
    nome: "[NOME DO PACIENTE]",
    contexto: "Tratamento de canal · EXEMPLO",
    texto: "Cheguei com dor há três dias. Saí da primeira sessão sem dor. Não entendi por que esperei tanto.",
  },
  {
    nome: "[NOME DA PACIENTE]",
    contexto: "Lentes de cerâmica · EXEMPLO",
    texto: "Queria algo natural, não aquele sorriso de televisão. Ficou exatamente como eu pedi. Agora rio em foto.",
  },
  {
    nome: "[NOME DO PACIENTE]",
    contexto: "Implante · EXEMPLO",
    texto: "Mastigava só de um lado há anos. O implante mudou minha alimentação. A cirurgia foi bem mais tranquila do que eu imaginava.",
  },
];

/** EXEMPLO: trocar por fotos reais com autorização por escrito. */
export const antesDepois = [
  {
    titulo: "Clareamento e restaurações",
    descricao: "Duas sessões de clareamento e troca de restaurações antigas. Imagem ilustrativa, não é paciente real.",
    antes: "/site/exemplo-antes.svg",
    depois: "/site/exemplo-depois.svg",
  },
];

export const faq = [
  {
    pergunta: "Quanto custa a avaliação?",
    resposta: "[VALOR DA AVALIAÇÃO]. Nela você recebe o plano completo por escrito, com o valor de cada tratamento, e decide depois. Não cobramos nada além disso para orçar.",
  },
  {
    pergunta: "Vai doer?",
    resposta: "Quase nenhum procedimento dói com anestesia bem aplicada. O que dói é esperar: cárie e canal pioram com o tempo. Se você tem medo, conte na primeira mensagem. Vamos com mais calma.",
  },
  {
    pergunta: "Quanto tempo leva?",
    resposta: "A avaliação leva até uma hora. Limpeza, 45 minutos. Restauração, de 30 a 60 minutos por dente. Tratamentos maiores têm o cronograma no plano por escrito.",
  },
  {
    pergunta: "Atende convênio?",
    resposta: "[CONVÊNIOS ATENDIDOS, ou: atendemos particular e emitimos recibo para reembolso do seu plano].",
  },
  {
    pergunta: "Como posso pagar?",
    resposta: "[FORMAS DE PAGAMENTO: Pix, cartão em até X vezes, dinheiro]. Tratamentos longos podem ser pagos por etapa.",
  },
  {
    pergunta: "Estou com dor agora. O que faço?",
    resposta: "Manda mensagem no WhatsApp dizendo que é dor. Encaixamos no primeiro horário livre, muitas vezes no mesmo dia.",
  },
];
