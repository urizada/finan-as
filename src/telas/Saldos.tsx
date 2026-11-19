// Saldos: onde você anota. Cada dia é um bloco com as linhas Entradas · Fixos · Dia a dia · Economia · Cartão
// e o saldo previsto do dia ao lado. Tocar numa linha mostra o que foi lançado e permite lançar ali mesmo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FormEconomia } from '../componentes/FormEconomia';
import { FormRecorrencia } from '../componentes/formularios';
import { IconeSaldos, IconeSeta, IconeVoltar } from '../componentes/Icones';
import { FormLancamento, LinhaLancamento, rotuloDia } from '../componentes/lancamentos';
import { Folha } from '../componentes/ui';
import { desfazerPagamentoFatura, gradeDoMes, pagarFatura } from '../data/servicos';
import { useCadastros, type Cadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import type { Fatura } from '../calculos/cartao';
import { hojeISO, mesDe, somarMeses } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { custoFixoMensal } from '../calculos/recorrencias';
import { corDoSaldo, linhaDoLancamento, type CorSaldo, type LinhaDia, type SaldoDia } from '../calculos/saldos';
import { consumirDiaPendente, linkPara } from '../navegacao';
import type { Lancamento } from '../tipos';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const LINHAS: { id: LinhaDia; rotulo: string; icone: string; cor: string; adicionar: string }[] = [
  { id: 'entradas', rotulo: 'Entradas', icone: '↙', cor: 'var(--color-entrada)', adicionar: 'Lançar entrada' },
  { id: 'fixos', rotulo: 'Fixos', icone: 'F', cor: 'var(--color-alerta)', adicionar: 'Novo fixo' },
  { id: 'diario', rotulo: 'Dia a dia', icone: 'D', cor: 'var(--color-saida)', adicionar: 'Lançar gasto' },
  { id: 'economia', rotulo: 'Economia', icone: 'E', cor: 'var(--color-destaque)', adicionar: 'Guardar dinheiro' },
  { id: 'cartao', rotulo: 'Cartão', icone: 'C', cor: 'var(--color-cartao)', adicionar: 'Compra no cartão' },
];

export const FUNDO_COR: Record<CorSaldo, string> = {
  forte: 'bg-h-forte', bom: 'bg-h-bom', apertado: 'bg-h-apertado', 'pouco-negativo': 'bg-h-pouco', negativo: 'bg-h-negativo',
};

type Filtro = 'todas' | LinhaDia;
type Aberto = { data: string; linha: Filtro; modo: 'lista' | 'novo' | { editar: Lancamento } } | null;

const valorDaLinha = (d: SaldoDia, l: LinhaDia) =>
  l === 'entradas' ? d.entradas : l === 'fixos' ? d.fixos : l === 'diario' ? d.diario : l === 'economia' ? d.economia : d.faturas;

export function Saldos() {
  const hoje = hojeISO();
  const pendente = useRef(consumirDiaPendente());
  const [mes, setMes] = useState(mesDe(pendente.current ?? hoje));
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [vazias, setVazias] = useState(false);
  const [aberto, setAberto] = useState<Aberto>(null);
  const grade = useConsulta(() => gradeDoMes(mes), [mes]);
  const cad = useCadastros();
  const alvo = useRef<HTMLLIElement>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const referencia = cad ? custoFixoMensal(cad.recorrencias) : 0;
  const diaAlvo = pendente.current && mesDe(pendente.current) === mes ? pendente.current : mes === mesDe(hoje) ? hoje : null;

  useEffect(() => {
    if (grade && diaAlvo) alvo.current?.scrollIntoView({ block: 'start' });
    // só ao abrir o mês
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, !!grade]);

  const linhas = filtro === 'todas' ? LINHAS : LINHAS.filter((l) => l.id === filtro);
  const diaHoje = grade?.dias.find((d) => d.data === hoje);
  const ultimo = grade?.dias[grade.dias.length - 1];
  const [a, m] = mes.split('-').map(Number);

  return (
    <main className="mx-auto max-w-md pb-28">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 border-b border-borda bg-fundo px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setMes(mesDe(hoje))} aria-label="Ir para hoje"
            className="flex h-10 w-10 flex-col items-center justify-center overflow-hidden rounded-lg border border-borda bg-superficie text-sm font-bold leading-none">
            <span className="h-1.5 w-full bg-saida" />
            <span className="flex-1 pt-1">{Number(hoje.slice(8, 10))}</span>
          </button>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Mês anterior" onClick={() => setMes(somarMeses(mes, -1))} className="rounded-full p-2"><IconeVoltar className="h-5 w-5" /></button>
            <span className="min-w-24 text-center text-xl font-extrabold">{MESES[m - 1]}/{String(a).slice(2)}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => setMes(somarMeses(mes, 1))} className="rounded-full p-2"><IconeSeta className="h-5 w-5" /></button>
          </div>
          <a href={linkPara('horizonte')} aria-label="Horizonte de saldos: vários meses"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-h-apertado text-texto"><IconeSaldos className="h-6 w-6" /></a>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <label className="relative">
            <span className="sr-only">Mostrar</span>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)}
              className="appearance-none rounded-full border border-borda bg-superficie py-1.5 pr-8 pl-3.5 text-sm font-bold">
              <option value="todas">Todas</option>
              {LINHAS.map((l) => <option key={l.id} value={l.id}>{l.rotulo}</option>)}
            </select>
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-texto-2">▾</span>
          </label>
          {filtro === 'todas' && (
            <button type="button" onClick={() => setVazias((v) => !v)} aria-pressed={vazias}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${vazias ? 'border-texto bg-texto text-fundo' : 'border-borda bg-superficie text-texto-2'}`}>
              {vazias ? 'Todas as linhas' : 'Só com valor'}
            </button>
          )}
          <p className="text-right text-xs leading-tight text-texto-2">
            {diaHoje && diaHoje.saldo !== null && <>hoje <b className="text-texto">{formatarReais(diaHoje.saldo)}</b> · </>}
            fim do mês <b className={ultimo?.saldo !== undefined && ultimo.saldo !== null && ultimo.saldo < 0 ? 'text-saida' : 'text-texto'}>{ultimo?.saldo == null ? '—' : formatarReais(ultimo.saldo)}</b>
          </p>
        </div>
      </header>

      <ol>
        {grade?.dias.map((d) => {
          const ehHoje = d.data === hoje;
          const semana = new Date(a, m - 1, d.dia).getDay();
          const passou = d.data < hoje;
          const pendenteNoDia = grade.lancamentos.some((l) => l.data === d.data && l.status === 'previsto' && l.tipo !== 'entrada' && !l.cartaoId);
          const cor = d.saldo !== null && d.estado ? corDoSaldo(d.saldo, d.estado, referencia) : null;
          return (
            <li key={d.data} ref={d.data === diaAlvo ? alvo : undefined} className="grid scroll-mt-28 grid-cols-[3rem_1fr_34%] border-b-2 border-borda">
              <div className={`relative flex flex-col items-center pt-2.5 ${ehHoje ? 'bg-texto text-fundo' : semana === 0 || semana === 6 ? 'bg-superficie-2' : 'bg-superficie'}`}>
                {passou && (
                  <span aria-label={pendenteNoDia ? 'Tem conta a pagar' : 'Dia passado'} title={pendenteNoDia ? 'Tem conta a pagar' : undefined}
                    className={`absolute top-0 right-0 flex h-4 w-4 items-start justify-end pr-0.5 text-[9px] font-bold text-white ${pendenteNoDia ? 'bg-alerta' : 'bg-h-forte'}`}
                    style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}>{pendenteNoDia ? '!' : '✓'}</span>
                )}
                <span className="text-lg font-bold tabular-nums">{d.dia}</span>
                <span className={`text-[10px] font-bold uppercase ${ehHoje ? '' : 'text-texto-2'}`}>{ehHoje ? 'hoje' : DIAS_SEMANA[semana]}</span>
              </div>

              <ul className="border-x border-borda bg-superficie">
                {(() => {
                  const visiveis = filtro !== 'todas' || vazias ? linhas
                    : linhas.filter((l) => valorDaLinha(d, l.id) !== 0 || (l.id === 'cartao' && d.cartao > 0) || (l.id === 'entradas' && d.entradasIncertas > 0));
                  if (visiveis.length === 0) return (
                    <li>
                      <button type="button" onClick={() => setAberto({ data: d.data, linha: 'todas', modo: 'lista' })}
                        className="flex min-h-11 w-full items-center px-3 text-left text-xs text-texto-2/70 active:bg-superficie-2">Nada lançado</button>
                    </li>
                  );
                  return visiveis.map((l) => {
                  const v = valorDaLinha(d, l.id);
                  const sub = l.id === 'cartao' && d.cartao > 0 ? `compras ${formatarReais(d.cartao)}` : l.id === 'entradas' && d.entradasIncertas > 0 ? `${formatarReais(d.entradasIncertas)} talvez` : null;
                  return (
                    <li key={l.id} className="border-b border-borda/70 last:border-0">
                      <button type="button" onClick={() => setAberto({ data: d.data, linha: l.id, modo: 'lista' })}
                        aria-label={`${rotuloDia(d.data)}, ${l.rotulo}: ${formatarReais(v)}`}
                        className="flex min-h-11 w-full items-center gap-2 px-2.5 py-1.5 text-left active:bg-superficie-2">
                        <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
                          style={{ background: v || sub ? l.cor : 'var(--color-borda)' }}>{l.icone}</span>
                        <span className={`min-w-0 flex-1 truncate text-xs ${v ? 'font-semibold' : 'text-texto-2/70'}`}>{l.rotulo}</span>
                        <span className="flex shrink-0 flex-col items-end leading-tight">
                          <span className={`flex items-center gap-1 text-sm tabular-nums ${v ? 'font-bold' : 'text-texto-2/50'}`}>
                            {l.id === 'fixos' && d.fixoPendente && <span className="h-1.5 w-1.5 rounded-full bg-alerta" title="Fixo a pagar" />}
                            {formatarReais(v)}
                          </span>
                          {sub && <span className="text-[10px] text-texto-2">{sub}</span>}
                        </span>
                      </button>
                    </li>
                  );
                  });
                })()}
              </ul>

              <button type="button" onClick={() => setAberto({ data: d.data, linha: 'todas', modo: 'lista' })}
                aria-label={`${rotuloDia(d.data)}: saldo ${d.saldo === null ? 'sem dados' : formatarReais(d.saldo)}`}
                className={`flex flex-col items-end px-3 pt-2.5 text-right ${cor ? FUNDO_COR[cor] : 'bg-superficie-2/50'}`}>
                <span className={`font-bold tabular-nums ${d.saldo !== null && d.saldo < 0 ? 'text-texto' : ''}`}>{d.saldo === null ? '—' : formatarReais(d.saldo)}</span>
                {d.liquido !== 0 && d.saldo !== null && filtro === 'todas' && (
                  <span className="mt-0.5 text-[11px] font-semibold tabular-nums text-texto-2">{d.liquido > 0 ? '+' : '−'}{formatarReais(Math.abs(d.liquido))} no dia</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {grade?.resumo && (
        <div className="mx-4 mt-4 rounded-2xl bg-superficie-2/70 px-4 py-3 text-sm">
          <p className="font-bold">Conta do mês</p>
          <p className="mt-1 text-texto-2">
            começou {formatarReais(grade.resumo.inicio)} + entrou <span className="text-entrada">{formatarReais(grade.resumo.entradas)}</span>
            {' '}− saiu <span className="text-saida">{formatarReais(grade.resumo.saidas)}</span> = <b className="text-texto">{formatarReais(grade.resumo.fim)}</b>
          </p>
          <p className="mt-2 text-xs text-texto-2">Saldo verde forte: sobra mais que um mês de fixos. Verde: cobre o mês. Amarelo: não cobre o que ainda vai sair. Rosa e vermelho: negativo. ✓ dia que já passou; ! tem conta a pagar.</p>
        </div>
      )}

      <Folha aberta={aberto !== null} aoFechar={fechar} titulo={aberto ? tituloFolha(aberto) : ''}>
        {aberto && cad && grade && (
          <ConteudoDia aberto={aberto} setAberto={setAberto} cad={cad} lancamentos={grade.lancamentos} faturas={grade.faturas} fechar={fechar} />
        )}
      </Folha>
    </main>
  );
}

function tituloFolha(a: NonNullable<Aberto>): string {
  const linha = LINHAS.find((l) => l.id === a.linha);
  if (a.modo === 'novo') return linha ? linha.adicionar : 'Novo lançamento';
  if (typeof a.modo === 'object') return 'Editar lançamento';
  return `${rotuloDia(a.data)}${linha ? ` · ${linha.rotulo}` : ''}`;
}

function ConteudoDia({ aberto, setAberto, cad, lancamentos, faturas, fechar }: {
  aberto: NonNullable<Aberto>; setAberto: (a: Aberto) => void; cad: Cadastros; lancamentos: Lancamento[]; faturas: Fatura[]; fechar: () => void;
}) {
  const { data, linha, modo } = aberto;
  const voltar = () => setAberto({ ...aberto, modo: 'lista' });

  if (typeof modo === 'object') return <FormLancamento item={modo.editar} cad={cad} aoFechar={voltar} />;
  if (modo === 'novo') {
    if (linha === 'fixos') return <FormRecorrencia dataInicial={data} aoFechar={voltar} />;
    if (linha === 'economia') return <FormEconomia cad={cad} dataInicial={data} aoFechar={voltar} />;
    const m = linha === 'entradas' ? 'entrada' : linha === 'cartao' ? 'cartao' : 'saida';
    return <FormLancamento cad={cad} modo={m} dataInicial={data} aoFechar={voltar} />;
  }

  const itens = lancamentos.filter((l) => l.data === data && (linha === 'todas' || linhaDoLancamento(l) === linha));
  const fats = linha === 'todas' || linha === 'cartao' ? faturas.filter((f) => f.vencimento === data) : [];
  const botoes = linha === 'todas' ? LINHAS : LINHAS.filter((l) => l.id === linha);

  return (
    <div className="flex flex-col gap-3">
      {fats.map((f) => (
        <div key={`${f.cartaoId}${f.faturaRef}`} className="flex items-center gap-3 rounded-2xl border border-borda bg-superficie px-4 py-3">
          <span aria-hidden="true" className="text-lg">💳</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Fatura {cad.cartao(f.cartaoId)?.nome}</span>
            <span className="block text-sm text-texto-2">{f.restante === 0 ? 'paga ✓' : `vence neste dia · sai de ${cad.conta(f.contaId)?.nome ?? 'conta'}`}</span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block font-bold tabular-nums">−{formatarReais(f.total)}</span>
            {f.restante > 0
              ? <button type="button" onClick={() => pagarFatura(f)} className="text-sm font-bold text-destaque">Marcar paga</button>
              : <button type="button" onClick={() => desfazerPagamentoFatura(f)} className="text-xs font-bold text-texto-2">Desfazer</button>}
          </span>
        </div>
      ))}
      {itens.length > 0 ? (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {itens.map((l) => <LinhaLancamento key={l.id} l={l} cad={cad} aoTocar={() => setAberto({ ...aberto, modo: { editar: l } })} />)}
        </ul>
      ) : fats.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nada lançado aqui neste dia.</p>
      ) : null}
      <div className={botoes.length > 1 ? 'grid grid-cols-2 gap-2' : 'flex'}>
        {botoes.map((b) => (
          <button key={b.id} type="button" onClick={() => setAberto({ data, linha: b.id, modo: 'novo' })}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 font-bold ${botoes.length > 1 ? 'border border-borda bg-superficie text-sm' : 'flex-1 bg-texto text-fundo'}`}>
            <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: b.cor }}>{b.icone}</span>
            {b.adicionar}
          </button>
        ))}
      </div>
      <button type="button" onClick={fechar} className="py-1 text-sm font-bold text-texto-2">Fechar</button>
    </div>
  );
}
