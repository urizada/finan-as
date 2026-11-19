import { EmConstrucao, Tela } from '../componentes/Tela';
import { linkPara } from '../navegacao';

const voltar = linkPara('mais');

export const ParaOndeFoi = () => (
  <Tela titulo="Para onde foi" voltar={voltar}>
    <EmConstrucao fase={7} itens={['Gastos por categoria (gráfico)', 'Fixo x variável', 'Comparação com meses anteriores']} />
  </Tela>
);
