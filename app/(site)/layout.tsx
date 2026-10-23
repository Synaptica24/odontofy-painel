import type { Metadata } from "next";
import { site } from "@/config/site";
import { Analytics } from "@/components/site/analytics";
import "@/styles/site.css";

// Tipografia: SF Pro Display/Text do sistema (Apple) com Inter de reserva, já carregada em app/layout.tsx.
// Nenhuma fonte extra para baixar: o site fica mais leve.

const titulo = `${site.nome} · Dentista em ${site.cidade}`;
const descricao = `Dentista em ${site.bairro}, ${site.cidade}. Avaliação sem pressa, plano por escrito e atendimento para quem tem medo de dentista. Agende pelo WhatsApp.`;

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { absolute: titulo },
  description: descricao,
  keywords: [
    `dentista em ${site.cidade}`,
    `dentista ${site.bairro}`,
    "clareamento dental",
    "limpeza dental",
    "implante dentário",
    "lentes de contato dental",
    "medo de dentista",
    site.nome,
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: site.nome,
    title: titulo,
    description: descricao,
  },
  twitter: { card: "summary_large_image", title: titulo, description: descricao },
  robots: { index: true, follow: true },
};

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Dentist",
    name: site.nome,
    description: descricao,
    url: site.url,
    telephone: site.whatsappBonito,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.endereco,
      addressLocality: site.cidade,
      postalCode: site.cep,
      addressCountry: "BR",
    },
    sameAs: [site.instagramUrl],
    openingHoursSpecification: site.horarios
      .filter((h) => h.horas !== "Fechado")
      .map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.dias, description: h.horas })),
    priceRange: "$$",
  };
  return (
    <div className="site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      {children}
      <Analytics />
    </div>
  );
}
