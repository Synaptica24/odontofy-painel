import 'server-only';
import { createHash } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

/* Contratos: preenchimento de variáveis, PDF do documento e PDF assinado (assinatura desenhada +
   nome, CPF, data/hora, IP e hash). A interface ProvedorAssinatura deixa pronto o encaixe de um
   provedor com validade jurídica mais forte (ZapSign, Clicksign) sem mudar o resto do sistema. */

export type Variaveis = Record<string, string>;

export function preencherVariaveis(conteudo: string, variaveis: Variaveis): string {
  return conteudo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, chave: string) => variaveis[chave] ?? `[${chave}]`);
}
export function variaveisPendentes(conteudo: string): string[] {
  return Array.from(new Set(Array.from(conteudo.matchAll(/\[([a-zA-Z0-9_]+)\]/g)).map((m) => m[1])));
}

const A4 = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;

/** Substitui caracteres fora do WinAnsi (os únicos que a Helvetica padrão desenha). */
function texto(s: string) {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, '?');
}

function quebrar(fonte: PDFFont, tamanho: number, linha: string, larguraMax: number): string[] {
  const palavras = linha.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMax || !atual) atual = tentativa;
    else { linhas.push(atual); atual = p; }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

type Cursor = { pagina: PDFPage; y: number };

async function escreverDocumento(doc: PDFDocument, titulo: string, conteudo: string, rodape: string) {
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const largura = A4.largura - MARGEM * 2;
  let cursor: Cursor = { pagina: doc.addPage([A4.largura, A4.altura]), y: A4.altura - MARGEM };
  const novaPagina = () => { cursor = { pagina: doc.addPage([A4.largura, A4.altura]), y: A4.altura - MARGEM }; };
  const linha = (t: string, f: PDFFont, tamanho: number, espaco = 1.45, cor = rgb(0.06, 0.09, 0.16)) => {
    for (const l of quebrar(f, tamanho, texto(t), largura)) {
      if (cursor.y < MARGEM + tamanho * 2) novaPagina();
      cursor.pagina.drawText(l, { x: MARGEM, y: cursor.y - tamanho, size: tamanho, font: f, color: cor });
      cursor.y -= tamanho * espaco;
    }
  };
  linha(titulo, negrito, 16, 1.6);
  cursor.y -= 8;
  for (const paragrafo of conteudo.replace(/\r\n/g, '\n').split('\n')) {
    if (!paragrafo.trim()) { cursor.y -= 7; continue; }
    const ehTitulo = /^#{1,3}\s/.test(paragrafo) || (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .,:-]{6,}$/.test(paragrafo) && paragrafo.length < 80);
    linha(paragrafo.replace(/^#{1,3}\s/, ''), ehTitulo ? negrito : fonte, ehTitulo ? 11.5 : 10.5);
    if (ehTitulo) cursor.y -= 2;
  }
  // rodapé em todas as páginas
  const paginas = doc.getPages();
  paginas.forEach((p, i) => {
    p.drawText(texto(`${rodape}  ·  página ${i + 1} de ${paginas.length}`), { x: MARGEM, y: MARGEM / 2, size: 8, font: fonte, color: rgb(0.45, 0.47, 0.5) });
  });
  return { fonte, negrito };
}

export async function gerarPdfContrato(titulo: string, conteudo: string, rodape: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(titulo); doc.setProducer('Painel do consultório'); doc.setCreationDate(new Date());
  await escreverDocumento(doc, titulo, conteudo, rodape);
  return doc.save();
}

export interface DadosAssinatura {
  nome: string; cpf: string; ip: string; user_agent: string; assinado_em: string;
  /** PNG em data URL desenhado pelo paciente. */
  imagem_png: string;
}

export function hashDocumento(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Anexa ao PDF original uma página final de assinatura e retorna o novo PDF. */
export async function gerarPdfAssinado(original: Uint8Array, dados: DadosAssinatura): Promise<{ pdf: Uint8Array; hash_original: string }> {
  const hash_original = hashDocumento(original);
  const doc = await PDFDocument.load(original);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const pagina = doc.addPage([A4.largura, A4.altura]);
  let y = A4.altura - MARGEM;
  const escreve = (t: string, f: PDFFont, tamanho: number) => { pagina.drawText(texto(t), { x: MARGEM, y: y - tamanho, size: tamanho, font: f, color: rgb(0.06, 0.09, 0.16) }); y -= tamanho * 1.6; };
  escreve('Registro de assinatura eletrônica', negrito, 15);
  y -= 6;
  escreve(`Assinante: ${dados.nome}`, fonte, 10.5);
  escreve(`CPF: ${formatarCpf(dados.cpf)}`, fonte, 10.5);
  escreve(`Data e hora: ${new Date(dados.assinado_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (America/Sao_Paulo)`, fonte, 10.5);
  escreve(`Endereço IP: ${dados.ip || 'não informado'}`, fonte, 10.5);
  escreve(`Navegador: ${dados.user_agent.slice(0, 110)}`, fonte, 9);
  escreve(`Hash SHA-256 do documento original: ${hash_original}`, fonte, 8.5);
  y -= 10;
  escreve('Assinatura desenhada pelo assinante:', fonte, 10.5);
  try {
    const base64 = dados.imagem_png.replace(/^data:image\/png;base64,/, '');
    const png = await doc.embedPng(Buffer.from(base64, 'base64'));
    const escala = Math.min(260 / png.width, 110 / png.height, 1);
    pagina.drawRectangle({ x: MARGEM, y: y - 120, width: 280, height: 120, borderColor: rgb(0.82, 0.84, 0.87), borderWidth: 1 });
    pagina.drawImage(png, { x: MARGEM + 10, y: y - 115, width: png.width * escala, height: png.height * escala });
    y -= 130;
  } catch {
    escreve('[imagem da assinatura indisponível]', fonte, 10);
  }
  y -= 10;
  escreve('Este registro foi gerado pelo sistema do consultório no momento da assinatura. A assinatura eletrônica simples', fonte, 8.5);
  escreve('vincula o assinante ao documento acima pelos dados aqui registrados (Lei 14.063/2020, art. 4º, I).', fonte, 8.5);
  const pdf = await doc.save();
  return { pdf, hash_original };
}

export function formatarCpf(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}
export function cpfValido(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/* ---------- Provedor de assinatura ----------
   "interno" = link próprio + assinatura desenhada (implementado).
   Para ZapSign/Clicksign: implementar esta interface em outro arquivo, registrar em provedorAssinatura()
   e guardar provedor/provedor_referencia no contrato. O resto do painel não muda. */
export interface ProvedorAssinatura {
  nome: 'interno' | 'zapsign' | 'clicksign';
  /** Cria o envelope/link de assinatura e devolve o que deve ser guardado no contrato. */
  criarEnvelope(entrada: { contratoId: string; titulo: string; pdf: Uint8Array; signatario: { nome: string; email?: string; telefone?: string; cpf?: string }; linkBase: string; token: string }): Promise<{ link: string; referencia: string | null }>;
  /** Consulta o estado (para provedores externos; o interno responde pelo próprio banco). */
  consultar?(referencia: string): Promise<{ status: 'pendente' | 'assinado' | 'cancelado'; pdfAssinadoUrl?: string }>;
}
export const provedorInterno: ProvedorAssinatura = {
  nome: 'interno',
  async criarEnvelope({ linkBase, token }) { return { link: `${linkBase}/assinar/${token}`, referencia: null }; },
};
export function provedorAssinatura(): ProvedorAssinatura {
  // Quando ZAPSIGN_API_TOKEN ou CLICKSIGN_ACCESS_TOKEN existirem, trocar aqui.
  return provedorInterno;
}
