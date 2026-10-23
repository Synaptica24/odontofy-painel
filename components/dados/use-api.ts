"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResultadoApi } from "@/lib/contratos";

export type Estado<T> =
  | { fase: "carregando"; dados: null; erro: null }
  | { fase: "pronto"; dados: T; erro: null }
  | { fase: "erro"; dados: T | null; erro: string };

/**
 * Carrega um ResultadoApi e expõe fase, dados, erro e recarregar.
 * `deps` muda → recarrega. Mantém os dados antigos enquanto recarrega
 * para o layout não pular.
 */
export function useApi<T>(
  carregar: () => Promise<ResultadoApi<T>>,
  deps: unknown[] = [],
) {
  const [estado, setEstado] = useState<Estado<T>>({ fase: "carregando", dados: null, erro: null });
  const versao = useRef(0);
  const carregarRef = useRef(carregar);
  useEffect(() => {
    carregarRef.current = carregar;
  });
  const chave = JSON.stringify(deps);

  const executar = useCallback(async () => {
    const minha = ++versao.current;
    const resultado = await carregarRef.current().catch(
      (): ResultadoApi<T> => ({
        sucesso: false,
        dados: null,
        erro: { codigo: "indisponivel", mensagem: "Sem conexão agora. Tente de novo em instantes." },
      }),
    );
    if (minha !== versao.current) return;
    setEstado((atual) =>
      resultado.sucesso
        ? { fase: "pronto", dados: resultado.dados, erro: null }
        : { fase: "erro", dados: atual.dados, erro: resultado.erro.mensagem },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    void executar();
  }, [executar]);

  /** Troca os dados na mão, para ação otimista. */
  const definir = useCallback((fn: (atual: T) => T) => {
    setEstado((atual) => (atual.dados ? { fase: "pronto", dados: fn(atual.dados), erro: null } : atual));
  }, []);

  return { ...estado, recarregar: executar, definir };
}
