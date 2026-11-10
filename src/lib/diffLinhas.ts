/**
 * Diff por linhas (LCS) entre dois textos. Devolve só os trechos alterados,
 * no formato que o cartão de proposta exibe ({ buscar: antes, substituir: depois }).
 */
export type TrechoAlterado = { buscar: string; substituir: string; edicao_completa: true };

export function diffLinhas(antigo: string, novo: string): TrechoAlterado[] {
  const a = antigo.split('\n');
  const b = novo.split('\n');

  // corta prefixo/sufixo iguais para o LCS ficar pequeno
  let ini = 0;
  while (ini < a.length && ini < b.length && a[ini] === b[ini]) ini++;
  let fa = a.length;
  let fb = b.length;
  while (fa > ini && fb > ini && a[fa - 1] === b[fb - 1]) {
    fa--;
    fb--;
  }
  const A = a.slice(ini, fa);
  const B = b.slice(ini, fb);
  const n = A.length;
  const m = B.length;

  // tabela LCS (de trás pra frente)
  const L = new Uint32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i * w + j] = A[i] === B[j] ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
    }
  }

  const trechos: TrechoAlterado[] = [];
  let rem: string[] = [];
  let add: string[] = [];
  const fechar = () => {
    if (rem.length || add.length) trechos.push({ buscar: rem.join('\n'), substituir: add.join('\n'), edicao_completa: true });
    rem = [];
    add = [];
  };

  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) {
      fechar();
      i++;
      j++;
    } else if (j < m && (i >= n || L[i * w + j + 1] >= L[(i + 1) * w + j])) {
      add.push(B[j++]);
    } else {
      rem.push(A[i++]);
    }
  }
  fechar();
  return trechos;
}
