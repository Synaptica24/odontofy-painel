import { site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Foto } from "./foto";
import { Revelar, TextoSobe } from "./revelar";

export function Hero() {
  return (
    <section id="inicio" className="s-hero">
      <div className="s-conteudo s-hero__grade">
        <div className="s-hero__texto">
          <Revelar as="p" className="s-rotulo">
            Dentista em {site.bairro}, {site.cidade}
          </Revelar>
          <TextoSobe
            as="h1"
            className="s-titulo"
            texto="Um dentista que explica antes de fazer."
            destaque="explica"
          />
          <Revelar as="p" className="s-texto s-texto--grande" desfoca indice={3}>
            Avaliação sem pressa, plano por escrito e o cuidado de quem sabe que talvez você esteja
            com medo. Você conta o que sente; o resto a gente resolve junto.
          </Revelar>
          <Revelar className="s-hero__acoes" indice={4}>
            <span id="cta-hero">
              <BotaoWhatsApp origem="hero" />
            </span>
            <a href="#primeira-consulta" className="s-link">
              Como é a primeira consulta
            </a>
          </Revelar>
          {site.provaSocial && (
            <Revelar as="p" className="s-hero__prova" indice={5}>
              <b>{site.provaSocial}</b>
            </Revelar>
          )}
        </div>
        <Revelar indice={2}>
          <Foto
            src={site.fotos.doutor || undefined}
            alt={`${site.nome} no consultório`}
            rotulo="[FOTO DO DR.]"
            className="s-hero__foto"
            prioridade
          >
            <span className="s-hero__legenda">“Primeiro a gente conversa. Depois, se você quiser, a gente trata.”</span>
          </Foto>
        </Revelar>
      </div>
    </section>
  );
}
