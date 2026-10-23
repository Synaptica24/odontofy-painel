'use server';

import { executarOperacao } from './servidor/painel';

/** Também atende chamadas de lib/api em Server Components; autentica toda execução. */
export async function operacaoPainel(operacao: string, argumentos: Record<string, unknown> = {}) {
  return executarOperacao(operacao, argumentos);
}
