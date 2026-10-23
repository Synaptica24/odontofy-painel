import { passosPrimeiraConsulta, site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

export function PrimeiraConsulta() {
  return (
    <section id="primeira-consulta" className="s-secao s-secao--linha" aria-labelledby="pc-titulo">
      <div className="s-conteudo">
        <Revelar as="p" className="s-rotulo">
          Como funciona a primeira consulta
        </Revelar>
        <div style={{ marginTop: "1rem", marginBottom: "2.5rem", maxWidth: "40rem" }}>
          <TextoSobe className="s-titulo-2" texto="Quatro passos. Nenhum deles dói." destaque="dói." />
        </div>
        <div className="s-passos__grade">
          <ol className="s-passos">
            {passosPrimeiraConsulta.map((p, i) => (
              <Revelar as="li" key={p.titulo} className="s-passo" indice={i}>
                <span className="s-passo__numero num" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <h3>{p.titulo}</h3>
                  <p className="s-texto">{p.texto}</p>
                </div>
              </Revelar>
            ))}
          </ol>
          <aside className="s-passos__lado">
            <Revelar className="s-passos__cartao" indice={2}>
              <p className="s-rotulo" style={{ color: "rgba(244,241,234,0.6)" }}>
                Leve com você
              </p>
              <h3 className="s-titulo-3">O que trazer na primeira vez</h3>
              <p>
                Documento com foto, lista de remédios que você toma e, se tiver, radiografias ou
                exames antigos. Se não tiver nada disso, venha assim mesmo.
              </p>
              <p className="s-pequeno">
                Horário: {site.horarios[0].dias.toLowerCase()}, {site.horarios[0].horas}.
              </p>
              <div>
                <BotaoWhatsApp origem="primeira-consulta" className="s-botao s-botao--destaque">
                  Agendar minha avaliação
                </BotaoWhatsApp>
              </div>
            </Revelar>
          </aside>
        </div>
      </div>
    </section>
  );
}
