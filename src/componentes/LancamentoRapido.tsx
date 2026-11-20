// Campo único: você digita como fala ("uber 18,50 nubank") e confere a pré-visualização antes de lançar.
import { useMemo, useState, type ReactNode } from 'react';
import type { Cadastros } from '../data/useCadastros';
import { criarLancamento, ensinarCategoria, verificarLimite, type AvisoComCategoria } from '../data/servicos';
import { AvisoLimite } from './AvisoLimite';
import { formatarData, hojeISO, somarDias } from '../calculos/datas';
import { dividirCentavos, formatarReais } from '../calculos/dinheiro';
import { statusSugerido } from '../calculos/lancamentos';
import { NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA } from '../calculos/padroes';
import { interpretar, type Rascunho } from '../calculos/parser';
import { ROTULO_FREQUENCIA } from '../calculos/recorrencias';
import { faturaDaCompra, vencimentoDaFatura } from '../calculos/cartao';
import type { Lancamento } from '../tipos';
import type { InicialLancamento } from './lancamentos';

type Seletor = 'categoria' | 'onde' | 'data' | 'parcelas' | null;
const EXEMPLOS = ['almoço 32', 'uber 18,50 nubank', 'recebi 1200 comissão', 'mercado 150 ontem'];

function Chip({ children, ativo, alerta, aoTocar, rotulo }: { children: ReactNode; ativo?: boolean; alerta?: boolean; aoTocar: () => void; rotulo: string }) {
  return (
    <button type="button" onClick={aoTocar} aria-label={rotulo} aria-expanded={ativo}
      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-bold transition ${
        ativo ? 'border-texto bg-texto text-fundo' : alerta ? 'border-alerta bg-saldo-apertado text-texto' : 'border-borda bg-superficie text-texto'}`}>
      {children}
      <span aria-hidden="true" className="text-[10px] opacity-60">▾</span>
    </button>
  );
}

export function LancamentoRapido({ cad, aoDetalhes, autoFocus }: {
  cad: Cadastros; aoDetalhes: (inicial: InicialLancamento) => void; autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState('');
  const [ajuste, setAjuste] = useState<Partial<Rascunho>>({});
  const [aberto, setAberto] = useState<Seletor>(null);
  const [feito, setFeito] = useState<{ texto: string; desfazer: () => Promise<void> } | null>(null);
  const [erro, setErro] = useState('');
  const [avisoLimite, setAvisoLimite] = useState<AvisoComCategoria | null>(null);
  const hoje = hojeISO();

  const lido = useMemo(() => (texto.trim() ? interpretar(texto, {
    hoje, categorias: cad.categorias, cartoes: cad.cartoes, contas: cad.contas, fontes: cad.fontes, contaPadraoId: cad.contaPadraoId,
  }) : null), [texto, cad, hoje]);
  const r = lido ? { ...lido, ...ajuste } : null;

  function mudarTexto(t: string) {
    setTexto(t); setAjuste({}); setAberto(null); setErro(''); setAvisoLimite(null); if (t) setFeito(null);
  }
  const ajustar = (a: Partial<Rascunho>) => { setAjuste((x) => ({ ...x, ...a })); setAberto(null); };
  const alternar = (s: Seletor) => setAberto((x) => (x === s ? null : s));

  function paraLancamento(x: Rascunho): Omit<Lancamento, 'id'> {
    const d: Omit<Lancamento, 'id'> = {
      tipo: x.tipo, valor: x.valor ?? 0, data: x.data, descricao: x.descricao, certeza: 'garantida',
      status: statusSugerido(x.data, hoje, 'garantida'),
    };
    if (x.categoriaId) d.categoriaId = x.categoriaId;
    if (x.cartaoId && x.tipo === 'saida') d.cartaoId = x.cartaoId; else if (x.contaId) d.contaId = x.contaId;
    if (x.fonteRendaId && x.tipo === 'entrada') d.fonteRendaId = x.fonteRendaId;
    return d;
  }

  async function lancar(confirmouLimite = false) {
    if (!r) return;
    if (!r.valor) { setErro('Falta o valor. Ex.: almoço 32'); return; }
    if (!r.contaId && !r.cartaoId) { setErro('Cadastre uma conta em Configurações antes de lançar.'); return; }
    if (r.tipo === 'saida' && !confirmouLimite) {
      const parcelas = r.cartaoId ? r.parcelas : 1;
      const aviso = await verificarLimite(r.categoriaId, r.data, parcelas > 1 ? dividirCentavos(r.valor, parcelas)[0] : r.valor);
      if (aviso) { setAvisoLimite(aviso); return; }
    }
    setAvisoLimite(null);
    const dados = paraLancamento(r);
    const desfazer = await criarLancamento(dados, {
      parcelas: r.cartaoId ? r.parcelas : 1,
      repeticao: r.frequencia ? { frequencia: r.frequencia, vezes: r.vezes ?? null } : undefined,
    });
    // O app aprende: se você escolheu a categoria, a palavra passa a apontar para ela.
    if (ajuste.categoriaId && lido?.palavra && (ajuste.categoriaId !== lido.categoriaId || !lido.categoriaConfiante))
      await ensinarCategoria(lido.palavra, ajuste.categoriaId);
    const sinal = r.tipo === 'entrada' ? '+' : '−';
    setFeito({ texto: `${r.descricao} ${sinal}${formatarReais(r.valor)}`, desfazer });
    setTexto(''); setAjuste({}); setAberto(null);
  }

  function detalhes() {
    if (!r) return aoDetalhes({});
    aoDetalhes({ ...paraLancamento(r), valor: r.valor ?? 0, parcelas: r.parcelas, frequencia: r.frequencia, vezes: r.vezes ?? null });
  }

  const cat = r ? cad.categoria(r.categoriaId) : undefined;
  const cartao = r?.tipo === 'saida' ? cad.cartao(r.cartaoId) : undefined;
  const conta = cad.conta(r?.contaId);
  const catsDoTipo = r ? cad.categorias.filter((c) => c.tipo === r.tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : [];
  const rotuloData = r ? (r.data === hoje ? 'Hoje' : r.data === somarDias(hoje, -1) ? 'Ontem' : formatarData(r.data).slice(0, 5)) : '';
  const pedirCategoria = r && !r.categoriaConfiante && !ajuste.categoriaId;

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={(e) => { e.preventDefault(); lancar(); }}>
        <label htmlFor="lancamento-rapido" className="sr-only">Lançamento rápido</label>
        <input id="lancamento-rapido" value={texto} onChange={(e) => mudarTexto(e.target.value)} autoFocus={autoFocus}
          enterKeyHint="send" autoComplete="off" autoCorrect="off" spellCheck={false}
          placeholder="Digite como fala: almoço 32"
          className="w-full rounded-2xl border-2 border-borda bg-superficie px-4 py-3.5 text-lg font-semibold text-texto placeholder:font-normal placeholder:text-texto-2/70 focus:border-destaque focus:outline-none" />
      </form>

      {!r && !feito && (
        <div className="flex flex-wrap gap-1.5">
          {EXEMPLOS.map((e) => (
            <button key={e} type="button" onClick={() => mudarTexto(e)} className="rounded-full bg-superficie-2 px-3 py-1.5 text-sm text-texto-2">{e}</button>
          ))}
        </div>
      )}

      {feito && !r && (
        <div role="status" className="flex items-center gap-3 rounded-2xl bg-saldo-ok px-4 py-3">
          <span aria-hidden="true" className="text-lg">✓</span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">Lançado: {feito.texto}</span>
          <button type="button" onClick={async () => { await feito.desfazer(); setFeito(null); }} className="shrink-0 text-sm font-bold text-destaque">Desfazer</button>
        </div>
      )}

      {r && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button type="button" onClick={() => {
                const tipo = r.tipo === 'saida' ? 'entrada' : 'saida';
                const outros = cad.categorias.find((c) => c.tipo === tipo && c.nome === (tipo === 'saida' ? NOME_OUTROS_SAIDA : NOME_OUTROS_ENTRADA));
                ajustar({ tipo, categoriaId: outros?.id, categoriaConfiante: false });
              }} className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${r.tipo === 'entrada' ? 'bg-saldo-ok text-entrada' : 'bg-superficie-2 text-texto-2'}`}
                aria-label={`Tipo: ${r.tipo === 'entrada' ? 'entrada' : 'gasto'}. Toque para trocar`}>
                {r.tipo === 'entrada' ? 'Entrada' : 'Gasto'} ⇄
              </button>
              <p className="mt-1.5 truncate text-base font-bold">{r.descricao}</p>
            </div>
            <p className={`shrink-0 text-right text-2xl font-extrabold tabular-nums ${r.valor ? (r.tipo === 'entrada' ? 'text-entrada' : '') : 'text-texto-2/50'}`}>
              {r.valor ? `${r.tipo === 'entrada' ? '+' : '−'}${formatarReais(r.valor)}` : 'R$ ?'}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Chip rotulo="Categoria" ativo={aberto === 'categoria'} alerta={!!pedirCategoria} aoTocar={() => alternar('categoria')}>
              <span aria-hidden="true">{cat?.icone}</span>{cat?.nome ?? 'Categoria'}
            </Chip>
            <Chip rotulo="Onde" ativo={aberto === 'onde'} aoTocar={() => alternar('onde')}>
              {cartao ? `Cartão ${cartao.nome}` : conta?.nome ?? 'Conta'}
            </Chip>
            <Chip rotulo="Data" ativo={aberto === 'data'} aoTocar={() => alternar('data')}>{rotuloData}</Chip>
            {cartao && (
              <Chip rotulo="Parcelas" ativo={aberto === 'parcelas'} aoTocar={() => alternar('parcelas')}>
                {r.parcelas > 1 ? `${r.parcelas}× de ${formatarReais(dividirCentavos(r.valor ?? 0, r.parcelas)[0])}` : 'À vista'}
              </Chip>
            )}
            {r.frequencia && (
              <span className="rounded-full bg-superficie-2 px-3 py-1.5 text-sm font-bold">
                {ROTULO_FREQUENCIA[r.frequencia]}{r.vezes ? ` · ${r.vezes}×` : ''}
              </span>
            )}
          </div>
          {cartao && (
            <p className="-mt-1 text-sm text-texto-2">
              {r.parcelas > 1 ? '1ª parcela na fatura' : 'Cai na fatura'} que vence em{' '}
              <b className="text-texto">{formatarData(vencimentoDaFatura(faturaDaCompra(r.data, cartao.diaFechamento), cartao))}</b>.
            </p>
          )}
          {pedirCategoria && aberto !== 'categoria' && (
            <p className="-mt-1 text-sm text-texto-2">Não reconheci a categoria. Toque nela para escolher; o app aprende para a próxima.</p>
          )}

          {aberto === 'categoria' && (
            <div className="grid grid-cols-2 gap-1.5">
              {catsDoTipo.map((c) => (
                <button key={c.id} type="button" onClick={() => ajustar({ categoriaId: c.id, categoriaConfiante: true })}
                  className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-bold ${c.id === r.categoriaId ? 'bg-texto text-fundo' : 'bg-superficie-2'}`}>
                  <span aria-hidden="true">{c.icone}</span><span className="truncate">{c.nome}</span>
                </button>
              ))}
            </div>
          )}
          {aberto === 'onde' && (
            <div className="flex flex-wrap gap-1.5">
              {cad.contas.map((c) => (
                <button key={c.id} type="button" onClick={() => ajustar({ contaId: c.id, cartaoId: undefined, parcelas: 1 })}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${!cartao && c.id === r.contaId ? 'bg-texto text-fundo' : 'bg-superficie-2'}`}>{c.nome}</button>
              ))}
              {r.tipo === 'saida' && cad.cartoes.map((c) => (
                <button key={c.id} type="button" onClick={() => ajustar({ cartaoId: c.id, contaId: undefined })}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${c.id === r.cartaoId ? 'bg-texto text-fundo' : 'bg-superficie-2'}`}>Cartão {c.nome}</button>
              ))}
            </div>
          )}
          {aberto === 'data' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {[[hoje, 'Hoje'], [somarDias(hoje, -1), 'Ontem'], [somarDias(hoje, -2), 'Anteontem']].map(([d, t]) => (
                <button key={d} type="button" onClick={() => ajustar({ data: d })}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ${d === r.data ? 'bg-texto text-fundo' : 'bg-superficie-2'}`}>{t}</button>
              ))}
              <input type="date" aria-label="Outra data" value={r.data} onChange={(e) => e.target.value && ajustar({ data: e.target.value })}
                className="rounded-full border border-borda bg-superficie px-3 py-1 text-base" />
            </div>
          )}
          {aberto === 'parcelas' && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button" onClick={() => ajustar({ parcelas: n })}
                  className={`h-9 min-w-9 rounded-full px-2.5 text-sm font-bold ${n === r.parcelas ? 'bg-texto text-fundo' : 'bg-superficie-2'}`}>{n === 1 ? 'À vista' : `${n}x`}</button>
              ))}
            </div>
          )}

          {erro && <p className="text-sm font-semibold text-saida">{erro}</p>}
          {avisoLimite ? (
            <AvisoLimite aviso={avisoLimite} aoVoltar={() => setAvisoLimite(null)} aoContinuar={() => lancar(true)} />
          ) : (
          <div className="flex gap-2">
            <button type="button" onClick={detalhes} className="flex-1 rounded-2xl bg-superficie-2 py-3 font-bold">Mais detalhes</button>
            <button type="button" onClick={() => lancar()} disabled={!r.valor} className="flex-[2] rounded-2xl bg-texto py-3 font-bold text-fundo disabled:opacity-40">
              {r.tipo === 'entrada' ? 'Lançar entrada' : 'Lançar gasto'}
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
