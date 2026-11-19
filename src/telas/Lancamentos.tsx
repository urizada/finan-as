import { EmConstrucao, Tela } from '../componentes/Tela';
import { linkPara } from '../navegacao';

export function Lancamentos() {
  return (
    <Tela titulo="Lançamentos" voltar={linkPara('mais')}>
      <EmConstrucao fase={2} itens={['Lista por dia', 'Filtros por mês, categoria, cartão e tipo', 'Editar e excluir', 'Recorrências do mês geradas automaticamente']} />
    </Tela>
  );
}
