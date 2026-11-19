// Investimentos: total da carteira, por tipo, e atualizar o saldo quando quiser.
import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { Acoes } from '../componentes/formularios';
import { Botao, CampoEscolha, CampoTexto, CampoValor, Folha, Segmentos } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { atualizarSaldoInvestimento, movimentarDestino, patrimonio, type LinhaInvestimento } from '../data/servicos';
import { useConsulta } from '../data/useConsulta';
import { formatarData } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { linkPara } from '../navegacao';
import type { Investimento, TipoInvestimento } from '../tipos';

export const ROTULO_TIPO_INV: Record<TipoInvestimento, string> = {
  caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', acoes: 'Ações', fii: 'Fundos imobiliários', cripto: 'Cripto', outro: 'Outro',
};
const CORES = ['#13955f', '#3f7be0', '#e39b26', '#6d4ad8', '#d84a8f', '#1f9bb8', '#6f7f78'];

type Aberto = { tipo: 'detalhe'; l: LinhaInvestimento } | { tipo: 'form'; inv?: Investimento } | null;

export function Investimentos() {
  const p = useConsulta(() => patrimonio(), []);
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const total = p?.totalInvestido ?? 0;
  const porTipo = Object.entries((p?.investimentos ?? []).reduce<Record<string, number>>((acc, l) => {
    acc[l.investimento.tipo] = (acc[l.investimento.tipo] ?? 0) + l.saldo; return acc;
  }, {})).sort((a, b) => b[1] - a[1]);
  const atual = aberto?.tipo === 'detalhe' ? p?.investimentos.find((x) => x.investimento.id === aberto.l.investimento.id) ?? aberto.l : null;

  return (
    <Tela titulo="Investimentos" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-5">
        <section className="rounded-3xl border border-borda bg-superficie px-5 py-5">
          <p className="text-sm font-bold text-texto-2">Total investido</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">{formatarReais(total)}</p>
          {total > 0 && porTipo.length > 0 && (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full" aria-hidden="true">
                {porTipo.map(([t, v], i) => <span key={t} style={{ width: `${(v / total) * 100}%`, background: CORES[i % CORES.length] }} />)}
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {porTipo.map(([t, v], i) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CORES[i % CORES.length] }} />
                    <span className="flex-1">{ROTULO_TIPO_INV[t as TipoInvestimento]}</span>
                    <span className="tabular-nums text-texto-2">{Math.round((v / total) * 100)}%</span>
                    <span className="w-28 text-right font-bold tabular-nums">{formatarReais(v)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="flex flex-col gap-2">
          {p?.investimentos.length === 0 && (
            <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nenhum investimento ainda. Cadastre caixinhas, CDB, Tesouro…</p>
          )}
          {p && p.investimentos.length > 0 && (
            <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
              {p.investimentos.map((l) => (
                <li key={l.investimento.id}>
                  <button type="button" onClick={() => setAberto({ tipo: 'detalhe', l })} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{l.investimento.nome}</span>
                      <span className="block truncate text-sm text-texto-2">
                        {[ROTULO_TIPO_INV[l.investimento.tipo], l.investimento.instituicao, l.investimento.rendimentoDescricao].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold tabular-nums">{formatarReais(l.saldo)}</span>
                      <span className="block text-[11px] text-texto-2">{l.atualizadoEm ? `atualizado ${formatarData(l.atualizadoEm).slice(0, 5)}` : 'sem atualização'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setAberto({ tipo: 'form' })} className="rounded-2xl border border-dashed border-borda py-3.5 font-bold text-destaque">+ Novo investimento</button>
        </section>
      </div>

      <Folha aberta={aberto !== null} aoFechar={fechar}
        titulo={aberto?.tipo === 'detalhe' ? aberto.l.investimento.nome : aberto?.tipo === 'form' ? (aberto.inv ? 'Editar investimento' : 'Novo investimento') : ''}>
        {atual && <Detalhe l={atual} aoEditar={() => setAberto({ tipo: 'form', inv: atual.investimento })} />}
        {aberto?.tipo === 'form' && <FormInvestimento item={aberto.inv} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}

function Detalhe({ l, aoEditar }: { l: LinhaInvestimento; aoEditar: () => void }) {
  const [modo, setModo] = useState<'atualizar' | 'aportar' | 'resgatar'>('atualizar');
  const [valor, setValor] = useState(0);
  const [ok, setOk] = useState('');
  const historico = useConsulta(async () => (await repositorio.snapshotsInvestimento.listar())
    .filter((s) => s.investimentoId === l.investimento.id).sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 6), [l.investimento.id, l.saldo]);

  async function confirmar() {
    if (modo === 'atualizar') await atualizarSaldoInvestimento(l.investimento.id, valor);
    else await movimentarDestino({ tipo: 'investimento', id: l.investimento.id, nome: l.investimento.nome }, valor, modo === 'resgatar');
    setOk(modo === 'atualizar' ? 'Saldo atualizado.' : modo === 'aportar' ? 'Aporte registrado: saiu da conta hoje.' : 'Resgate registrado: voltou para a conta hoje.');
    setValor(0);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-superficie-2 px-4 py-3">
        <p className="text-sm text-texto-2">Saldo</p>
        <p className="text-3xl font-extrabold tabular-nums">{formatarReais(l.saldo)}</p>
        <p className="text-xs text-texto-2">{l.atualizadoEm ? `Última atualização ${formatarData(l.atualizadoEm)}, mais os aportes depois dela.` : 'Soma dos aportes. Atualize com o saldo do app do banco.'}</p>
      </div>
      <Segmentos valor={modo} aoMudar={(m) => { setModo(m); setOk(''); }}
        opcoes={[{ valor: 'atualizar', rotulo: 'Atualizar saldo' }, { valor: 'aportar', rotulo: 'Aportar' }, { valor: 'resgatar', rotulo: 'Resgatar' }]} />
      <CampoValor rotulo={modo === 'atualizar' ? 'Saldo de hoje (veja no app do banco)' : modo === 'aportar' ? 'Quanto vai aplicar' : 'Quanto vai resgatar'} valor={valor} aoMudar={setValor} />
      <Botao disabled={valor <= 0 && modo !== 'atualizar'} onClick={confirmar}>Confirmar</Botao>
      {ok && <p role="status" className="text-center text-sm font-bold text-entrada">{ok}</p>}
      {historico && historico.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wider text-texto-2">Atualizações</p>
          <ul className="text-sm">
            {historico.map((s) => (
              <li key={s.id} className="flex justify-between border-b border-borda py-1.5 last:border-0">
                <span className="text-texto-2">{formatarData(s.data)}</span><span className="font-bold tabular-nums">{formatarReais(s.saldo)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={aoEditar} className="py-2 text-sm font-bold text-destaque">Editar ou excluir</button>
    </div>
  );
}

function FormInvestimento({ item, aoFechar }: { item?: Investimento; aoFechar: () => void }) {
  const [nome, setNome] = useState(item?.nome ?? '');
  const [tipo, setTipo] = useState<TipoInvestimento>(item?.tipo ?? 'caixinha');
  const [instituicao, setInstituicao] = useState(item?.instituicao ?? '');
  const [rendimento, setRendimento] = useState(item?.rendimentoDescricao ?? '');
  const [saldo, setSaldo] = useState(0);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome, ex.: Caixinha Nubank.');
    const dados: Omit<Investimento, 'id'> = {
      nome: nome.trim(), tipo, instituicao: instituicao.trim(), aporteMensalPlanejado: item?.aporteMensalPlanejado ?? 0,
      ...(rendimento.trim() ? { rendimentoDescricao: rendimento.trim() } : {}),
    };
    const salvo = item ? await repositorio.investimentos.salvar({ ...item, ...dados }) : await repositorio.investimentos.criar(dados);
    if (!item && saldo > 0) await atualizarSaldoInvestimento(salvo.id, saldo);
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="ex.: Caixinha Nubank" autoFocus={!item} />
      <CampoEscolha rotulo="Tipo" valor={tipo} aoMudar={setTipo} opcoes={(Object.keys(ROTULO_TIPO_INV) as TipoInvestimento[]).map((t) => ({ valor: t, rotulo: ROTULO_TIPO_INV[t] }))} />
      <CampoTexto rotulo="Onde está (opcional)" valor={instituicao} aoMudar={setInstituicao} placeholder="ex.: Nubank, Inter, XP" />
      <CampoTexto rotulo="Rendimento (opcional)" valor={rendimento} aoMudar={setRendimento} placeholder="ex.: 100% do CDI" />
      {!item && <CampoValor rotulo="Quanto tem nele hoje" valor={saldo} aoMudar={setSaldo} />}
      {erro && <p className="text-sm font-semibold text-saida">{erro}</p>}
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.investimentos.excluir(item.id); aoFechar(); } : undefined} />
    </div>
  );
}
