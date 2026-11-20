// Pergunta antes de salvar quando o gasto deixa a categoria perto ou acima do limite do mês.
import type { AvisoComCategoria } from '../data/servicos';
import { formatarReais } from '../calculos/dinheiro';

export function AvisoLimite({ aviso, aoVoltar, aoContinuar }: { aviso: AvisoComCategoria; aoVoltar: () => void; aoContinuar: () => void }) {
  const passou = aviso.estado === 'estourado';
  const pct = Math.min(100, Math.round((aviso.depois / aviso.limite) * 100));
  return (
    <div role="alertdialog" aria-label="Limite da categoria" className={`flex flex-col gap-3 rounded-2xl p-4 ${passou ? 'bg-saldo-negativo' : 'bg-saldo-apertado'}`}>
      <p className="font-bold">
        {passou ? `Este gasto passa do planejado para ${aviso.categoria.nome}` : `${aviso.categoria.nome} está perto do planejado`}
      </p>
      <p className="text-sm">
        Você já gastou <b>{formatarReais(aviso.antes)}</b> de <b>{formatarReais(aviso.limite)}</b> este mês.
        Com este gasto vai para <b>{formatarReais(aviso.depois)}</b>
        {passou ? <> — <b className="text-saida">{formatarReais(aviso.acima)} acima</b>.</> : <> ({aviso.pct}% do planejado).</>}
      </p>
      <div className="h-2.5 overflow-hidden rounded-full bg-fundo/70">
        <div className={`h-full rounded-full ${passou ? 'bg-saida' : 'bg-alerta'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm font-semibold">Tem certeza que quer continuar?</p>
      <div className="flex gap-2">
        <button type="button" onClick={aoVoltar} className="flex-1 rounded-2xl bg-fundo py-3 font-bold">Voltar</button>
        <button type="button" onClick={aoContinuar} className="flex-1 rounded-2xl bg-texto py-3 font-bold text-fundo">Continuar</button>
      </div>
    </div>
  );
}
