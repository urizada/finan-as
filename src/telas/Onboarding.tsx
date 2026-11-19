// Primeira abertura: como recebe → contas → salário (se tiver) → fixos → comissão estimada (se tiver) → cartões → reserva.
import { useState, type ReactNode } from 'react';
import { CadastroCartoes, CadastroContas, CadastroFixos } from '../componentes/cadastros';
import { Botao, CampoNumero, CampoValor, Segmentos } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { garantirCategoriasPadrao } from '../data/semente';
import { useConsulta } from '../data/useConsulta';
import { PERFIS, PERFIS_NA_ABERTURA, limitarMesesReserva } from '../calculos/padroes';
import { configurarRenda, rendaConfigurada } from '../data/servicos';
import { formatarData, hojeISO, mesDe, somarDias, somarMeses } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { custoFixoMensal, dataDaRecorrencia } from '../calculos/recorrencias';
import { necessarioParaFixos, temComissao, temSalario, valorPorRecebimento } from '../calculos/renda';
import type { Frequencia, PerfilRenda } from '../tipos';

export function SeletorMeses({ valor, faixa, aoMudar }: { valor: number; faixa: [number, number]; aoMudar: (m: number) => void }) {
  const botao = 'h-12 w-12 rounded-full bg-superficie-2 text-2xl font-bold disabled:opacity-30';
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4">
      <p className="text-sm font-bold text-texto-2">Reserva de emergência</p>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" className={botao} aria-label="Menos um mês" disabled={valor <= 1} onClick={() => aoMudar(limitarMesesReserva(valor - 1))}>−</button>
        <p className="text-center">
          <span className="block text-4xl font-extrabold tabular-nums">{valor}</span>
          <span className="text-sm text-texto-2">{valor === 1 ? 'mês' : 'meses'} de custo fixo</span>
        </p>
        <button type="button" className={botao} aria-label="Mais um mês" disabled={valor >= 24} onClick={() => aoMudar(limitarMesesReserva(valor + 1))}>+</button>
      </div>
      <p className="mt-3 text-center text-xs text-texto-2">Sugestão para o seu perfil: {faixa[0]} a {faixa[1]} meses.</p>
    </div>
  );
}

type Passo = 'perfil' | 'contas' | 'salario' | 'fixos' | 'comissao' | 'cartoes' | 'reserva';

function passosDo(perfil: PerfilRenda): Passo[] {
  return ['perfil', 'contas', ...(temSalario(perfil) ? ['salario' as const] : []), 'fixos',
    ...(temComissao(perfil) ? ['comissao' as const] : []), 'cartoes', 'reserva'];
}

const TEXTOS: Record<Passo, { titulo: string; descricao: string }> = {
  perfil: { titulo: 'Como você recebe?', descricao: 'Escolha uma opção. Dá para mudar depois.' },
  contas: { titulo: 'Onde está seu dinheiro?', descricao: 'Cadastre suas contas com o saldo de hoje. O saldo previsto de cada dia parte daqui.' },
  salario: { titulo: 'Quanto é seu salário?', descricao: 'O valor que cai na conta. O app já lança essa entrada em todos os meses.' },
  fixos: { titulo: 'Quais contas você paga todo mês?', descricao: 'Aluguel, luz, internet, academia, assinaturas. Elas entram sozinhas e você só lança o resto.' },
  comissao: { titulo: 'Quanto você recebe num mês fraco?', descricao: 'Mesmo sendo variável, uma estimativa por baixo deixa a previsão confiável. Se entrar mais, melhor.' },
  cartoes: { titulo: 'Usa cartão de crédito?', descricao: 'Com o dia de fechamento, o app sabe em qual fatura cada compra cai.' },
  reserva: { titulo: 'Quanto quer guardar de reserva?', descricao: 'Em meses de custo fixo. Com renda variável, uma reserva maior dá mais tranquilidade.' },
};

/** Próxima data com esse dia do mês (hoje ou depois). */
function proximoDia(dia: number): string {
  const hoje = hojeISO();
  const neste = dataDaRecorrencia(mesDe(hoje), dia);
  return neste >= hoje ? neste : dataDaRecorrencia(somarMeses(mesDe(hoje), 1), dia);
}

export function Onboarding() {
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const contas = useConsulta(() => repositorio.contas.listar(), []);
  const recs = useConsulta(() => repositorio.recorrencias.listar(), []);
  const salarioSalvo = useConsulta(() => rendaConfigurada('salario'), []);
  const comissaoSalva = useConsulta(() => rendaConfigurada('comissao'), []);
  const [passo, setPasso] = useState<Passo>('perfil');
  const [perfil, setPerfil] = useState<PerfilRenda | null>(null);
  const [salario, setSalario] = useState<number | null>(null);
  const [diaSalario, setDiaSalario] = useState<string | null>(null);
  const [comissao, setComissao] = useState<number | null>(null);
  const [freq, setFreq] = useState<Frequencia | null>(null);
  const [inicioComissao, setInicioComissao] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const perfilAtual = perfil ?? config?.perfilRenda ?? 'variavel';
  const PASSOS = passosDo(perfilAtual);
  const i = PASSOS.indexOf(passo);

  // valores atuais (o que a pessoa digitou ou o que já estava salvo)
  const vSalario = salario ?? (salarioSalvo?.modelo.valor ?? 0);
  const vDia = diaSalario ?? String(salarioSalvo?.diaDoMes ?? 5);
  const vFreq: Frequencia = freq ?? comissaoSalva?.frequencia ?? 'mensal';
  const vComissao = comissao ?? (comissaoSalva ? comissaoSalva.modelo.valor! * (vFreq === 'semanal' ? 52 / 12 : vFreq === 'quinzenal' ? 26 / 12 : 1) : 0);
  const vInicio = inicioComissao ?? comissaoSalva?.dataInicio ?? somarDias(hojeISO(), 7);
  const custoFixo = custoFixoMensal(recs ?? []);
  const contaId = config?.contaPadraoId ?? contas?.[0]?.id ?? '';

  async function avancar() {
    setErro('');
    if (passo === 'perfil') {
      await garantirCategoriasPadrao();
      const mudou = perfilAtual !== config?.perfilRenda || !config?.onboardingConcluido;
      await repositorio.salvarConfig({ perfilRenda: perfilAtual, ...(mudou ? { mesesReservaAlvo: PERFIS[perfilAtual].mesesReservaAlvo } : {}) });
    }
    if (passo === 'salario') {
      const dia = Number(vDia);
      if (vSalario <= 0) return setErro('Informe quanto cai na conta por mês.');
      if (!(dia >= 1 && dia <= 31)) return setErro('Informe o dia em que o salário cai (1 a 31).');
      await configurarRenda({ tipo: 'salario', porRecebimento: vSalario, mensal: vSalario, frequencia: 'mensal', dataInicio: proximoDia(dia), contaId });
    }
    if (passo === 'comissao' && vComissao > 0) {
      const mensal = Math.round(vComissao);
      const inicio = vFreq === 'mensal' ? proximoDia(Number(vInicio.slice(8, 10))) : vInicio;
      await configurarRenda({ tipo: 'comissao', porRecebimento: valorPorRecebimento(mensal, vFreq), mensal, frequencia: vFreq, dataInicio: inicio, contaId });
    }
    if (passo === 'reserva') {
      await repositorio.salvarConfig({ onboardingConcluido: true });
      location.hash = '';
      return;
    }
    setPasso(PASSOS[i + 1]);
    window.scrollTo(0, 0);
  }

  const podeAvancar = passo !== 'contas' || (contas?.length ?? 0) > 0;
  const opcional = passo === 'fixos' || passo === 'cartoes' || passo === 'comissao';
  const { titulo, descricao } = TEXTOS[passo];

  let conteudo: ReactNode;
  if (passo === 'perfil') {
    conteudo = (
      <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Como você recebe">
        {PERFIS_NA_ABERTURA.map((p) => {
          const marcado = perfilAtual === p;
          return (
            <li key={p}>
              <button type="button" role="radio" aria-checked={marcado} onClick={() => setPerfil(p)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-superficie px-4 py-3.5 text-left transition ${marcado ? 'border-destaque' : 'border-borda'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${marcado ? 'border-destaque' : 'border-borda'}`}>
                  {marcado && <span className="h-2.5 w-2.5 rounded-full bg-destaque" />}
                </span>
                <span>
                  <span className="block font-bold">{PERFIS[p].rotulo}</span>
                  <span className="block text-sm text-texto-2">{PERFIS[p].descricao}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  } else if (passo === 'contas') conteudo = <CadastroContas />;
  else if (passo === 'salario') conteudo = (
    <div className="flex flex-col gap-4">
      <CampoValor rotulo="Quanto cai na conta por mês" valor={vSalario} aoMudar={setSalario} ajuda="O valor líquido, depois dos descontos." />
      <CampoNumero rotulo="Em que dia cai" valor={vDia} aoMudar={setDiaSalario} />
      <p className="rounded-2xl bg-saldo-ok px-4 py-3 text-sm">Entra como <b>certo</b>, todo mês, a partir de {formatarData(proximoDia(Number(vDia) || 1))}.</p>
    </div>
  );
  else if (passo === 'fixos') conteudo = <CadastroFixos />;
  else if (passo === 'comissao') {
    const nec = necessarioParaFixos(custoFixo, temSalario(perfilAtual) ? vSalario : 0, Math.round(vComissao));
    conteudo = (
      <div className="flex flex-col gap-4">
        <CampoValor rotulo={temSalario(perfilAtual) ? 'Comissão num mês fraco (além do salário)' : 'Num mês fraco, quanto entra no total'} valor={Math.round(vComissao)} aoMudar={setComissao}
          ajuda="Pense num mês ruim dos últimos meses. É melhor errar para menos." />
        <Segmentos rotulo="Como costuma cair" valor={vFreq} aoMudar={setFreq}
          opcoes={[{ valor: 'semanal', rotulo: 'Toda semana' }, { valor: 'quinzenal', rotulo: 'A cada 15 dias' }, { valor: 'mensal', rotulo: '1 vez no mês' }]} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inicio-comissao" className="text-sm font-bold text-texto-2">{vFreq === 'mensal' ? 'Em que dia costuma cair' : 'Quando cai a próxima'}</label>
          <input id="inicio-comissao" type="date" value={vInicio} onChange={(e) => e.target.value && setInicioComissao(e.target.value)}
            className="rounded-2xl border border-borda bg-superficie px-4 py-3 text-base text-texto" />
        </div>
        {vComissao > 0 && vFreq !== 'mensal' && (
          <p className="text-sm text-texto-2">Vai entrar como <b className="text-texto">{formatarReais(valorPorRecebimento(Math.round(vComissao), vFreq))}</b> {vFreq === 'semanal' ? 'por semana' : 'a cada 15 dias'}, como <b>provável</b>: aparece na previsão, mas o “livre para gastar hoje” só conta quando cair.</p>
        )}
        <div className={`rounded-2xl px-4 py-4 ${nec.sobraNoMesFraco !== null && nec.sobraNoMesFraco < 0 ? 'bg-saldo-apertado' : 'bg-saldo-ok'}`}>
          <p className="text-sm font-bold text-texto-2">Para pagar seus fixos ({formatarReais(custoFixo)} por mês)</p>
          {nec.porMes > 0 ? (
            <p className="mt-1 text-lg">você precisa fazer pelo menos <b>{formatarReais(nec.porMes)} por mês</b>, cerca de <b>{formatarReais(nec.porSemana)} por semana</b>.</p>
          ) : (
            <p className="mt-1 text-lg">{temSalario(perfilAtual) ? 'o salário já cobre os fixos.' : 'cadastre seus fixos no passo anterior.'}</p>
          )}
          {vComissao > 0 && nec.sobraNoMesFraco !== null && custoFixo > 0 && (
            <p className="mt-2 text-sm">
              {nec.sobraNoMesFraco >= 0
                ? <>Num mês fraco, sobram <b>{formatarReais(nec.sobraNoMesFraco)}</b> depois dos fixos.</>
                : <>Num mês fraco, faltam <b className="text-saida">{formatarReais(-nec.sobraNoMesFraco)}</b> para os fixos. A reserva ajuda a cobrir esses meses.</>}
            </p>
          )}
        </div>
      </div>
    );
  }
  else if (passo === 'cartoes') conteudo = <CadastroCartoes />;
  else conteudo = config && (
    <SeletorMeses valor={config.mesesReservaAlvo} faixa={PERFIS[config.perfilRenda].faixaReserva}
      aoMudar={(m) => repositorio.salvarConfig({ mesesReservaAlvo: m })} />
  );

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-36">
      <div className="mb-6 flex gap-1.5" aria-label={`Passo ${i + 1} de ${PASSOS.length}`}>
        {PASSOS.map((p, n) => (
          <span key={p} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-destaque' : 'bg-borda'}`} />
        ))}
      </div>
      {i === 0 && <p className="mb-1 text-sm font-bold text-destaque">Vamos configurar seu app</p>}
      <h1 className="text-2xl font-extrabold tracking-tight text-balance">{titulo}</h1>
      <p className="mt-1.5 mb-5 text-texto-2">{descricao}</p>
      {conteudo}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-fundo/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {erro && <p className="mx-auto mb-2 max-w-md text-center text-sm font-semibold text-saida">{erro}</p>}
        <div className="mx-auto flex max-w-md gap-2">
          {i > 0 && <Botao tipo="secundario" className="flex-1" onClick={() => { setErro(''); setPasso(PASSOS[i - 1]); }}>Voltar</Botao>}
          <Botao className="flex-[2]" onClick={avancar} disabled={!podeAvancar}>
            {passo === 'reserva' ? 'Começar a usar' : passo === 'comissao' && vComissao <= 0 ? 'Pular' : 'Continuar'}
          </Botao>
        </div>
        {!podeAvancar && <p className="mx-auto mt-2 max-w-md text-center text-xs text-texto-2">Cadastre pelo menos uma conta para continuar.</p>}
        {opcional && <p className="mx-auto mt-2 max-w-md text-center text-xs text-texto-2">Este passo é opcional.</p>}
      </div>
    </main>
  );
}
