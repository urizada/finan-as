import { useCallback, useEffect, useState } from 'react';
import { BarraNavegacao } from './componentes/BarraNavegacao';
import { PainelLancamento } from './componentes/PainelLancamento';
import { DivisaoEntrada } from './componentes/DivisaoEntrada';
import { Folha } from './componentes/ui';
import { aoReceberEntrada } from './data/eventos';
import { repositorio } from './data/repositorio';
import { useConsulta } from './data/useConsulta';
import { useRota, type Rota } from './navegacao';
import { Hoje } from './telas/Hoje';
import { Lancamentos } from './telas/Lancamentos';
import { Mais } from './telas/Mais';
import { Saldos } from './telas/Saldos';
import { Horizonte } from './telas/Horizonte';
import { Previsao, Totais } from './telas/Totais';
import { ParaOndeFoi } from './telas/Secundarias';
import { Metas } from './telas/Metas';
import { Investimentos } from './telas/Investimentos';
import { Limites } from './telas/Limites';
import { Cartoes } from './telas/Cartoes';
import { Configuracoes } from './telas/Configuracoes';
import { Onboarding } from './telas/Onboarding';

const TELAS: Record<Rota, () => React.JSX.Element> = {
  hoje: Hoje,
  saldos: Saldos,
  horizonte: Horizonte,
  limites: Limites,
  totais: Totais,
  mais: Mais,
  lancamentos: Lancamentos,
  previsao: Previsao,
  'para-onde-foi': ParaOndeFoi,
  cartoes: Cartoes,
  metas: Metas,
  investimentos: Investimentos,
  configuracoes: Configuracoes,
};

export function App() {
  const rota = useRota();
  const [lancando, setLancando] = useState(false);
  const fechar = useCallback(() => setLancando(false), []);
  const config = useConsulta(() => repositorio.obterConfig(), []);
  useEffect(() => setLancando(false), [rota]);
  const [entrada, setEntrada] = useState<number | null>(null);
  const fecharDivisao = useCallback(() => setEntrada(null), []);
  const sugerir = config?.sugerirDivisao ?? true;
  useEffect(() => aoReceberEntrada((v) => { if (sugerir) { setLancando(false); setEntrada(v); } }), [sugerir]);

  useEffect(() => {
    const tema = config?.tema ?? 'claro';
    document.documentElement.dataset.tema = tema;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'escuro' ? '#0e1412' : '#f3f6f4');
  }, [config?.tema]);

  if (!config) return null;
  if (!config.onboardingConcluido) return <Onboarding />;

  const TelaAtual = TELAS[rota];
  return (
    <>
      <TelaAtual />
      <BarraNavegacao rota={rota} aoLancar={() => setLancando(true)} />
      <PainelLancamento aberto={lancando} aoFechar={fechar} />
      <Folha aberta={entrada !== null} titulo="Como usar essa entrada?" aoFechar={fecharDivisao}>
        {entrada !== null && <DivisaoEntrada valor={entrada} aoFechar={fecharDivisao} />}
      </Folha>
    </>
  );
}
