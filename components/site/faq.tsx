"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { faq } from "@/config/site";
import { registrarEvento } from "@/lib/site/eventos";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { Revelar, TextoSobe } from "./revelar";

/* FAQ accordion (ideia do bencho.dev): a resposta abre por grid-template-rows 0fr → 1fr,
   o único jeito de animar altura desconhecida sem JS medindo nada. */
export function Faq() {
  const [aberto, setAberto] = useState<number | null>(0);
  const idBase = useId();
  function alternar(i: number) {
    const novo = aberto === i ? null : i;
    setAberto(novo);
    if (novo !== null) registrarEvento("abrir_faq", { pergunta: faq[i].pergunta });
  }
  return (
    <section id="faq" className="s-secao s-secao--linha" aria-labelledby="faq-titulo">
      <div className="s-conteudo s-faq__grade">
        <div className="s-faq__cabeca">
          <Revelar as="p" className="s-rotulo">
            Dúvidas frequentes
          </Revelar>
          <div style={{ marginTop: "1rem" }}>
            <TextoSobe className="s-titulo-2" texto="O que todo mundo pergunta antes de vir." destaque="pergunta" />
          </div>
          <Revelar as="p" className="s-texto" indice={1}>
            <span style={{ display: "block", marginTop: "1.25rem" }}>
              Não achou a sua? Manda no WhatsApp. Responder dúvida não compromete você com nada.
            </span>
          </Revelar>
          <Revelar indice={2}>
            <div style={{ marginTop: "1.5rem" }}>
              <BotaoWhatsApp origem="faq" className="s-botao s-botao--contorno">
                Perguntar no WhatsApp
              </BotaoWhatsApp>
            </div>
          </Revelar>
        </div>
        <Revelar as="ul" className="s-faq__lista" indice={1}>
          {faq.map((f, i) => {
            const idBotao = `${idBase}-p${i}`;
            const idPainel = `${idBase}-r${i}`;
            const estaAberto = aberto === i;
            return (
              <li key={f.pergunta} className="s-faq__item" data-aberto={estaAberto ? "" : undefined}>
                <h3>
                  <button
                    type="button"
                    id={idBotao}
                    className="s-faq__pergunta"
                    aria-expanded={estaAberto}
                    aria-controls={idPainel}
                    onClick={() => alternar(i)}
                  >
                    {f.pergunta}
                    <span className="s-faq__mais" aria-hidden>
                      <Plus size={14} />
                    </span>
                  </button>
                </h3>
                <div id={idPainel} role="region" aria-labelledby={idBotao} className="s-faq__resposta">
                  <div>
                    <p>{f.resposta}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </Revelar>
      </div>
    </section>
  );
}
