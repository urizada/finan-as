import { EmConstrucao, Tela } from '../componentes/Tela';
import { linkPara } from '../navegacao';

const voltar = linkPara('mais');

export const ParaOndeFoi = () => (
  <Tela titulo="Para onde foi" voltar={voltar}>
    <EmConstrucao fase={7} itens={['Gastos por categoria (gráfico)', 'Fixo x variável', 'Comparação com meses anteriores']} />
  </Tela>
);
export const Cartoes = () => (
  <Tela titulo="Cartões" voltar={voltar}>
    <EmConstrucao fase={4} itens={['Fatura atual e futuras', 'Parcelas', 'Limite usado e disponível', 'Melhor dia de compra']} />
  </Tela>
);
export const Metas = () => (
  <Tela titulo="Reserva e metas" voltar={voltar}>
    <EmConstrucao fase={6} itens={['Reserva em meses e fôlego', 'Progresso e aporte necessário', 'Botão “aportar”']} />
  </Tela>
);
export const Investimentos = () => (
  <Tela titulo="Investimentos" voltar={voltar}>
    <EmConstrucao fase={6} itens={['Total da carteira', 'Distribuição por tipo', 'Atualizar saldo e ver evolução']} />
  </Tela>
);
