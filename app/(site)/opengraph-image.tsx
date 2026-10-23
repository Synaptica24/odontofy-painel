import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = `${site.nome} · Dentista em ${site.cidade}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Imagem que aparece quando o link é colado no WhatsApp e no Instagram. */
export default function ImagemOpenGraph() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#F4F1EA",
          color: "#1F1E1B",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#7A776F", fontFamily: "Arial, sans-serif" }}>
          <div style={{ width: 36, height: 2, background: "#B5502A" }} />
          Dentista em {site.cidade}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 88, lineHeight: 1.02, letterSpacing: -1 }}>
            <span>Um dentista que</span>
            <span style={{ color: "#B5502A", fontStyle: "italic", marginLeft: 20, marginRight: 20 }}>explica</span>
            <span>antes de fazer.</span>
          </div>
          <div style={{ fontSize: 30, color: "#4A4844", fontFamily: "Arial, sans-serif" }}>
            Avaliação sem pressa · Plano por escrito · Agende pelo WhatsApp
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <div>{site.nome}</div>
          <div style={{ color: "#7A776F", fontFamily: "Arial, sans-serif", fontSize: 24 }}>{site.cro}</div>
        </div>
      </div>
    ),
    size,
  );
}
