import { Cartao, EmConstrucao, Tela } from '../componentes/Tela';
import { nomeDoMes, mesDe, hojeISO } from '../calculos/datas';

export function Hoje() {
  const mes = nomeDoMes(mesDe(hojeISO()));
  return (
    <Tela titulo="Hoje">
      <Cartao className="mb-4">
        <p className="text-sm font-medium text-texto-2">Livre hoje</p>
        <p className="mt-1 text-5xl font-extrabold tracking-tight text-texto-2/60">R$ —</p>
        <p className="mt-2 text-sm text-texto-2">Ainda posso hoje: —</p>
        <p className="mt-3 text-xs text-texto-2">{mes[0].toUpperCase() + mes.slice(1)}</p>
      </Cartao>
      <EmConstrucao
        fase={5}
        itens={[
          'Livre hoje e “ainda posso hoje”',
          'Lançamento rápido pelo botão + (Fase 3)',
          'Resumo do mês, fatura atual, reserva e fôlego',
          'Alerta de caixa',
        ]}
      />
    </Tela>
  );
}
