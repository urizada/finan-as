import { useCallback, useEffect, useRef, useState } from 'react';
import { FormLancamento, LinhaLancamento, SeletorMes, rotuloDia } from '../componentes/lancamentos';
import { Folha } from '../componentes/ui';
import { desfazerPagamentoFatura, gradeDoMes, pagarFatura } from '../data/servicos';
import { useCadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { hojeISO, mesDe } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import type { EstadoSaldo, SaldoDia } from '../calculos/saldos';
import type { DataISO, Lancamento } from '../tipos';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const COLUNAS = [
  { id: 'entradas', rotulo: 'Entradas', cor: 'text-entrada' },
  { id: 'saidas', rotulo: 'Saídas', cor: 'text-saida' },
  { id: 'cartao', rotulo: 'Cartão', cor: 'text-cartao' },
  { id: 'fixos', rotulo: 'Fixos', cor: 'text-texto' },
] as const;
type Coluna = (typeof COLUNAS)[number]['id'];

const FUNDO: Record<EstadoSaldo, string> = { ok: 'bg-saldo-ok', apertado: 'bg-saldo-apertado', negativo: 'bg-saldo-negativo' };
const TEXTO: Record<EstadoSaldo, string> = { ok: '', apertado: '', negativo: 'text-saida' };

/** Valor curto para a grade: "1.234,56" (o R$ fica no cabeçalho). */
const curto = (c: number) => formatarReais(c).replace('R$ ', '').replace('R$', '');

export function Saldos() {
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDe(hoje));
  const [coluna, setColuna] = useState<Coluna>('saidas');
  const [diaAberto, setDiaAberto] = useState<DataISO | null>(null);
  const [editando, setEditando] = useState<Lancamento | 'novo' | null>(null);
  const grade = useConsulta(() => gradeDoMes(mes), [mes]);
  const cad = useCadastros();
  const linhaHoje = useRef<HTMLLIElement>(null);
  const fecharDia = useCallback(() => { setDiaAberto(null); setEditando(null); }, []);

  useEffect(() => {
    if (grade && mes === mesDe(hoje)) linhaHoje.current?.scrollIntoView({ block: 'center' });
    // só ao abrir o mês
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, !!grade]);

  const col = COLUNAS.find((c) => c.id === coluna)!;
  const valorDe = (d: SaldoDia) => d[coluna];
  const totalColuna = grade?.dias.reduce((s, d) => s + valorDe(d), 0) ?? 0;
  const diaHoje = grade?.dias.find((d) => d.data === hoje);
  const ultimo = grade?.dias[grade.dias.length - 1];
  const doDia = diaAberto ? grade?.lancamentos.filter((l) => l.data === diaAberto) ?? [] : [];
  const faturasDoDia = diaAberto ? grade?.faturas.filter((f) => f.vencimento === diaAberto) ?? [] : [];
  const provaveisFim = ultimo && ultimo.saldo !== null && ultimo.saldoComIncertas !== null ? ultimo.saldoComIncertas - ultimo.saldo : 0;

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-28">
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-10 -mx-4 bg-fundo px-4 pb-2">
        <SeletorMes mes={mes} aoMudar={setMes} />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Resumo rotulo={diaHoje ? 'Saldo hoje' : 'Início do mês'} valor={diaHoje?.saldo ?? grade?.dias.find((d) => d.saldo !== null)?.saldo ?? null} />
          <Resumo rotulo="Fim do mês" valor={ultimo?.saldo ?? null} estado={ultimo?.estado ?? null}
            extra={provaveisFim > 0 ? `+${formatarReais(provaveisFim)} se o “talvez” cair` : undefined} />
        </div>
        {grade?.resumo && (
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 rounded-2xl bg-superficie-2/70 px-3 py-2 text-center text-xs">
            <span><span className="block text-texto-2">{diaHoje ? 'Começou' : 'Início'}</span><b className="tabular-nums">{formatarReais(grade.resumo.inicio)}</b></span>
            <span className="text-texto-2">+</span>
            <span><span className="block text-texto-2">Entra</span><b className="tabular-nums text-entrada">{formatarReais(grade.resumo.entradas)}</b></span>
            <span className="text-texto-2">−</span>
            <span><span className="block text-texto-2">Sai{grade.resumo.faturas > 0 ? '*' : ''}</span><b className="tabular-nums text-saida">{formatarReais(grade.resumo.saidas)}</b></span>
            {grade.resumo.faturas > 0 && <span className="col-span-5 text-[11px] text-texto-2">*inclui {formatarReais(grade.resumo.faturas)} de faturas de cartão que vencem no mês</span>}
          </div>
        )}
        <div className="mt-3 flex gap-1.5" role="tablist" aria-label="Coluna exibida">
          {COLUNAS.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={coluna === c.id} onClick={() => setColuna(c.id)}
              className={`flex-1 rounded-full border px-2 py-1.5 text-sm font-bold ${coluna === c.id ? 'border-texto bg-texto text-fundo' : 'border-borda bg-superficie text-texto-2'}`}>
              {c.rotulo}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-[3.25rem_1fr_1fr] px-1 text-[11px] font-bold uppercase tracking-wider text-texto-2">
          <span>dia</span>
          <span className="pr-3 text-right">{col.rotulo} · R$</span>
          <span className="pr-3 text-right">saldo · R$</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        <ol>
          {grade?.dias.map((d) => {
            const ehHoje = d.data === hoje;
            const [a, m] = mes.split('-').map(Number);
            const semana = new Date(a, m - 1, d.dia).getDay();
            const v = valorDe(d);
            const incerta = coluna === 'entradas' && d.entradasIncertas > 0;
            return (
              <li key={d.data} ref={ehHoje ? linhaHoje : undefined} className="border-b border-borda last:border-0">
                <button type="button" onClick={() => setDiaAberto(d.data)}
                  className="grid w-full grid-cols-[3.25rem_1fr_1fr] items-stretch text-left active:bg-superficie-2"
                  aria-label={`${rotuloDia(d.data)}: ${col.rotulo.toLowerCase()} ${formatarReais(v)}, saldo ${d.saldo === null ? 'sem dados' : formatarReais(d.saldo)}`}>
                  <span className={`flex flex-col justify-center px-2.5 py-1 leading-none gap-0.5 ${ehHoje ? 'bg-texto text-fundo' : semana === 0 || semana === 6 ? 'bg-superficie-2' : ''}`}>
                    <span className="text-[15px] font-bold tabular-nums">{d.dia}</span>
                    <span className={`text-[10px] font-bold uppercase ${ehHoje ? '' : 'text-texto-2'}`}>{ehHoje ? 'hoje' : DIAS_SEMANA[semana]}</span>
                  </span>
                  <span className={`flex items-center justify-end gap-1.5 px-3 tabular-nums ${v ? `font-bold ${col.cor}` : 'text-texto-2/40'}`}>
                    {coluna === 'fixos' && d.fixoPendente && <span className="h-2 w-2 rounded-full bg-alerta" title="Fixo a pagar" />}
                    {coluna === 'saidas' && d.faturas > 0 && <span className="rounded bg-cartao/15 px-1 text-[10px] font-bold text-cartao">fatura</span>}
                    <span className={incerta ? 'underline decoration-dotted underline-offset-4' : ''}>{curto(v)}</span>
                  </span>
                  <span className={`flex items-center justify-end px-3 font-bold tabular-nums ${d.estado ? `${FUNDO[d.estado]} ${TEXTO[d.estado]}` : 'text-texto-2/40'}`}>
                    {d.saldo === null ? '—' : curto(d.saldo)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-3 flex items-center justify-between px-1 text-sm">
        <span className="text-texto-2">{col.rotulo} no mês</span>
        <span className={`font-bold tabular-nums ${col.cor}`}>{formatarReais(totalColuna)}</span>
      </div>
      <Legenda coluna={coluna} />

      <Folha aberta={diaAberto !== null} aoFechar={fecharDia}
        titulo={editando === 'novo' ? 'Novo lançamento' : editando ? 'Editar lançamento' : diaAberto ? rotuloDia(diaAberto) : ''}>
        {cad && diaAberto && (editando ? (
          <FormLancamento item={editando === 'novo' ? undefined : editando} cad={cad} dataInicial={diaAberto} aoFechar={() => setEditando(null)} />
        ) : (
          <div className="flex flex-col gap-3">
            {faturasDoDia.map((f) => {
              const c = cad.cartao(f.cartaoId);
              return (
                <div key={`${f.cartaoId}${f.faturaRef}`} className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cartao/15 text-lg" aria-hidden="true">💳</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">Fatura {c?.nome}</span>
                      <span className="block text-sm text-texto-2">vence neste dia · sai de {cad.conta(f.contaId)?.nome ?? 'conta'}</span>
                    </span>
                    <span className={`shrink-0 text-right font-bold tabular-nums ${f.restante === 0 ? 'text-texto-2 line-through' : ''}`}>−{formatarReais(f.total)}</span>
                  </div>
                  {f.restante > 0 ? (
                    <div className="flex items-center justify-between gap-2 pl-13">
                      <span className="text-xs text-texto-2">{f.pago > 0 ? `Já pagou ${formatarReais(f.pago)}. Falta ${formatarReais(f.restante)}.` : 'Ainda não paga.'}</span>
                      <button type="button" onClick={() => pagarFatura(f)} className="shrink-0 rounded-full border border-destaque px-3 py-1.5 text-sm font-bold text-destaque">Marcar como paga</button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 pl-13">
                      <span className="text-xs font-bold text-entrada">Paga ✓</span>
                      <button type="button" onClick={() => desfazerPagamentoFatura(f)} className="shrink-0 text-xs font-bold text-texto-2">Desfazer</button>
                    </div>
                  )}
                </div>
              );
            })}
            {faturasDoDia.length === 0 && doDia.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nada lançado neste dia.</p>
            ) : doDia.length > 0 ? (
              <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
                {doDia.map((l) => <LinhaLancamento key={l.id} l={l} cad={cad} aoTocar={() => setEditando(l)} />)}
              </ul>
            ) : null}
            <button type="button" onClick={() => setEditando('novo')} className="rounded-2xl bg-texto py-3.5 font-bold text-fundo">
              + Lançar neste dia
            </button>
          </div>
        ))}
      </Folha>
    </main>
  );
}

function Resumo({ rotulo, valor, estado, extra }: { rotulo: string; valor: number | null; estado?: EstadoSaldo | null; extra?: string }) {
  return (
    <div className={`rounded-2xl border border-borda px-3 py-2 ${estado ? FUNDO[estado] : 'bg-superficie'}`}>
      <p className="text-xs font-bold text-texto-2">{rotulo}</p>
      <p className={`text-lg font-extrabold tabular-nums ${valor !== null && valor < 0 ? 'text-saida' : ''}`}>{valor === null ? '—' : formatarReais(valor)}</p>
      {extra && <p className="text-[11px] font-semibold leading-tight text-texto-2">{extra}</p>}
    </div>
  );
}

function Legenda({ coluna }: { coluna: Coluna }) {
  const item = (cls: string, t: string) => (
    <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${cls}`} />{t}</span>
  );
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-superficie-2/60 px-4 py-3 text-xs text-texto-2">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {item('bg-saldo-ok', 'cobre o mês')}
        {item('bg-saldo-apertado', 'não cobre o que falta pagar')}
        {item('bg-saldo-negativo', 'negativo')}
      </div>
      <p>O saldo parte do que você tem na conta e soma as entradas certas e prováveis; desconta, em cada dia, os fixos, os gastos, as economias e as faturas dos cartões no vencimento. Entradas “talvez” ficam de fora.</p>
      {coluna === 'entradas' && <p>Valor sublinhado: inclui entrada “talvez”, que não está no saldo.</p>}
      {coluna === 'cartao' && <p>Compras do dia no cartão. Elas saem da conta no vencimento da fatura (marcado como “fatura” em Saídas).</p>}
      {coluna === 'fixos' && <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-alerta" />fixo do dia ainda não marcado como pago.</p>}
    </div>
  );
}
