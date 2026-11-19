import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { FormCartao } from '../componentes/formularios';
import { FormLancamento, LinhaLancamento } from '../componentes/lancamentos';
import { Folha } from '../componentes/ui';
import { desfazerPagamentoFatura, pagarFatura, resumoDosCartoes, type ResumoCartao } from '../data/servicos';
import { useCadastros, type Cadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { faturaDoLancamento, type Fatura } from '../calculos/cartao';
import { formatarData, hojeISO, nomeDoMes } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { dataDaRecorrencia } from '../calculos/recorrencias';
import { linkPara } from '../navegacao';
import type { Cartao, Lancamento } from '../tipos';

type Aberto =
  | { tipo: 'fatura'; r: ResumoCartao; f: Fatura }
  | { tipo: 'lancamento'; l: Lancamento; volta?: { r: ResumoCartao; f: Fatura } }
  | { tipo: 'compra'; cartao: Cartao }
  | { tipo: 'cartao'; cartao?: Cartao }
  | null;

const nomeFatura = (ref: string) => { const n = nomeDoMes(ref); return n[0].toUpperCase() + n.slice(1); };

function estadoFatura(f: Fatura, c: Cartao): { rotulo: string; cor: string } {
  if (f.total > 0 && f.restante === 0) return { rotulo: 'Paga', cor: 'bg-saldo-ok text-entrada' };
  if (hojeISO() <= dataDaRecorrencia(f.faturaRef, c.diaFechamento)) return { rotulo: 'Aberta', cor: 'bg-superficie-2 text-texto-2' };
  return { rotulo: 'Fechada', cor: 'bg-saldo-apertado text-texto' };
}

export function Cartoes() {
  const resumos = useConsulta(() => resumoDosCartoes(), []);
  const cad = useCadastros();
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);

  // Mantém a fatura aberta atualizada depois de editar/pagar.
  const atual = (r: ResumoCartao, f: Fatura) => {
    const r2 = resumos?.find((x) => x.cartao.id === r.cartao.id) ?? r;
    return { r: r2, f: r2.faturas.find((x) => x.faturaRef === f.faturaRef) ?? f };
  };

  let titulo = '';
  let conteudo = null;
  if (aberto && cad) {
    if (aberto.tipo === 'fatura') {
      const { r, f } = atual(aberto.r, aberto.f);
      titulo = `Fatura de ${nomeFatura(f.faturaRef).toLowerCase()} · ${r.cartao.nome}`;
      conteudo = <DetalheFatura r={r} f={f} cad={cad} aoEditar={(l) => setAberto({ tipo: 'lancamento', l, volta: { r, f } })} />;
    } else if (aberto.tipo === 'lancamento') {
      titulo = 'Editar compra';
      const volta = aberto.volta;
      conteudo = <FormLancamento item={aberto.l} cad={cad} aoFechar={() => setAberto(volta ? { tipo: 'fatura', ...volta } : null)} />;
    } else if (aberto.tipo === 'compra') {
      titulo = `Compra no ${aberto.cartao.nome}`;
      conteudo = <FormLancamento cad={cad} modo="cartao" inicial={{ cartaoId: aberto.cartao.id }} aoFechar={fechar} />;
    } else {
      titulo = aberto.cartao ? 'Editar cartão' : 'Novo cartão';
      conteudo = <FormCartao item={aberto.cartao} aoFechar={fechar} />;
    }
  }

  return (
    <Tela titulo="Cartões" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-5">
        {resumos?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-texto-2">
            Nenhum cartão ainda. Cadastre para as compras caírem sozinhas na fatura certa.
          </p>
        )}
        {resumos?.map((r) => <CartaoResumo key={r.cartao.id} r={r} abrir={setAberto} />)}
        <button type="button" onClick={() => setAberto({ tipo: 'cartao' })}
          className="rounded-2xl border border-dashed border-borda py-3.5 font-bold text-destaque">+ Novo cartão</button>
      </div>
      <Folha aberta={aberto !== null} titulo={titulo} aoFechar={fechar}>{conteudo}</Folha>
    </Tela>
  );
}

function CartaoResumo({ r, abrir }: { r: ResumoCartao; abrir: (a: Aberto) => void }) {
  const { cartao: c, proxima: f } = r;
  const est = estadoFatura(f, c);
  const usoPct = c.limite > 0 ? Math.min(100, Math.round((r.limiteUsado / c.limite) * 100)) : 0;
  const futuras = r.faturas.filter((x) => x.faturaRef > f.faturaRef && x.total > 0).slice(0, 6);
  return (
    <section className="overflow-hidden rounded-2xl border border-borda bg-superficie">
      <div className="flex items-center justify-between bg-cartao/10 px-4 py-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><span aria-hidden="true">💳</span>{c.nome}</h2>
        <button type="button" onClick={() => abrir({ tipo: 'cartao', cartao: c })} className="text-sm font-bold text-destaque">Editar</button>
      </div>

      <button type="button" onClick={() => abrir({ tipo: 'fatura', r, f })} className="block w-full px-4 pt-4 pb-3 text-left">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-texto-2">Fatura de {nomeFatura(f.faturaRef).toLowerCase()}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${est.cor}`}>{est.rotulo}</span>
        </div>
        <p className="mt-1 text-3xl font-extrabold tabular-nums">{formatarReais(f.total)}</p>
        <p className="text-sm text-texto-2">
          vence {formatarData(f.vencimento)}{f.pago > 0 && f.restante > 0 ? ` · falta ${formatarReais(f.restante)}` : ''} · ver compras ›
        </p>
      </button>
      <div className="flex gap-2 px-4 pb-4">
        {f.restante > 0 ? (
          <button type="button" onClick={() => pagarFatura(f)} className="flex-1 rounded-2xl bg-texto py-3 font-bold text-fundo">Marcar como paga</button>
        ) : f.total > 0 ? (
          <button type="button" onClick={() => desfazerPagamentoFatura(f)} className="flex-1 rounded-2xl bg-superficie-2 py-3 font-bold">Desfazer pagamento</button>
        ) : null}
        <button type="button" onClick={() => abrir({ tipo: 'compra', cartao: c })} className="flex-1 rounded-2xl bg-superficie-2 py-3 font-bold">+ Compra</button>
      </div>

      <div className="border-t border-borda px-4 py-3">
        <div className="flex justify-between text-sm">
          <span className="text-texto-2">Limite usado</span>
          <span className="font-bold tabular-nums">{formatarReais(r.limiteUsado)} de {formatarReais(c.limite)}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={usoPct} aria-valuemin={0} aria-valuemax={100} aria-label="Limite usado">
          <div className={`h-full rounded-full ${usoPct >= 90 ? 'bg-saida' : usoPct >= 70 ? 'bg-alerta' : 'bg-cartao'}`} style={{ width: `${usoPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span className="text-texto-2">Disponível</span>
          <span className={`font-bold tabular-nums ${c.limite - r.limiteUsado < 0 ? 'text-saida' : ''}`}>{formatarReais(c.limite - r.limiteUsado)}</span>
        </div>
        <p className="mt-2 text-sm text-texto-2">Melhor dia de compra: <b className="text-texto">dia {r.melhorDia}</b> (fecha dia {c.diaFechamento}, vence dia {c.diaVencimento})</p>
      </div>

      {futuras.length > 0 && (
        <div className="border-t border-borda">
          <p className="px-4 pt-3 pb-1 text-xs font-bold uppercase tracking-wider text-texto-2">Próximas faturas</p>
          <ul>
            {futuras.map((x) => (
              <li key={x.faturaRef}>
                <button type="button" onClick={() => abrir({ tipo: 'fatura', r, f: x })} className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-superficie-2">
                  <span>
                    <span className="block font-bold">{nomeFatura(x.faturaRef)}</span>
                    <span className="block text-xs text-texto-2">vence {formatarData(x.vencimento)}</span>
                  </span>
                  <span className="font-bold tabular-nums">{formatarReais(x.total)} ›</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DetalheFatura({ r, f, cad, aoEditar }: { r: ResumoCartao; f: Fatura; cad: Cadastros; aoEditar: (l: Lancamento) => void }) {
  const compras = r.lancamentos
    .filter((l) => l.tipo === 'saida' && faturaDoLancamento(l, r.cartao) === f.faturaRef)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const pagamentos = r.lancamentos.filter((l) => l.tipo === 'transferencia' && l.faturaRef === f.faturaRef);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between rounded-2xl bg-superficie-2 px-4 py-3">
        <span>
          <span className="block text-sm text-texto-2">Total · vence {formatarData(f.vencimento)}</span>
          <span className="block text-2xl font-extrabold tabular-nums">{formatarReais(f.total)}</span>
        </span>
        {f.restante > 0 ? (
          <button type="button" onClick={() => pagarFatura(f)} className="rounded-full bg-texto px-4 py-2 text-sm font-bold text-fundo">Marcar como paga</button>
        ) : f.total > 0 ? (
          <span className="text-sm font-bold text-entrada">Paga ✓</span>
        ) : null}
      </div>
      {compras.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nenhuma compra nesta fatura.</p>
      ) : (
        <>
          <p className="px-1 text-xs text-texto-2">Toque numa compra para corrigir ou excluir.</p>
          <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
            {compras.map((l) => <LinhaLancamento key={l.id} l={l} cad={cad} aoTocar={() => aoEditar(l)} />)}
          </ul>
        </>
      )}
      {pagamentos.length > 0 && (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {pagamentos.map((l) => <LinhaLancamento key={l.id} l={l} cad={cad} aoTocar={() => aoEditar(l)} />)}
        </ul>
      )}
    </div>
  );
}
