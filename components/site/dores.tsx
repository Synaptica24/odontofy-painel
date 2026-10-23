import { dores } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

export function Dores() {
  return (
    <section className="s-secao s-secao--linha" aria-labelledby="dores-titulo">
      <div className="s-conteudo s-dores__grade">
        <div className="s-dores__cabeca">
          <Revelar as="p" className="s-rotulo">
            Para quem é
          </Revelar>
          <div style={{ marginTop: "1rem" }}>
            <TextoSobe
              className="s-titulo-2"
              texto="Se alguma destas frases é sua, este consultório foi pensado para você."
              destaque="sua,"
            />
          </div>
          <Revelar as="p" className="s-texto" indice={2}>
            <span style={{ display: "block", marginTop: "1.25rem" }}>
              A maior parte de quem chega aqui adiou a consulta por anos. Ninguém é julgado por isso.
            </span>
          </Revelar>
          <Revelar indice={3}>
            <div style={{ marginTop: "1.5rem" }}>
              <BotaoWhatsApp origem="dores" className="s-botao s-botao--contorno">
                Quero conversar primeiro
              </BotaoWhatsApp>
            </div>
          </Revelar>
        </div>
        <ol className="s-dores__lista">
          {dores.map((d, i) => (
            <Revelar as="li" key={d.titulo} className="s-dor" indice={i}>
              <span className="s-dor__numero" aria-hidden>
                0{i + 1}
              </span>
              <div>
                <h3>{d.titulo}</h3>
                <p className="s-texto">{d.texto}</p>
              </div>
            </Revelar>
          ))}
        </ol>
      </div>
    </section>
  );
}
