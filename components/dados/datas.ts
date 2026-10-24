// Formatação de datas em pt-BR, sempre em America/Sao_Paulo.
const FUSO = "America/Sao_Paulo";

const fmt = (opcoes: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, ...opcoes });

const fHora = fmt({ hour: "2-digit", minute: "2-digit" });
const fDiaCurto = fmt({ day: "numeric", month: "short" });
const fDiaLongo = fmt({ weekday: "long", day: "numeric", month: "long" });
const fDiaSemanaCurto = fmt({ weekday: "short" });
const fDiaNumero = fmt({ day: "numeric" });
const fMes = fmt({ month: "long", year: "numeric" });
const fCivil = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function hora(iso: string) {
  return fHora.format(new Date(iso));
}
export function diaCurto(iso: string) {
  return fDiaCurto.format(new Date(iso)).replace(".", "");
}
export function diaLongo(d: Date | string) {
  const s = fDiaLongo.format(typeof d === "string" ? civilParaData(d) : d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function diaSemanaCurto(civil: string) {
  return fDiaSemanaCurto.format(civilParaData(civil)).replace(".", "");
}
export function diaNumero(civil: string) {
  return fDiaNumero.format(civilParaData(civil));
}
export function mesPorExtenso(d = new Date()) {
  const s = fMes.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Data civil (YYYY-MM-DD) de hoje em São Paulo. */
export function hojeCivil(d = new Date()) {
  return fCivil.format(d);
}
/** Meio-dia local para evitar virada de dia ao formatar. */
export function civilParaData(civil: string) {
  return new Date(`${civil}T12:00:00-03:00`);
}
export function somarDias(civil: string, dias: number) {
  const d = civilParaData(civil);
  d.setUTCDate(d.getUTCDate() + dias);
  return fCivil.format(d);
}
/** Segunda-feira da semana da data civil. */
export function inicioDaSemana(civil: string) {
  const d = civilParaData(civil);
  const dow = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short" }).format(d);
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(dow);
  return somarDias(civil, -Math.max(0, idx));
}
export function ehHoje(civil: string) {
  return civil === hojeCivil();
}

export function haQuanto(iso: string, agora = new Date()) {
  const min = Math.round((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** Hora se for hoje; senão dia curto. */
export function quando(iso: string) {
  return hojeCivil(new Date(iso)) === hojeCivil() ? hora(iso) : diaCurto(iso);
}

export function faltaQuanto(iso: string, agora = new Date()) {
  const min = Math.round((new Date(iso).getTime() - agora.getTime()) / 60000);
  if (min <= 0) return "expirou";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

export function reais(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
export function dolares(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
}
export function telefoneBonito(e164: string | null | undefined) {
  if (!e164) return "sem telefone";
  const m = e164.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}
/** Número para exibir/ligar: o WhatsApp principal ou, na falta dele, o contato compartilhado ou o fixo. */
export function telefoneExibicao(p: { telefone_e164: string | null; telefone_contato?: string; telefone_fixo?: string }) {
  return p.telefone_e164 || p.telefone_contato || p.telefone_fixo || null;
}
/** Ordena um resultado de busca: quem bate exatamente no código, CPF ou telefone vem antes de quem bate só em parte. */
export function ordenarBusca<T extends { nome: string; cpf?: string; codental_numero?: string; telefone_e164: string | null; telefone_contato?: string }>(lista: T[], termo: string) {
  const t = termo.trim().toLowerCase();
  const d = t.replace(/D/g, "");
  const peso = (p: T) =>
    (p.codental_numero && p.codental_numero.toLowerCase() === t) || (d.length >= 3 && (p.cpf === d || (p.telefone_e164 ?? "").replace(/D/g, "").endsWith(d) || (p.telefone_contato ?? "").replace(/D/g, "").endsWith(d)))
      ? 0
      : p.nome.toLowerCase().startsWith(t)
        ? 1
        : 2;
  return [...lista].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
}
/** wa.me só funciona com dígitos; sem número devolve null para o botão sumir. */
export function linkWa(e164: string | null | undefined, texto?: string) {
  if (!e164) return null;
  return `https://wa.me/${e164.replace(/\D/g, "")}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
