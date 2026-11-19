// Lançamento rápido: transforma "uber 18,50 nubank" num rascunho de lançamento.
// Regras simples (regex + dicionário), sem IA. Ver CLAUDE.md, seção 6.
import type { Cartao, Categoria, Centavos, Certeza, Conta, DataISO, FonteRenda, Frequencia, Id, Lancamento } from '../tipos';
import { paraISO, somarDias } from './datas';
import { textoParaCentavos } from './dinheiro';
import { statusSugerido } from './lancamentos';
import { NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA } from './padroes';
import { normalizar } from './texto';

export interface ContextoParser {
  hoje: DataISO;
  categorias: Categoria[];
  cartoes: Cartao[];
  contas: Conta[];
  fontes: FonteRenda[];
  contaPadraoId?: Id;
}

export interface Rascunho {
  tipo: 'entrada' | 'saida';
  valor: Centavos | null;
  descricao: string;
  data: DataISO;
  categoriaId?: Id;
  /** false quando nenhuma palavra combinou e caiu em "Outros": a tela pede confirmação. */
  categoriaConfiante: boolean;
  contaId?: Id;
  cartaoId?: Id;
  parcelas: number;
  certeza: Certeza;
  status: Lancamento['status'];
  fonteRendaId?: Id;
  frequencia?: Frequencia;
  /** Quantas vezes repete (com frequência). null = sem fim. */
  vezes?: number | null;
  /** Entrada repetida: certeza das próximas vezes (comissão futura costuma ser provável). */
  certezaProximas?: Certeza;
  /** Palavra que o app aprende se você trocar a categoria. */
  palavra?: string;
}

interface Token { orig: string; norm: string; usado: boolean }

function tokenizar(texto: string): Token[] {
  return texto.trim().split(/\s+/).filter(Boolean).map((bruto) => {
    // tira pontuação do fim ("almoço," → "almoço"), mas não mexe em números ("32,50")
    const orig = bruto.replace(/[;:!?"()]+/g, '').replace(/[,.]+$/, '');
    return { orig, norm: normalizar(orig), usado: false };
  }).filter((t) => t.norm);
}

/** Procura uma sequência de palavras (já normalizadas) entre os tokens livres. Devolve o índice ou -1. */
function achar(ts: Token[], frase: string, marcar = true): number {
  const partes = frase.split(' ').filter(Boolean);
  if (!partes.length) return -1;
  for (let i = 0; i + partes.length <= ts.length; i++) {
    if (partes.every((p, k) => !ts[i + k].usado && ts[i + k].norm === p)) {
      if (marcar) for (let k = 0; k < partes.length; k++) ts[i + k].usado = true;
      return i;
    }
  }
  return -1;
}

const algum = (ts: Token[], frases: string[], marcar = true) => frases.some((f) => achar(ts, f, marcar) >= 0);

/** Valor do token: aceita 32 · 32,50 · 1.200 · 1.200,50 · R$32 · e também 18.50 (ponto decimal do teclado). */
function valorDoToken(t: string): Centavos | null {
  const v = textoParaCentavos(t);
  if (v !== null) return v;
  const m = /^(?:r\$)?(\d+)\.(\d{1,2})$/.exec(t);
  return m ? Number(m[1]) * 100 + Number(m[2].padEnd(2, '0')) : null;
}

const PALAVRAS_SOLTAS = new Set(['no', 'na', 'num', 'numa', 'em', 'de', 'do', 'da', 'com', 'pro', 'pra', 'para', 'o', 'a', 'os', 'as', 'um', 'uma', 'reais', 'r$', 'e']);

export function interpretar(texto: string, ctx: ContextoParser): Rascunho {
  const ts = tokenizar(texto);

  // 1. Tipo e certeza pelas palavras de ação.
  let tipo: 'entrada' | 'saida' | null = null;
  let certeza: Certeza = 'garantida';
  let jaCaiu = false;
  if (algum(ts, ['vou receber', 'vai cair', 'a receber', 'vou ganhar', 'vai entrar'])) { tipo = 'entrada'; certeza = 'provavel'; }
  else if (algum(ts, ['talvez receba', 'pode cair', 'pode entrar', 'possivel'])) { tipo = 'entrada'; certeza = 'possivel'; }
  else if (algum(ts, ['recebi', 'entrou', 'ganhei', 'caiu'])) { tipo = 'entrada'; jaCaiu = true; }
  else if (algum(ts, ['gastei', 'paguei', 'comprei', 'gasto'])) tipo = 'saida';
  if (tipo === null && achar(ts, 'salario', false) >= 0) tipo = 'entrada';

  // 2. Repetição: "toda semana", "a cada 15 dias", "todo mês", "10 vezes".
  let frequencia: Frequencia | undefined;
  if (algum(ts, ['toda semana', 'todas as semanas', 'semanal', 'semanalmente', 'por semana'])) frequencia = 'semanal';
  else if (algum(ts, ['a cada 15 dias', 'de 15 em 15 dias', 'quinzenal', 'quinzenalmente'])) frequencia = 'quinzenal';
  else if (algum(ts, ['todo mes', 'todos os meses', 'mensal', 'mensalmente', 'por mes'])) frequencia = 'mensal';

  // 3. Parcelas ("3x", "3 x", "em 3 vezes") e "N vezes".
  let parcelas = 1;
  let vezes: number | undefined;
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.usado) continue;
    const mx = /^(\d{1,2})x$/.exec(t.norm);
    if (mx) { parcelas = Number(mx[1]); t.usado = true; continue; }
    const prox = ts[i + 1];
    if (/^\d{1,2}$/.test(t.norm) && prox && !prox.usado && (prox.norm === 'x' || prox.norm === 'vezes')) {
      if (prox.norm === 'x') parcelas = Number(t.norm); else vezes = Number(t.norm);
      t.usado = prox.usado = true;
      if (i > 0 && ts[i - 1].norm === 'em') ts[i - 1].usado = true;
    }
  }
  algum(ts, ['parcelado', 'parcelada']); // só tira da descrição

  // 4. Data: hoje (padrão), ontem, anteontem, amanhã, dd/mm, "dia 15".
  let data = ctx.hoje;
  if (achar(ts, 'anteontem') >= 0) data = somarDias(ctx.hoje, -2);
  else if (achar(ts, 'ontem') >= 0) data = somarDias(ctx.hoje, -1);
  else if (achar(ts, 'amanha') >= 0) data = somarDias(ctx.hoje, 1);
  else achar(ts, 'hoje');
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i];
    if (t.usado) continue;
    const md = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/.exec(t.norm);
    if (md) {
      const ano = md[3] ? (md[3].length === 2 ? 2000 + Number(md[3]) : Number(md[3])) : Number(ctx.hoje.slice(0, 4));
      const d = new Date(ano, Number(md[2]) - 1, Number(md[1]));
      if (d.getMonth() === Number(md[2]) - 1) { data = paraISO(d); t.usado = true; }
      continue;
    }
    if (t.norm === 'dia' && ts[i + 1] && /^\d{1,2}$/.test(ts[i + 1].norm) && !ts[i + 1].usado) {
      const dia = Number(ts[i + 1].norm);
      const d = new Date(Number(ctx.hoje.slice(0, 4)), Number(ctx.hoje.slice(5, 7)) - 1, dia);
      if (dia >= 1 && d.getDate() === dia) { data = paraISO(d); t.usado = ts[i + 1].usado = true; }
    }
  }

  // 5. Valor: o primeiro número que sobrou.
  let valor: Centavos | null = null;
  for (const t of ts) {
    if (t.usado || !/\d/.test(t.norm)) continue;
    const v = valorDoToken(t.norm);
    if (v !== null && v > 0) { valor = v; t.usado = true; break; }
  }

  // 6. Fonte de renda pelo nome ("comissão"): sugere entrada.
  const fonte = [...ctx.fontes]
    .sort((a, b) => b.nome.length - a.nome.length)
    .find((f) => achar(ts, normalizar(f.nome), false) >= 0);
  if (tipo === null && fonte) tipo = 'entrada';

  // 7. Categoria: palavra-chave mais longa que combinar. Se só combinar categoria de entrada, é entrada.
  const melhor = (cats: Categoria[]) => {
    let achada: { c: Categoria; tam: number } | null = null;
    for (const c of cats)
      for (const p of c.palavrasChave)
        if (p && achar(ts, p, false) >= 0 && (!achada || p.length > achada.tam)) achada = { c, tam: p.length };
    return achada?.c;
  };
  if (tipo === null && !melhor(ctx.categorias.filter((c) => c.tipo === 'saida')) && melhor(ctx.categorias.filter((c) => c.tipo === 'entrada'))) tipo = 'entrada';
  const tipoFinal = tipo ?? 'saida';
  // Sem verbo ("comissão 1200"): hoje ou antes é o que caiu; data futura usa a certeza de costume da fonte.
  if (tipoFinal === 'entrada' && certeza === 'garantida' && !jaCaiu && data > ctx.hoje) certeza = fonte?.certezaPadrao ?? 'provavel';

  // 8. Onde: entrada vai para conta; saída procura cartão primeiro (nome do cartão no texto).
  let cartaoId: Id | undefined;
  let contaId: Id | undefined;
  const porNome = <T extends { nome: string }>(xs: T[]) =>
    [...xs].sort((a, b) => b.nome.length - a.nome.length).find((x) => achar(ts, normalizar(x.nome)) >= 0);
  if (tipoFinal === 'saida') {
    const cartao = porNome(ctx.cartoes);
    if (cartao) cartaoId = cartao.id;
    else if (algum(ts, ['no credito', 'credito', 'no cartao', 'cartao']) && ctx.cartoes.length === 1) cartaoId = ctx.cartoes[0].id;
    else if (parcelas > 1 && ctx.cartoes.length === 1) cartaoId = ctx.cartoes[0].id;
  }
  if (!cartaoId) {
    const conta = porNome(ctx.contas);
    if (conta) contaId = conta.id;
    else if (algum(ts, ['em dinheiro', 'dinheiro', 'especie'])) contaId = ctx.contas.find((c) => c.tipo === 'carteira')?.id;
    algum(ts, ['no pix', 'pix', 'no debito', 'debito']);
    contaId ??= ctx.contaPadraoId ?? ctx.contas[0]?.id;
  }
  if (!cartaoId) parcelas = 1;
  if (cartaoId && vezes && !frequencia) { parcelas = vezes; vezes = undefined; }

  const cats = ctx.categorias.filter((c) => c.tipo === tipoFinal);
  const achada = melhor(cats) ?? (fonte ? cats.find((c) => normalizar(c.nome) === normalizar(fonte.nome)) : undefined);
  const outros = cats.find((c) => c.nome === (tipoFinal === 'saida' ? NOME_OUTROS_SAIDA : NOME_OUTROS_ENTRADA));

  // 9. Descrição: o que sobrou, sem palavras soltas nas pontas.
  const sobra = ts.filter((t) => !t.usado);
  while (sobra.length && PALAVRAS_SOLTAS.has(sobra[0].norm)) sobra.shift();
  while (sobra.length && PALAVRAS_SOLTAS.has(sobra[sobra.length - 1].norm)) sobra.pop();
  let descricao = sobra.map((t) => t.orig).join(' ').trim();
  if (!descricao) descricao = fonte?.nome ?? achada?.nome ?? (tipoFinal === 'entrada' ? 'Entrada' : 'Gasto');
  descricao = descricao[0].toUpperCase() + descricao.slice(1);
  const palavra = sobra.map((t) => t.norm).find((n) => n.length >= 2 && !/\d/.test(n) && !PALAVRAS_SOLTAS.has(n));

  const certezaFinal: Certeza = tipoFinal === 'saida' ? 'garantida' : certeza;
  return {
    tipo: tipoFinal,
    valor,
    descricao,
    data,
    categoriaId: (achada ?? outros)?.id,
    categoriaConfiante: !!achada,
    contaId,
    cartaoId,
    parcelas,
    certeza: certezaFinal,
    status: statusSugerido(data, ctx.hoje, certezaFinal),
    fonteRendaId: tipoFinal === 'entrada' ? fonte?.id : undefined,
    frequencia,
    vezes: frequencia ? vezes ?? null : undefined,
    certezaProximas: frequencia && tipoFinal === 'entrada' ? (fonte?.certezaPadrao ?? 'garantida') : undefined,
    palavra,
  };
}

/**
 * O app aprende: põe a palavra na categoria escolhida e tira das outras do mesmo tipo.
 * Devolve só as categorias que mudaram.
 */
export function aprenderPalavra(categorias: Categoria[], palavra: string, categoriaId: Id): Categoria[] {
  const p = normalizar(palavra);
  const alvo = categorias.find((c) => c.id === categoriaId);
  if (!p || !alvo) return [];
  const mudadas: Categoria[] = [];
  for (const c of categorias) {
    if (c.tipo !== alvo.tipo) continue;
    if (c.id === categoriaId && !c.palavrasChave.includes(p)) mudadas.push({ ...c, palavrasChave: [...c.palavrasChave, p] });
    else if (c.id !== categoriaId && c.palavrasChave.includes(p)) mudadas.push({ ...c, palavrasChave: c.palavrasChave.filter((x) => x !== p) });
  }
  return mudadas;
}
