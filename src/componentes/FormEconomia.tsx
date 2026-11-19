// Economia: tira da conta e guarda na reserva (ou em outra meta). Sai do saldo da conta.
import { useState } from 'react';
import { repositorio } from '../data/repositorio';
import { criarLancamento, garantirReserva } from '../data/servicos';
import type { Cadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { hojeISO } from '../calculos/datas';
import { valido, type Erros } from '../calculos/validacoes';
import type { Frequencia, Lancamento } from '../tipos';
import { Acoes } from './formularios';
import { CampoVezes } from './lancamentos';
import { CampoEscolha, CampoTexto, CampoValor, Segmentos } from './ui';

export function FormEconomia({ cad, aoFechar, dataInicial }: { cad: Cadastros; aoFechar: () => void; dataInicial?: string }) {
  const metas = useConsulta(async () => { await garantirReserva(); return repositorio.metas.listar(); }, []);
  const investimentos = useConsulta(() => repositorio.investimentos.listar(), []) ?? [];
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(dataInicial ?? hojeISO());
  const [contaId, setContaId] = useState(cad.contaPadraoId ?? cad.contas[0]?.id ?? '');
  const [metaId, setMetaId] = useState('');
  const [novaMeta, setNovaMeta] = useState('');
  const [repetir, setRepetir] = useState<'nao' | Frequencia>('nao');
  const [vezes, setVezes] = useState<number | null>(null);
  const [erros, setErros] = useState<Erros>({});
  const metaEscolhida = metaId || metas?.find((m) => m.tipo === 'reserva_emergencia')?.id || '';

  async function salvar() {
    const e: Erros = {};
    if (valor <= 0) e.valor = 'Informe quanto vai guardar.';
    if (!contaId) e.contaId = 'Escolha de qual conta sai.';
    if (metaEscolhida === 'nova' && !novaMeta.trim()) e.meta = 'Dê um nome para a meta.';
    if (repetir !== 'nao' && vezes !== null && vezes < 2) e.vezes = 'Use 2 vezes ou mais, ou escolha "Sem fim".';
    setErros(e);
    if (!valido(e)) return;
    const inv = investimentos.find((i) => `inv:${i.id}` === metaEscolhida);
    const meta = inv ? null : metaEscolhida === 'nova'
      ? await repositorio.metas.criar({ nome: novaMeta.trim(), tipo: 'meta', valorAlvo: 0, saldoAtual: 0, criadaEm: hojeISO() })
      : metas!.find((m) => m.id === metaEscolhida)!;
    const destino = inv ? { tipo: 'investimento' as const, id: inv.id, nome: inv.nome } : { tipo: 'meta' as const, id: meta!.id, nome: meta!.nome };
    const dados: Omit<Lancamento, 'id'> = {
      tipo: 'transferencia', valor, data, descricao: `Guardado: ${destino.nome}`, contaId,
      destino: { tipo: destino.tipo, id: destino.id }, certeza: 'garantida', status: data <= hojeISO() ? 'realizado' : 'previsto',
    };
    await criarLancamento(dados, { repeticao: repetir !== 'nao' ? { frequencia: repetir, vezes } : undefined });
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-saldo-ok px-4 py-3 text-sm">O valor sai da conta e vai para a reserva ou a meta. Aparece nas saídas do dia.</p>
      <CampoValor rotulo="Quanto vai guardar" valor={valor} aoMudar={setValor} erro={erros.valor} />
      <CampoEscolha rotulo="Guardar em" valor={metaEscolhida} aoMudar={setMetaId} erro={erros.meta}
        opcoes={[...(metas ?? []).map((m) => ({ valor: m.id, rotulo: m.nome })), ...investimentos.map((i) => ({ valor: `inv:${i.id}`, rotulo: `Investimento: ${i.nome}` })), { valor: 'nova', rotulo: '+ Nova meta…' }]} />
      {metaEscolhida === 'nova' && <CampoTexto rotulo="Nome da meta" valor={novaMeta} aoMudar={setNovaMeta} placeholder="ex.: Viagem, Carro" />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="eco-data" className="text-sm font-bold text-texto-2">Data</label>
        <input id="eco-data" type="date" value={data} onChange={(e) => e.target.value && setData(e.target.value)}
          className="rounded-2xl border border-borda bg-superficie px-4 py-3 text-base text-texto" />
      </div>
      {cad.contas.length > 1 && (
        <CampoEscolha rotulo="Sai da conta" valor={contaId} aoMudar={setContaId} erro={erros.contaId}
          opcoes={cad.contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
      )}
      <Segmentos rotulo="Repetir" valor={repetir} aoMudar={setRepetir}
        opcoes={[{ valor: 'nao', rotulo: 'Só agora' }, { valor: 'mensal', rotulo: 'Todo mês' }, { valor: 'semanal', rotulo: 'Toda semana' }]} />
      {repetir !== 'nao' && <CampoVezes vezes={vezes} aoMudar={setVezes} inicio={data} frequencia={repetir} />}
      {erros.vezes && <p className="text-sm font-semibold text-saida">{erros.vezes}</p>}
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar} />
    </div>
  );
}
