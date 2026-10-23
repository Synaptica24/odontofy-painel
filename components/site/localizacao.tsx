import { ArrowUpRight, MapPin } from "lucide-react";
import { site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Foto } from "./foto";
import { Revelar, TextoSobe } from "./revelar";

export function Localizacao() {
  return (
    <section id="onde" className="s-secao s-secao--linha" aria-labelledby="onde-titulo">
      <div className="s-conteudo">
        <div className="s-local__grade">
          <Revelar>
            <Foto
              src={site.fotos.consultorio || undefined}
              alt="Fachada e recepção do consultório"
              rotulo="[FOTO DO CONSULTÓRIO]"
              className="s-local__mapa"
            />
          </Revelar>
          <div className="s-local__dados">
            <Revelar as="p" className="s-rotulo">
              Onde fica e quando atende
            </Revelar>
            <TextoSobe className="s-titulo-2" texto="Fácil de chegar, fácil de estacionar." destaque="chegar," />
            <Revelar as="dl" className="s-local__linha" indice={1}>
              <dt>Endereço</dt>
              <dd>
                {site.endereco}
                <br />
                {site.bairro}, {site.cidade} · {site.cep}
              </dd>
            </Revelar>
            <Revelar indice={2}>
              <dl className="s-horarios">
                {site.horarios.map((h) => (
                  <div key={h.dias}>
                    <dt>{h.dias}</dt>
                    <dd>{h.horas}</dd>
                  </div>
                ))}
              </dl>
            </Revelar>
            <Revelar as="dl" className="s-local__linha" indice={3}>
              <dt>Contato</dt>
              <dd>
                WhatsApp {site.whatsappBonito} · {site.instagram}
              </dd>
            </Revelar>
            <Revelar className="s-hero__acoes" indice={4}>
              <a href={site.mapsUrl} target="_blank" rel="noopener" className="s-botao s-botao--contorno">
                <MapPin size={18} /> Como chegar <ArrowUpRight size={16} />
              </a>
            </Revelar>
          </div>
        </div>

        <Revelar className="s-final" indice={1}>
          <p className="s-rotulo" style={{ color: "rgba(244,241,234,0.6)" }}>
            Última coisa
          </p>
          <h2 className="s-titulo-2">Se você leu até aqui, já está pronto para a primeira mensagem.</h2>
          <p className="s-texto">
            Diga só “quero uma avaliação”. A gente responde com os horários da semana. Sem compromisso e
            sem pressão.
          </p>
          <div className="s-final__acoes">
            <BotaoWhatsApp origem="localizacao" />
            <span className="s-pequeno" style={{ color: "rgba(244,241,234,0.6)" }}>
              Atendimento humano em horário comercial.
            </span>
          </div>
        </Revelar>
      </div>
    </section>
  );
}
