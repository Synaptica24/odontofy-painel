import { site } from "@/config/site";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Foto } from "./foto";
import { Revelar, TextoSobe } from "./revelar";

export function Sobre() {
  return (
    <section id="sobre" className="s-secao s-secao--linha" aria-labelledby="sobre-titulo">
      <div className="s-conteudo s-sobre__grade">
        <Revelar>
          <Foto
            src={site.fotos.doutor || undefined}
            alt={`${site.nome}, ${site.profissao}`}
            rotulo="[FOTO DO DR.]"
            className="s-sobre__foto"
          />
        </Revelar>
        <div className="s-sobre__texto">
          <Revelar as="p" className="s-rotulo">
            Quem vai cuidar de você
          </Revelar>
          <TextoSobe className="s-titulo-2" texto="Dr. Mateus Peixoto." destaque="Peixoto." />
          <Revelar as="p" className="s-texto s-texto--grande" indice={1}>
            [HISTÓRIA DO DR.: onde se formou, há quanto tempo atende, o que o levou à odontologia.
            Duas ou três frases, na primeira pessoa ou na terceira, sem exagero.]
          </Revelar>
          <Revelar as="blockquote" className="s-sobre__citacao" indice={2}>
            “Ninguém sai daqui sem entender o que tem na boca e o que vai ser feito. Entender tira
            metade do medo.”
          </Revelar>
          <Revelar as="p" className="s-texto" indice={3}>
            A abordagem é a mesma para todo paciente: ouvir antes de examinar, mostrar as fotos na
            tela, propor o mínimo necessário e deixar o plano por escrito para você decidir em casa.
          </Revelar>
          <Revelar as="p" className="s-sobre__cred" indice={4}>
            <span>{site.cro}</span>
            <span>[FORMAÇÃO]</span>
            <span>[ESPECIALIZAÇÃO]</span>
          </Revelar>
          <Revelar indice={5}>
            <BotaoWhatsApp origem="sobre" className="s-botao s-botao--contorno">
              Marcar uma conversa com ele
            </BotaoWhatsApp>
          </Revelar>
        </div>
      </div>
    </section>
  );
}
