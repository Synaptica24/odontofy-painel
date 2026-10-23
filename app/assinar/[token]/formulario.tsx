"use client";

import { useRef, useState } from "react";
import { AssinaturaPad, type AssinaturaPadRef } from "@/components/clinica/assinatura-pad";

function mascararCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function cpfOk(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const calc = (n: number) => { let s = 0; for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function FormularioAssinatura({ token }: { token: string }) {
  const pad = useRef<AssinaturaPadRef>(null);
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [aceite, setAceite] = useState(false);
  const [padVazio, setPadVazio] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState<string | null>(null);

  const nomeOk = nome.trim().split(/\s+/).length >= 2 && nome.trim().length >= 3;
  const podeAssinar = nomeOk && cpfOk(cpf) && aceite && !padVazio && !enviando;

  async function assinar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const imagem = pad.current?.exportarPng();
    if (!imagem) { setErro("Desenhe sua assinatura no quadro."); return; }
    setEnviando(true);
    try {
      const r = await fetch(`/api/assinar/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ nome: nome.trim(), cpf: cpf.replace(/\D/g, ""), aceite, imagem_png: imagem }),
      });
      const j = await r.json();
      if (!j.sucesso) { setErro(j.erro?.mensagem ?? "Não foi possível assinar."); return; }
      setPronto(j.dados.assinado_em);
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setErro("Sem conexão agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  }

  if (pronto) {
    return (
      <section className="assinar__cartao assinar__cartao--ok" aria-live="polite">
        <h2 className="assinar__sub">Assinado</h2>
        <p className="assinar__texto">Pronto. Estamos preparando o PDF assinado para você baixar.</p>
      </section>
    );
  }

  return (
    <form className="assinar__cartao assinar__form" onSubmit={assinar} noValidate>
      <h2 className="assinar__sub">Assine</h2>
      <label className="assinar__campo">
        <span>Nome completo</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required maxLength={120} placeholder="Como está no seu documento" />
      </label>
      <label className="assinar__campo">
        <span>CPF</span>
        <input value={cpf} onChange={(e) => setCpf(mascararCpf(e.target.value))} inputMode="numeric" autoComplete="off" required placeholder="000.000.000-00" aria-invalid={cpf.length === 14 && !cpfOk(cpf)} />
        {cpf.length === 14 && !cpfOk(cpf) && <small className="assinar__erro-campo">CPF inválido. Confira os números.</small>}
      </label>
      <div className="assinar__campo">
        <span>Sua assinatura</span>
        <AssinaturaPad ref={pad} onChange={setPadVazio} />
      </div>
      <label className="assinar__aceite">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
        <span>Li o documento acima e concordo com o seu conteúdo.</span>
      </label>
      {erro && <p className="assinar__erro" role="alert">{erro}</p>}
      <button type="submit" className="assinar__botao" disabled={!podeAssinar}>
        {enviando ? "Assinando…" : "Assinar documento"}
      </button>
      <p className="assinar__mudo">Ao assinar, registramos data, hora e endereço IP junto com a sua assinatura.</p>
    </form>
  );
}
