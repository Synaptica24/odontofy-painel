import Link from "next/link";
import { site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";

export function Rodape() {
  return (
    <footer className="s-rodape">
      <div className="s-conteudo s-rodape__grade">
        <div>
          <p>
            <b style={{ color: "var(--s-grafite)", fontWeight: 500 }}>{site.nome}</b> · {site.profissao} ·{" "}
            {site.cro}
          </p>
          <p>
            {site.endereco}, {site.bairro}, {site.cidade}. Responsável técnico: {site.nome}, {site.cro}.
          </p>
          <p style={{ marginTop: "0.5rem" }}>
            <a href={site.instagramUrl} target="_blank" rel="noopener">
              Instagram
            </a>
            {" · "}
            <Link href="/entrar">Área do consultório</Link>
          </p>
        </div>
        <BotaoWhatsApp origem="rodape" className="s-botao s-botao--contorno s-botao--pequeno">
          Falar no WhatsApp
        </BotaoWhatsApp>
      </div>
    </footer>
  );
}
