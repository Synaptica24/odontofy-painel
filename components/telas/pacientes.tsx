"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Plus } from "lucide-react";
import { listarPacientes } from "@/lib/api";
import type { Paciente } from "@/lib/contratos";
import { useApi } from "@/components/dados/use-api";
import { diaCurto, hora, linkWa, telefoneBonito, telefoneExibicao } from "@/components/dados/datas";
import { Abas, Bloco, Botao, Cabecalho, Entrada, Erro, Item, Linha, Lista, OssoLinha, Pagina, Vazio } from "@/components/ui/primitivos";
import { PacienteForm } from "@/components/clinica/paciente-form";
import { cpfBonito } from "@/components/clinica/ficha-util";
import { CartaoPrevia } from "@/components/fx/cartao-previa";
import { Confete } from "@/components/fx/confete";
import { Avatar } from "@/components/fx/grupo-avatares";

/* Lista de pacientes no desenho do Codental: três abas (Buscar, Aniversariantes, Retornos semestrais),
   busca por nome/telefone/CPF/código e cada linha com nome + última consulta, CPF e telefone com WhatsApp. */

type Aba = "buscar" | "aniversariantes" | "retornos";
const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "buscar", rotulo: "Buscar" }, { valor: "aniversariantes", rotulo: "Aniversariantes" }, { valor: "retornos", rotulo: "Retornos semestrais" },
];
const ORIGEM: Record<string, string> = { whatsapp: "veio pelo WhatsApp", site: "veio pelo site", campanha: "voltou pela campanha", indicacao: "veio por indicação", codental: "importado do Codental" };

const SEIS_MESES_MS = 182 * 86400000;
const soDigitos = (v: string) => v.replace(/\D/g, "");

/** Última consulta conhecida: a última já realizada no painel ou, para quem veio do Codental, a última de lá. */
function ultimaConsulta(p: Paciente, agora: number) {
  const candidatos = [p.ultimo_agendamento_codental, p.ultimo_contato].filter((d): d is string => !!d).map((d) => Date.parse(d)).filter((t) => t <= agora);
  return candidatos.length ? new Date(Math.max(...candidatos)).toISOString() : null;
}
/** "há 3 meses", "quase 2 anos atrás": o tom que o Codental usa embaixo do nome. */
function haQuantoLongo(iso: string, agora: number) {
  const dias = Math.round((agora - Date.parse(iso)) / 86400000);
  if (dias < 1) return "hoje";
  if (dias < 30) return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  const meses = Math.round(dias / 30.44);
  if (meses < 12) return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
  const anos = dias / 365.25;
  const inteiro = Math.floor(anos);
  if (anos - inteiro > 0.75) return `quase ${inteiro + 1} anos atrás`;
  return inteiro === 1 ? "há 1 ano" : `há ${inteiro} anos`;
}
function mesDia(civil?: string | null) {
  return civil ? civil.slice(5, 10) : null;
}

export function TelaPacientes() {
  return (
    <Suspense fallback={null}>
      <Pacientes />
    </Suspense>
  );
}

function Pacientes() {
  const params = useSearchParams();
  const router = useRouter();
  const [busca, setBusca] = useState(params.get("busca") ?? "");
  const [aba, setAba] = useState<Aba>("buscar");
  const [novo, setNovo] = useState(false);
  const [festa, setFesta] = useState(false);
  const [agora] = useState(() => Date.now());
  // Carrega todos uma vez (a lista inteira cabe numa chamada) e filtra no navegador: a busca responde na hora.
  const r = useApi(() => listarPacientes(), []);
  const todos = r.dados;

  const termo = busca.trim().toLowerCase();
  const termoDigitos = soDigitos(termo);
  const lista = useMemo(() => {
    if (!todos) return null;
    const hojeMD = mesDia(new Date(agora).toISOString());
    const mesAtual = hojeMD!.slice(0, 2);
    if (aba === "aniversariantes") {
      return todos
        .filter((p) => mesDia(p.nascimento)?.slice(0, 2) === mesAtual)
        .sort((a, b) => (mesDia(a.nascimento)! < mesDia(b.nascimento)! ? -1 : 1));
    }
    if (aba === "retornos") {
      return todos
        .filter((p) => !p.proximo_agendamento)
        .map((p) => ({ p, ultima: ultimaConsulta(p, agora) }))
        .filter((x) => x.ultima && agora - Date.parse(x.ultima) >= SEIS_MESES_MS)
        .sort((a, b) => (a.ultima! < b.ultima! ? -1 : 1))
        .map((x) => x.p);
    }
    if (!termo) return todos;
    return todos.filter((p) =>
      p.nome.toLowerCase().includes(termo)
      || (termoDigitos.length >= 3 && (soDigitos(p.telefone_e164 ?? "").includes(termoDigitos) || soDigitos(p.telefone_contato ?? "").includes(termoDigitos) || (p.cpf ?? "").includes(termoDigitos)))
      || p.codental_numero === termo || p.codental_id === termo,
    );
  }, [todos, aba, termo, termoDigitos, agora]);

  function cadastrado(p: Paciente) {
    setNovo(false);
    r.definir((atual) => [p, ...atual]);
    // uma rajada de confete e só então a ficha abre; sem movimento o canvas não desenha e a espera é curta
    setFesta(true);
    window.setTimeout(() => router.push(`/pacientes/${p.id}`), window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1100);
  }

  const titulo = aba === "aniversariantes" ? "Aniversariantes do mês" : aba === "retornos" ? "Sem consulta há mais de 6 meses" : busca ? "Resultado" : "Todos";

  return (
    <Pagina>
      <Cabecalho titulo="Pacientes" acao={<Botao cheio onClick={() => setNovo(true)}><Plus size={16} aria-hidden /> Cadastrar paciente</Botao>} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Abas valor={aba} opcoes={ABAS} aoMudar={setAba} />
      </div>
      {aba === "buscar" && (
        <div className="mt-3">
          <Entrada type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busque por nome, telefone, CPF ou código" aria-label="Procurar paciente" />
        </div>
      )}
      {r.fase === "erro" && !todos && <Erro mensagem={r.erro} tentar={r.recarregar} />}
      <Bloco primeiro titulo={titulo} id="lista-pacientes" lado={lista && lista.length > 0 ? lista.length : undefined}>
        {!lista ? (
          <OssoLinha n={8} />
        ) : lista.length === 0 ? (
          aba !== "buscar" ? (
            <Vazio titulo={aba === "aniversariantes" ? "Ninguém faz aniversário este mês." : "Todo mundo passou por aqui nos últimos 6 meses."} />
          ) : (
            <Vazio
              titulo={busca ? "Ninguém com esse nome." : "Nenhum paciente ainda."}
              sub={!busca ? <Botao className="ml-2" onClick={() => setNovo(true)}>Cadastrar o primeiro</Botao> : <Botao className="ml-2" onClick={() => setNovo(true)}>Cadastrar “{busca.trim()}”</Botao>}
              icone={<span className="marca" />}
            />
          )
        ) : (
          <>
            <div className="pacientes-cab" aria-hidden>
              <span>Nome</span><span>CPF</span><span>Telefone</span>
            </div>
            <Lista>
              {lista.map((p) => <LinhaPaciente key={p.id} p={p} aba={aba} agora={agora} />)}
            </Lista>
          </>
        )}
      </Bloco>
      {novo && <PacienteForm nomeInicial={lista && lista.length === 0 ? busca.trim() : ""} aoFechar={() => setNovo(false)} aoSalvar={cadastrado} />}
      {festa && <Confete origem={{ x: 0.5, y: 0.3 }} />}
    </Pagina>
  );
}

function LinhaPaciente({ p, aba, agora }: { p: Paciente; aba: Aba; agora: number }) {
  const telefone = telefoneExibicao(p);
  const ultima = ultimaConsulta(p, agora);
  const anosEsteAno = p.nascimento ? new Date(agora).getFullYear() - Number(p.nascimento.slice(0, 4)) : null;
  const sub = aba === "aniversariantes" && p.nascimento
    ? `Aniversário em ${p.nascimento.slice(8, 10)}/${p.nascimento.slice(5, 7)}${anosEsteAno ? ` · faz ${anosEsteAno} anos` : ""}`
    : p.proximo_agendamento
      ? `Próxima consulta: ${diaCurto(p.proximo_agendamento.inicio)} às ${hora(p.proximo_agendamento.inicio)}`
      : ultima
        ? `Última consulta: ${new Date(ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} - ${haQuantoLongo(ultima, agora)}`
        : `Cadastro em ${diaCurto(p.primeiro_contato)}`;
  const previa = (
    <>
      <div className="flex items-center gap-3">
        <Avatar nome={p.nome} tamanho={36} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{p.nome}</p>
          <p className="text-tinta-3">{ORIGEM[p.origem] ?? p.origem}</p>
        </div>
      </div>
      <dl>
        <dt>Telefone</dt><dd>{telefone ? telefoneBonito(telefone) : "sem telefone"}</dd>
        {p.cpf && <><dt>CPF</dt><dd>{cpfBonito(p.cpf)}</dd></>}
        {p.nascimento && <><dt>Nascimento</dt><dd>{p.nascimento.slice(8, 10)}/{p.nascimento.slice(5, 7)}/{p.nascimento.slice(0, 4)}</dd></>}
        <dt>Convênio</dt><dd>{p.convenio?.nome ?? "Particular"}</dd>
        <dt>{p.proximo_agendamento ? "Próxima" : "Última"}</dt>
        <dd>{p.proximo_agendamento ? `${diaCurto(p.proximo_agendamento.inicio)} às ${hora(p.proximo_agendamento.inicio)}` : ultima ? haQuantoLongo(ultima, agora) : "sem consulta"}</dd>
      </dl>
    </>
  );
  return (
    <Item>
      <Linha
        marca={p.status === "em_conversa" ? "ia" : p.proximo_agendamento ? "voce" : "nada"}
        href={`/pacientes/${p.id}`}
        titulo={
          <>
            <CartaoPrevia cartao={previa}>{p.nome}</CartaoPrevia>
            {p.convenio && <span className="chip chip--cor ml-2 align-middle" style={{ background: p.convenio.cor }}>{p.convenio.nome}</span>}
          </>
        }
        sub={
          <>
            {sub}
            <span className="tabela-linha__extra">{" · "}{ORIGEM[p.origem] ?? p.origem}{p.nao_perturbe ? " · não quer mensagens" : ""}</span>
          </>
        }
        lado={
          <span className="pacientes-colunas num">
            <span className="pacientes-cpf">{p.cpf ? cpfBonito(p.cpf) : ""}</span>
            <span className="pacientes-tel">
              {telefone ? (
                <>
                  {linkWa(telefone) && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(linkWa(telefone)!, "_blank", "noopener"); }} aria-label="Abrir WhatsApp" className="pacientes-wa"><MessageCircle size={14} aria-hidden /></button>}
                  {telefoneBonito(telefone)}
                </>
              ) : <span className="text-tinta-3">sem telefone</span>}
            </span>
          </span>
        }
      />
    </Item>
  );
}
