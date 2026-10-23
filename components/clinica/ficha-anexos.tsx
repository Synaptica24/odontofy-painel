"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Image as ImagemIcone, Upload } from "lucide-react";
import { removerAnexo, urlAnexo } from "@/lib/api";
import { enviarAnexo } from "@/lib/clinica-actions";
import type { Anexo, CategoriaAnexo, Prontuario } from "@/lib/contratos";
import { Bloco, Botao, Vazio } from "@/components/ui/primitivos";
import { Chip, dataHoraBonita, tamanhoBonito } from "./ficha-util";

const CATEGORIAS: { valor: CategoriaAnexo; rotulo: string }[] = [
  { valor: "raio_x", rotulo: "Raio-X" }, { valor: "foto", rotulo: "Foto" }, { valor: "exame", rotulo: "Exame" }, { valor: "documento", rotulo: "Documento" }, { valor: "outro", rotulo: "Outro" },
];
const ACEITA = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const LIMITE = 25 * 1024 * 1024;

function Miniatura({ anexo }: { anexo: Anexo }) {
  const [url, setUrl] = useState<string | null>(null);
  const ehImagem = anexo.tipo_mime.startsWith("image/") && anexo.tipo_mime !== "image/heic";
  useEffect(() => {
    if (!ehImagem) return;
    let vivo = true;
    void urlAnexo(anexo.id).then((r) => { if (vivo && r.sucesso) setUrl(r.dados.url); });
    return () => { vivo = false; };
  }, [anexo.id, ehImagem]);
  return (
    <div className="anexo__icone">
      {ehImagem && url ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
        <img src={url} alt="" loading="lazy" />
      ) : ehImagem ? <ImagemIcone size={22} /> : <FileText size={22} />}
    </div>
  );
}

export function FichaAnexos({ d, definir }: { d: Prontuario; definir: (fn: (x: Prontuario) => Prontuario) => void }) {
  const [categoria, setCategoria] = useState<CategoriaAnexo>("foto");
  const [enviando, setEnviando] = useState<string[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function enviar(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos);
    for (const arquivo of lista) {
      if (arquivo.size > LIMITE) { toast.error(`${arquivo.name} passa de 25 MB.`); continue; }
      if (!ACEITA.split(",").includes(arquivo.type)) { toast.error(`${arquivo.name}: formato não aceito.`, { description: "Use JPG, PNG, WEBP, HEIC ou PDF." }); continue; }
      setEnviando((x) => [...x, arquivo.name]);
      const form = new FormData();
      form.set("arquivo", arquivo); form.set("paciente_id", d.paciente.id); form.set("categoria", categoria); form.set("descricao", "");
      const res = await enviarAnexo(form);
      setEnviando((x) => x.filter((n) => n !== arquivo.name));
      if (!res.sucesso) { toast.error(`${arquivo.name} não subiu.`, { description: res.erro.mensagem }); continue; }
      definir((x) => ({ ...x, anexos: [res.dados, ...x.anexos] }));
      toast.success(`${arquivo.name} anexado.`);
    }
  }
  async function abrir(a: Anexo) {
    const res = await urlAnexo(a.id);
    if (!res.sucesso) { toast.error("Não foi possível abrir.", { description: res.erro.mensagem }); return; }
    window.open(res.dados.url, "_blank", "noopener");
  }
  async function excluir(a: Anexo) {
    setConfirmando(null);
    definir((x) => ({ ...x, anexos: x.anexos.filter((o) => o.id !== a.id) }));
    const res = await removerAnexo(a.id);
    if (!res.sucesso) { definir((x) => ({ ...x, anexos: [a, ...x.anexos] })); toast.error("Não excluiu.", { description: res.erro.mensagem }); return; }
    toast.success("Anexo excluído.");
  }

  return (
    <>
      <Bloco titulo="Enviar arquivos" id="upload" primeiro>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[13px] text-tinta-2">Tipo:</span>
            {CATEGORIAS.map((c) => (
              <button key={c.valor} type="button" className={`chip pressa ${categoria === c.valor ? "chip--azul" : ""}`} aria-pressed={categoria === c.valor} onClick={() => setCategoria(c.valor)}>{c.rotulo}</button>
            ))}
          </div>
          <div
            className="zona-upload"
            data-ativo={arrastando ? "" : undefined}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void enviar(e.dataTransfer.files); }}
            onClick={() => input.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
          >
            <Upload size={20} className="mx-auto mb-1" aria-hidden />
            <b>Toque para escolher</b> ou arraste aqui.<br />
            <span className="text-tinta-3">JPG, PNG, WEBP, HEIC ou PDF até 25 MB. Vai direto para o armazenamento privado do consultório.</span>
            <input ref={input} type="file" multiple accept={ACEITA} className="hidden" onChange={(e) => { if (e.target.files) void enviar(e.target.files); e.target.value = ""; }} />
          </div>
          {enviando.length > 0 && (
            <ul className="text-[13px] text-tinta-2">
              {enviando.map((n) => <li key={n} className="flex items-center gap-2"><span className="osso h-3 w-24 inline-block rounded" /> enviando {n}…</li>)}
            </ul>
          )}
        </div>
      </Bloco>
      <Bloco titulo="Anexos" id="anexos" lado={`${d.anexos.length}`}>
        {d.anexos.length === 0 ? (
          <Vazio titulo="Nenhum anexo." sub="Raio-X, fotos e documentos ficam aqui, só para quem tem acesso a esta ficha." />
        ) : (
          <div className="anexos">
            {d.anexos.map((a) => (
              <div key={a.id} className="anexo entra">
                <button type="button" className="text-left" onClick={() => abrir(a)} aria-label={`Abrir ${a.nome}`}>
                  <Miniatura anexo={a} />
                </button>
                <Chip>{CATEGORIAS.find((c) => c.valor === a.categoria)?.rotulo}</Chip>
                <b title={a.nome}>{a.nome}</b>
                <small className="num">{tamanhoBonito(a.tamanho)} · {dataHoraBonita(a.criado_em)}</small>
                <div className="flex gap-1 flex-wrap">
                  <Botao onClick={() => abrir(a)} className="a-botao--mini">Abrir</Botao>
                  {confirmando === a.id ? (
                    <>
                      <Botao alerta onClick={() => excluir(a)} className="a-botao--mini">Confirmar</Botao>
                      <Botao onClick={() => setConfirmando(null)} className="a-botao--mini">Não</Botao>
                    </>
                  ) : (
                    <Botao onClick={() => setConfirmando(a.id)} className="a-botao--mini">Excluir</Botao>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Bloco>
    </>
  );
}
