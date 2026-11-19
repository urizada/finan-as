import { Cartao, EmConstrucao, Tela } from '../componentes/Tela';
import { IconeSeta } from '../componentes/Icones';
import { linkPara } from '../navegacao';

export function Totais() {
  return (
    <Tela titulo="Totais">
      <EmConstrucao fase={5} itens={['Entrou − saiu no mês', 'Custo de vida', 'Gasto diário médio x livre por dia', 'Economizado: % guardado por mês e no ano']} />
      <a href={linkPara('previsao')} className="mt-4 block">
        <Cartao className="flex items-center gap-3 hover:bg-superficie-2">
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Previsão</span>
            <span className="block text-sm text-texto-2">3, 6 e 12 meses</span>
          </span>
          <IconeSeta className="h-5 w-5 text-texto-2" />
        </Cartao>
      </a>
    </Tela>
  );
}

export function Previsao() {
  return (
    <Tela titulo="Previsão" voltar={linkPara('totais')}>
      <EmConstrucao fase={7} itens={['Gráfico de 12 meses: pessimista, base e otimista', 'Saldo acumulado e evolução da reserva', 'Ponto de equilíbrio e produção necessária']} />
    </Tela>
  );
}
