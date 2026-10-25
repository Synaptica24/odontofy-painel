'use server';

import { executarOperacao } from './servidor/painel';

/** Também atende chamadas de lib/api em Server Components; autentica toda execução. */
export async function operacaoPainel(operacao: string, argumentos: Record<string, unknown> = {}) {
  return executarOperacao(operacao, argumentos);
}

/** Lote: o navegador executa server actions uma de cada vez, então lib/api junta as chamadas feitas no mesmo
 *  instante e manda aqui. Cada item continua autenticado e isolado (um erro não derruba os outros). */
export async function operacaoPainelLote(itens: { operacao: string; argumentos?: Record<string, unknown> }[]) {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 25) {
    return [{ sucesso: false, dados: null, erro: { codigo: 'validacao', mensagem: 'Revise os campos informados.' } }];
  }
  return Promise.all(itens.map((i) => executarOperacao(String(i?.operacao ?? ''), i?.argumentos ?? {})));
}
