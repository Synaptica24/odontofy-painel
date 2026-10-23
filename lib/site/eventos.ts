/**
 * Eventos de conversão do site. Falam com Meta Pixel (fbq) e Google Analytics (gtag)
 * quando os scripts existem, e sempre empurram para o dataLayer (GTM ou depuração).
 * Nenhum dado pessoal vai junto: só o nome do evento e de onde ele veio.
 */

type Janela = Window & {
  fbq?: (...args: unknown[]) => void;
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

export type OrigemClique =
  | "hero"
  | "flutuante"
  | "dores"
  | "tratamento"
  | "sobre"
  | "primeira-consulta"
  | "antes-depois"
  | "depoimentos"
  | "faq"
  | "localizacao"
  | "rodape"
  | "cabecalho";

export function registrarCliqueWhatsApp(origem: OrigemClique, detalhe?: string) {
  if (typeof window === "undefined") return;
  const w = window as Janela;
  const payload = { origem, detalhe: detalhe ?? "" };
  try {
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "clique_whatsapp", ...payload });
    w.fbq?.("track", "Contact", { content_name: origem });
    w.gtag?.("event", "clique_whatsapp", {
      event_category: "conversao",
      event_label: origem,
      detalhe: payload.detalhe,
    });
  } catch {
    /* analytics nunca quebra o clique */
  }
}

export function registrarEvento(nome: string, dados: Record<string, string | number> = {}) {
  if (typeof window === "undefined") return;
  const w = window as Janela;
  try {
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: nome, ...dados });
    w.gtag?.("event", nome, dados);
  } catch {
    /* silencioso */
  }
}
