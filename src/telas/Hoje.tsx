import { useCallback, useState, type ReactNode } from 'react';
import { LancamentoRapido } from '../componentes/LancamentoRapido';
import { FormLancamento, type InicialLancamento } from '../componentes/lancamentos';
import { IconeSeta } from '../componentes/Icones';
import { Folha } from '../componentes/ui';
import { guardarNaReserva, marcarComoPago, pagarFatura, resumoDosCartoes, resumoHoje, type ItemChegando, type ResumoHoje } from '../data/servicos';
import { useCadastros, type Cadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { formatarData, somarDias } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { linkPara } from '../navegacao';
import type { Lancamento } from '../tipos';

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function dataPorExtenso(d: string) {
  const [a, m, dia] = d.split('-').map(Number);
  return `${SEMANA[new Date(a, m - 1, dia).getDay()]}, ${dia} de ${MESES[m - 1]}`;
}

function quando(data: string, hoje: string) {
  if (data < hoje) return `atrasado · ${formatarData(data).slice(0, 5)}`;
  if (data === hoje) return 'hoje';
  if (data === somarDias(hoje, 1)) return 'amanhã';
  return formatarData(data).slice(0, 5);
}

function Secao({ titulo, link, rotuloLink, children }: { titulo: string; link?: string; rotuloLink?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-bold uppercase tracking-wider text-texto-2">{titulo}</h2>
        {link && <a href={link} className="text-sm font-bold text-destaque">{rotuloLink ?? 'ver'} ›</a>}
      </div>
      {children}
    </section>
  );
}

export function Hoje() {
  const cad = useCadastros();
  const r = useConsulta(() => resumoHoje(), []);
  const [detalhes, setDetalhes] = useState<InicialLancamento | null>(null);
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [explicar, setExplicar] = useState(false);
  const fechar = useCallback(() => { setDetalhes(null); setEditando(null); setExplicar(false); }, []);

  return (
    <main className="mx-auto max-w-md px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-28">
      <header className="mb-4">
        <h1 className="text-xl font-bold tracking-tight">Hoje</h1>
        {r && <p className="text-sm text-texto-2 first-letter:uppercase">{dataPorExtenso(r.hoje)}</p>}
      </header>

      <div className="flex flex-col gap-6">
        {r && <CartaoLivre r={r} aoExplicar={() => setExplicar(true)} />}

        {r?.alerta && (
          <a href={linkPara('saldos')} className="flex items-start gap-3 rounded-2xl border border-saida/40 bg-saldo-negativo px-4 py-3">
            <span aria-hidden="true" className="text-xl">⚠️</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">Vai faltar {formatarReais(r.alerta.falta)} na conta</span>
              <span className="block text-sm text-texto-2">a partir de {formatarData(r.alerta.dia)}, contando só o que é garantido. Toque para ver os dias.</span>
            </span>
          </a>
        )}

        {cad && <LancamentoRapido cad={cad} aoDetalhes={setDetalhes} />}

        {r && cad && <Chegando r={r} cad={cad} aoEditar={setEditando} />}

        {r && cad && (
          <Secao titulo="Suas contas" link={linkPara('saldos')} rotuloLink="dia a dia">
            <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
              {cad.contas.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-borda px-4 py-3 last:border-0">
                  <span className="font-semibold">{c.nome}</span>
                  <span className={`font-bold tabular-nums ${(r.saldoHoje.porConta[c.id] ?? 0) < 0 ? 'text-saida' : ''}`}>{formatarReais(r.saldoHoje.porConta[c.id] ?? 0)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between bg-superficie-2/60 px-4 py-3 text-sm">
                <span className="text-texto-2">Previsto no fim do mês</span>
                <span className={`font-bold tabular-nums ${r.fimDoMes < 0 ? 'text-saida' : ''}`}>{formatarReais(r.fimDoMes)}</span>
              </div>
            </div>
          </Secao>
        )}

        {r && (
          <Secao titulo="Este mês" link={linkPara('totais')} rotuloLink="totais">
            <div className="grid grid-cols-3 gap-2">
              <Numero rotulo="Entrou" valor={r.totais.entradas} cor="text-entrada" />
              <Numero rotulo="Gastou" valor={r.totais.custoDeVida} />
              <Numero rotulo="Falta pagar" valor={r.faltaPagar} cor={r.faltaPagar > 0 ? 'text-alerta' : ''} />
            </div>
          </Secao>
        )}

        {cad && cad.cartoes.length > 0 && <Faturas />}

        {r && (
          <Secao titulo="Reserva" link={linkPara('metas')}>
            <div className="rounded-2xl border border-borda bg-superficie px-4 py-3">
              <p className="text-2xl font-extrabold tabular-nums">{formatarReais(r.reserva)}</p>
              <p className="text-sm text-texto-2">guardados. Meses de reserva e fôlego chegam na Fase 6.</p>
              {r.sobraParaGuardar > 0 && (
                <button type="button" onClick={() => guardarNaReserva(r.sobraParaGuardar)}
                  className="mt-3 w-full rounded-2xl bg-saldo-ok py-3 font-bold text-entrada">
                  Sobrou {formatarReais(r.sobraParaGuardar)} do mês passado · guardar na reserva
                </button>
              )}
            </div>
          </Secao>
        )}
      </div>

      <Folha aberta={!!detalhes || !!editando || explicar} aoFechar={fechar}
        titulo={explicar ? 'Como o livre de hoje é calculado' : editando ? 'Editar lançamento' : 'Novo lançamento'}>
        {explicar && r && <Explicacao r={r} />}
        {cad && detalhes && <FormLancamento cad={cad} inicial={detalhes} aoFechar={fechar} />}
        {cad && editando && <FormLancamento cad={cad} item={editando} aoFechar={fechar} />}
      </Folha>
    </main>
  );
}

function CartaoLivre({ r, aoExplicar }: { r: ResumoHoje; aoExplicar: () => void }) {
  const l = r.livre;
  const negativo = l.livreHoje < 0;
  return (
    <section className={`rounded-3xl px-5 pt-5 pb-4 ${negativo ? 'bg-saldo-negativo' : 'bg-saldo-ok'}`}>
      <p className="text-sm font-bold text-texto-2">Livre para gastar hoje</p>
      <p className={`mt-1 text-5xl font-extrabold tracking-tight tabular-nums ${negativo ? 'text-saida' : 'text-texto'}`}>{formatarReais(l.livreHoje)}</p>
      {negativo ? (
        <p className="mt-2 font-semibold text-saida">Faltam {formatarReais(l.faltaEntrada)} de entrada para fechar o mês.</p>
      ) : (
        <p className="mt-2 text-base">
          Ainda posso hoje: <b className={`tabular-nums ${l.aindaPossoHoje < 0 ? 'text-saida' : ''}`}>{formatarReais(l.aindaPossoHoje)}</b>
          {l.variaveisHoje > 0 && <span className="text-sm text-texto-2"> (já gastei {formatarReais(l.variaveisHoje)})</span>}
        </p>
      )}
      {l.livreComProvaveis !== l.livreHoje && (
        <p className="mt-1 text-sm text-texto-2">Se as prováveis caírem: {formatarReais(l.livreComProvaveis)} por dia.</p>
      )}
      <button type="button" onClick={aoExplicar} className="mt-3 text-sm font-bold text-destaque">Como é calculado ›</button>
    </section>
  );
}

function Explicacao({ r }: { r: ResumoHoje }) {
  const l = r.livre;
  const linha = (rot: string, v: number, sinal: '+' | '−' | '=', forte = false) => (
    <div className={`flex justify-between py-1.5 ${forte ? 'border-t border-borda pt-2 font-bold' : ''}`}>
      <span className={forte ? '' : 'text-texto-2'}>{rot}</span>
      <span className="tabular-nums">{sinal === '=' ? '' : sinal} {formatarReais(v)}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="rounded-2xl bg-superficie px-4 py-2">
        {linha('Dinheiro de partida do mês', l.partida, '+')}
        {linha('Entradas garantidas do mês', l.entradasGarantidas, '+')}
        {linha('Fixos do mês (pagos ou não)', l.fixos, '−')}
        {linha('Parcelas de cartão do mês', l.parcelas, '−')}
        {linha('Guardado/aportes do mês', l.aportes, '−')}
        {linha('Gastos do dia a dia até ontem', l.variaveisAteOntem, '−')}
        {linha('Livre no resto do mês', l.orcamentoLivreMes, '=', true)}
        {linha(`÷ ${l.diasRestantes} dias (contando hoje)`, l.livreHoje, '=', true)}
      </div>
      <p className="text-texto-2">
        Só conta entrada garantida: comissão provável não entra aqui. Gastou menos hoje, amanhã sobe; gastou mais, cai.
        Pagamento de fatura não conta de novo (as compras já foram contadas no dia da compra).
      </p>
      <p className="text-texto-2">Dinheiro de partida: o que já estava na conta no começo do mês (no primeiro mês, o saldo que você informou), menos a fatura que já estava aberta antes do app.</p>
    </div>
  );
}

function Numero({ rotulo, valor, cor = '' }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-superficie px-3 py-2.5">
      <p className="text-xs font-bold text-texto-2">{rotulo}</p>
      <p className={`text-base font-extrabold tabular-nums ${cor}`}>{formatarReais(valor)}</p>
    </div>
  );
}

function Chegando({ r, cad, aoEditar }: { r: ResumoHoje; cad: Cadastros; aoEditar: (l: Lancamento) => void }) {
  const itens = r.chegando;
  return (
    <Secao titulo="Chegando" link={linkPara('saldos')} rotuloLink="calendário">
      {itens.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-4 text-center text-sm text-texto-2">Nada a pagar ou receber nos próximos 10 dias.</p>
      ) : (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {itens.map((it) => <LinhaChegando key={it.lancamento?.id ?? `${it.fatura!.cartaoId}${it.fatura!.faturaRef}`} it={it} hoje={r.hoje} cad={cad} aoEditar={aoEditar} />)}
        </ul>
      )}
    </Secao>
  );
}

function LinhaChegando({ it, hoje, cad, aoEditar }: { it: ItemChegando; hoje: string; cad: Cadastros; aoEditar: (l: Lancamento) => void }) {
  const l = it.lancamento;
  const f = it.fatura;
  const entrada = l?.tipo === 'entrada';
  const cat = l ? cad.categoria(l.categoriaId) : undefined;
  const titulo = l ? l.descricao : `Fatura ${cad.cartao(f!.cartaoId)?.nome ?? ''}`;
  const valor = l ? l.valor : f!.restante;
  const extra = l && entrada && l.certeza !== 'garantida' ? (l.certeza === 'provavel' ? ' · provável' : ' · talvez') : '';
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button type="button" onClick={() => l && aoEditar(l)} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!l}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `${f ? '#6d4ad8' : cat?.cor ?? '#6f7f78'}26` }} aria-hidden="true">
          {f ? '💳' : cat?.icone ?? '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{titulo}</span>
          <span className={`block text-sm ${it.atrasado ? 'font-bold text-saida' : 'text-texto-2'}`}>{quando(it.data, hoje)}{extra}</span>
        </span>
        <span className={`shrink-0 font-bold tabular-nums ${entrada ? 'text-entrada' : ''}`}>{entrada ? '+' : '−'}{formatarReais(valor)}</span>
      </button>
      <button type="button" onClick={() => (f ? pagarFatura(f) : marcarComoPago(l!.id))}
        className="shrink-0 rounded-full border border-destaque px-3 py-1.5 text-sm font-bold text-destaque active:scale-95">
        {entrada ? 'Caiu' : 'Pagar'}
      </button>
    </li>
  );
}

function Faturas() {
  const cartoes = useConsulta(() => resumoDosCartoes(), []);
  if (!cartoes?.length) return null;
  return (
    <Secao titulo="Cartões" link={linkPara('cartoes')}>
      <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
        {cartoes.map((c) => (
          <a key={c.cartao.id} href={linkPara('cartoes')} className="flex items-center gap-3 border-b border-borda px-4 py-3 last:border-0">
            <span aria-hidden="true" className="text-lg">💳</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{c.cartao.nome}</span>
              <span className="block text-sm text-texto-2">
                {c.proxima.restante > 0 ? `fatura vence ${formatarData(c.proxima.vencimento).slice(0, 5)}` : c.proxima.total > 0 ? 'fatura paga' : 'sem fatura em aberto'}
              </span>
            </span>
            <span className="font-bold tabular-nums">{formatarReais(c.proxima.total)}</span>
            <IconeSeta className="h-4 w-4 text-texto-2" />
          </a>
        ))}
      </div>
    </Secao>
  );
}
