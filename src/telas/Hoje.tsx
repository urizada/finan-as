import { useCallback, useState } from 'react';
import { Cartao, EmConstrucao, Tela } from '../componentes/Tela';
import { LancamentoRapido } from '../componentes/LancamentoRapido';
import { FormLancamento, type InicialLancamento } from '../componentes/lancamentos';
import { Folha } from '../componentes/ui';
import { useCadastros } from '../data/useCadastros';
import { nomeDoMes, mesDe, hojeISO } from '../calculos/datas';

export function Hoje() {
  const mes = nomeDoMes(mesDe(hojeISO()));
  const cad = useCadastros();
  const [detalhes, setDetalhes] = useState<InicialLancamento | null>(null);
  const fechar = useCallback(() => setDetalhes(null), []);
  return (
    <Tela titulo="Hoje">
      {cad && <div className="mb-4"><LancamentoRapido cad={cad} aoDetalhes={setDetalhes} /></div>}
      <Cartao className="mb-4">
        <p className="text-sm font-medium text-texto-2">Livre hoje</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-texto-2/60">R$ —</p>
        <p className="mt-2 text-sm text-texto-2">Ainda posso hoje: —</p>
        <p className="mt-3 text-xs text-texto-2">{mes[0].toUpperCase() + mes.slice(1)}</p>
      </Cartao>
      <EmConstrucao fase={5} itens={['Livre hoje e “ainda posso hoje”', 'Visão geral: contas chegando e situação das contas', 'Resumo do mês, fatura atual, reserva e fôlego', 'Alerta de caixa']} />
      <Folha aberta={detalhes !== null} titulo="Novo lançamento" aoFechar={fechar}>
        {cad && detalhes && <FormLancamento cad={cad} inicial={detalhes} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}
