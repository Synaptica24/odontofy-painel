import { AntesDepois } from "@/components/site/antes-depois";
import { WhatsAppFlutuante } from "@/components/site/botao-whatsapp";
import { Cabecalho } from "@/components/site/cabecalho";
import { Depoimentos } from "@/components/site/depoimentos";
import { Dores } from "@/components/site/dores";
import { Faq } from "@/components/site/faq";
import { Hero } from "@/components/site/hero";
import { Localizacao } from "@/components/site/localizacao";
import { PrimeiraConsulta } from "@/components/site/primeira-consulta";
import { Rodape } from "@/components/site/rodape";
import { Sobre } from "@/components/site/sobre";
import { Tratamentos } from "@/components/site/tratamentos";

export default function PaginaSite() {
  return (
    <>
      <Cabecalho />
      <main>
        <Hero />
        <Dores />
        <Tratamentos />
        <Sobre />
        <PrimeiraConsulta />
        <AntesDepois />
        <Depoimentos />
        <Faq />
        <Localizacao />
      </main>
      <Rodape />
      <WhatsAppFlutuante />
    </>
  );
}
