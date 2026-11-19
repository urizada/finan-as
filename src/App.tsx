import { useCallback, useEffect, useState } from 'react';
import { BarraNavegacao } from './componentes/BarraNavegacao';
import { PainelLancamento } from './componentes/PainelLancamento';
import { repositorio } from './data/repositorio';
import { useConsulta } from './data/useConsulta';
import { useRota, type Rota } from './navegacao';
import { Hoje } from './telas/Hoje';
import { Lancamentos } from './telas/Lancamentos';
import { Mais } from './telas/Mais';
import { Saldos } from './telas/Saldos';
import { Previsao, Totais } from './telas/Totais';
import { Cartoes, Investimentos, Metas, ParaOndeFoi } from './telas/Secundarias';
import { Configuracoes } from './telas/Configuracoes';
import { Onboarding } from './telas/Onboarding';

const TELAS: Record<Rota, () => React.JSX.Element> = {
  hoje: Hoje,
  saldos: Saldos,
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
    </>
  );
}
