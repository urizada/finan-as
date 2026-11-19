import { useState, type ReactNode } from 'react';
import { EmConstrucao, Tela } from '../componentes/Tela';
import { IconeSeta } from '../componentes/Icones';
import { SeletorMes } from '../componentes/lancamentos';
import { resumoHoje, totaisDaTela } from '../data/servicos';
import { useConsulta } from '../data/useConsulta';
import { hojeISO, mesDe } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import type { TotaisMes } from '../calculos/orcamento';
import { linkPara } from '../navegacao';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function Bloco({ titulo, valor, cor = '', sub, children }: { titulo: string; valor: string; cor?: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-borda bg-superficie px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">{titulo}</h2>
        <p className={`text-lg font-extrabold tabular-nums ${cor}`}>{valor}</p>
      </div>
      {sub && <p className="mt-0.5 text-sm text-texto-2">{sub}</p>}
      {children}
    </section>
  );
}

function Barra({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-superficie-2">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function Totais() {
  const hoje = hojeISO();
  const [mes, setMes] = useState(mesDe(hoje));
  const dados = useConsulta(() => totaisDaTela(mes), [mes]);
  const livreHoje = useConsulta(async () => (await resumoHoje()).livre.livreHoje, []);
  const t = dados?.totais;
  const atual = mes === mesDe(hoje);

  return (
    <Tela titulo="Totais">
      <div className="flex flex-col gap-4">
        <SeletorMes mes={mes} aoMudar={setMes} />
        {t && <Conteudo t={t} atual={atual} futuro={mes > mesDe(hoje)} livreHoje={livreHoje} />}

        {dados && (
          <section className="rounded-2xl border border-borda bg-superficie px-4 py-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold">Economizado em {mes.slice(0, 4)}</h2>
              <AnoPct ano={dados.ano.map((a) => a.totais)} />
            </div>
            <ul className="mt-3 flex flex-col gap-2">
              {dados.ano.map(({ mes: m, totais }) => (
                <li key={m}>
                  <button type="button" onClick={() => setMes(m)} className="grid w-full grid-cols-[2.5rem_1fr_3rem] items-center gap-2 text-left text-sm">
                    <span className={`font-bold ${m === mes ? 'text-destaque' : 'text-texto-2'}`}>{MESES_CURTOS[Number(m.slice(5)) - 1]}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-superficie-2">
                      <span className="block h-full rounded-full bg-destaque" style={{ width: `${Math.min(100, totais.economizadoPct)}%` }} />
                    </span>
                    <span className="text-right font-bold tabular-nums">{totais.economizadoPct}%</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-texto-2">Quanto do que entrou (garantido) foi guardado na reserva ou em metas.</p>
          </section>
        )}

        <a href={linkPara('previsao')} className="flex items-center gap-3 rounded-2xl border border-borda bg-superficie px-4 py-3.5 hover:bg-superficie-2">
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Previsão</span>
            <span className="block text-sm text-texto-2">3, 6 e 12 meses</span>
          </span>
          <IconeSeta className="h-5 w-5 text-texto-2" />
        </a>
      </div>
    </Tela>
  );
}

function AnoPct({ ano }: { ano: TotaisMes[] }) {
  const entradas = ano.reduce((s, t) => s + t.entradas, 0);
  const guardado = ano.reduce((s, t) => s + t.guardado, 0);
  return <p className="text-lg font-extrabold tabular-nums text-destaque">{entradas > 0 ? Math.round((guardado / entradas) * 100) : 0}% <span className="text-sm font-semibold text-texto-2">· {formatarReais(guardado)}</span></p>;
}

function Conteudo({ t, atual, futuro, livreHoje }: { t: TotaisMes; atual: boolean; futuro: boolean; livreHoje?: number }) {
  const sobrou = t.resultado >= 0;
  const acimaDaRenda = t.custoDeVida > t.entradas;
  return (
    <>
      <section className={`rounded-3xl px-5 py-4 ${sobrou ? 'bg-saldo-ok' : 'bg-saldo-negativo'}`}>
        <p className="text-sm font-bold text-texto-2">{futuro ? 'Previsto para o mês' : atual ? 'Até agora no mês' : 'Resultado do mês'}</p>
        <p className={`text-4xl font-extrabold tracking-tight tabular-nums ${sobrou ? '' : 'text-saida'}`}>{sobrou ? '' : '−'}{formatarReais(Math.abs(t.resultado))}</p>
        <p className="font-semibold">{sobrou ? 'sobrou' : 'faltou dinheiro'} <span className="text-sm font-normal text-texto-2">= entrou − gastou − guardou</span></p>
      </section>

      <Bloco titulo="Entrou" valor={formatarReais(t.entradas)} cor="text-entrada"
        sub={t.entradasIncertas > 0 ? <>+ {formatarReais(t.entradasIncertas)} previstos que ainda não são certos</> : 'Entradas garantidas do mês'} />

      <Bloco titulo="Custo de vida" valor={formatarReais(t.custoDeVida)} cor={acimaDaRenda ? 'text-saida' : ''}
        sub={t.entradas > 0 ? (acimaDaRenda ? 'acima do que entrou' : `${Math.round((t.custoDeVida / t.entradas) * 100)}% do que entrou`) : 'fixos + dia a dia + parcelas'}>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          {[['Fixos', t.fixos], ['Dia a dia', t.variaveis], ['Parcelas', t.parcelas]].map(([r, v]) => (
            <div key={r as string} className="rounded-xl bg-superficie-2 px-2 py-2">
              <p className="text-texto-2">{r}</p><p className="font-bold tabular-nums">{formatarReais(v as number)}</p>
            </div>
          ))}
        </div>
        {t.noCartao > 0 && <p className="mt-2 text-xs text-texto-2">{formatarReais(t.noCartao)} disso foi no cartão (pela data da compra).</p>}
      </Bloco>

      <Bloco titulo="Economizado" valor={`${t.economizadoPct}%`} cor="text-destaque"
        sub={t.guardado > 0 ? `${formatarReais(t.guardado)} guardados` : 'nada guardado ainda'}>
        <Barra pct={t.economizadoPct} cor="bg-destaque" />
      </Bloco>

      {!futuro && (
        <Bloco titulo="Gasto médio por dia" valor={formatarReais(t.diarioMedio)}
          sub={atual && livreHoje !== undefined
            ? <>Dia a dia ÷ {t.diasConsiderados} dias. Seu livre hoje: <b className={livreHoje < t.diarioMedio ? 'text-saida' : 'text-entrada'}>{formatarReais(livreHoje)}</b></>
            : `Dia a dia ÷ ${t.diasConsiderados} dias`} />
      )}

      {futuro && <p className="px-1 text-sm text-texto-2">Mês futuro: mostra só o que já está lançado (fixos, parcelas, entradas). A previsão com gasto médio chega na Fase 7.</p>}
    </>
  );
}

export function Previsao() {
  return (
    <Tela titulo="Previsão" voltar={linkPara('totais')}>
      <EmConstrucao fase={7} itens={['Gráfico de 12 meses: pessimista, base e otimista', 'Saldo acumulado e evolução da reserva', 'Ponto de equilíbrio e produção necessária']} />
    </Tela>
  );
}
