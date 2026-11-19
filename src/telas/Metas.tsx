// Reserva e metas: quantos meses de reserva, fôlego, e metas com prazo.
import { useCallback, useState } from 'react';
import { Tela } from '../componentes/Tela';
import { Acoes } from '../componentes/formularios';
import { Botao, CampoEscolha, CampoTexto, CampoValor, Folha, Segmentos } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { movimentarDestino, patrimonio, type LinhaMeta } from '../data/servicos';
import { useCadastros } from '../data/useCadastros';
import { useConsulta } from '../data/useConsulta';
import { formatarData, hojeISO } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { formatarMeses, type StatusMeta } from '../calculos/metas';
import { linkPara } from '../navegacao';
import type { Meta } from '../tipos';

type Aberto = { tipo: 'mover'; meta: Meta; retirada: boolean } | { tipo: 'meta'; meta?: Meta } | null;

const STATUS: Record<StatusMeta, { rotulo: string; cor: string }> = {
  concluida: { rotulo: 'Concluída', cor: 'bg-saldo-ok text-entrada' },
  adiantada: { rotulo: 'Adiantada', cor: 'bg-saldo-ok text-entrada' },
  'no ritmo': { rotulo: 'No ritmo', cor: 'bg-superficie-2 text-texto-2' },
  atrasada: { rotulo: 'Atrasada', cor: 'bg-saldo-apertado text-texto' },
};

function Progresso({ pct, cor = 'bg-destaque' }: { pct: number; cor?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-superficie-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function Metas() {
  const p = useConsulta(() => patrimonio(), []);
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const r = p?.reserva;

  return (
    <Tela titulo="Reserva e metas" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-5">
        {r && p && (
          <section className="rounded-3xl bg-saldo-ok px-5 py-5">
            <p className="text-sm font-bold text-texto-2">Reserva de emergência</p>
            {r.meses !== null ? (
              <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums">
                {formatarMeses(r.meses)} <span className="text-xl font-bold text-texto-2">de {r.mesesAlvo} meses</span>
              </p>
            ) : (
              <p className="mt-1 text-4xl font-extrabold tabular-nums">{formatarReais(r.saldo)}</p>
            )}
            <div className="mt-3"><Progresso pct={r.pct} /></div>
            <p className="mt-2 text-sm">
              {formatarReais(r.saldo)} guardados{r.alvo > 0 && <> de {formatarReais(r.alvo)}</>}
              {r.alvo > r.saldo && <> · faltam <b>{formatarReais(r.alvo - r.saldo)}</b></>}
            </p>
            {r.folego !== null ? (
              <p className="mt-3 rounded-2xl bg-fundo/60 px-4 py-3 text-sm">
                Se parar de entrar dinheiro, você aguenta <b>{formatarMeses(r.folego)} {r.folego === 1 ? 'mês' : 'meses'}</b> com o que tem na conta e na reserva.
              </p>
            ) : (
              <p className="mt-3 text-sm text-texto-2">Cadastre seus fixos para ver a reserva em meses.</p>
            )}
            <div className="mt-4 flex gap-2">
              <Botao className="flex-[2]" onClick={() => setAberto({ tipo: 'mover', meta: r.meta, retirada: false })}>Guardar</Botao>
              <Botao tipo="secundario" className="flex-1" onClick={() => setAberto({ tipo: 'mover', meta: r.meta, retirada: true })}>Usar</Botao>
            </div>
            <p className="mt-3 text-xs text-texto-2">Alvo: {r.mesesAlvo} meses × {formatarReais(p.custoFixo)} de fixos por mês. Mude os meses em Configurações.</p>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wider text-texto-2">Metas</h2>
          {p?.metas.length === 0 && (
            <p className="rounded-2xl border border-dashed border-borda px-4 py-5 text-center text-sm text-texto-2">Nenhuma meta ainda. Ex.: viagem, carro, curso.</p>
          )}
          {p?.metas.map((m) => <CartaoMeta key={m.meta.id} m={m} abrir={setAberto} />)}
          <button type="button" onClick={() => setAberto({ tipo: 'meta' })} className="rounded-2xl border border-dashed border-borda py-3.5 font-bold text-destaque">+ Nova meta</button>
        </section>
      </div>

      <Folha aberta={aberto !== null} aoFechar={fechar}
        titulo={aberto?.tipo === 'mover' ? `${aberto.retirada ? 'Usar de' : 'Guardar em'} ${aberto.meta.nome}` : aberto?.tipo === 'meta' ? (aberto.meta ? 'Editar meta' : 'Nova meta') : ''}>
        {aberto?.tipo === 'mover' && <Mover meta={aberto.meta} retirada={aberto.retirada} aoFechar={fechar} />}
        {aberto?.tipo === 'meta' && <FormMeta item={aberto.meta} aoFechar={fechar} />}
      </Folha>
    </Tela>
  );
}

function CartaoMeta({ m, abrir }: { m: LinhaMeta; abrir: (a: Aberto) => void }) {
  const st = m.status ? STATUS[m.status] : null;
  return (
    <article className="rounded-2xl border border-borda bg-superficie px-4 py-4">
      <button type="button" onClick={() => abrir({ tipo: 'meta', meta: m.meta })} className="w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{m.meta.nome}</h3>
          {st && <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.cor}`}>{st.rotulo}</span>}
        </div>
        <p className="mt-1 text-sm tabular-nums"><b>{formatarReais(m.saldo)}</b> <span className="text-texto-2">de {formatarReais(m.meta.valorAlvo)}</span></p>
        <div className="mt-2"><Progresso pct={m.pct} /></div>
        <p className="mt-2 text-sm text-texto-2">
          {m.meta.prazo ? <>Até {formatarData(m.meta.prazo)}{m.aporteMensal ? <> · guarde <b className="text-texto">{formatarReais(m.aporteMensal)} por mês</b></> : null}</> : 'Sem prazo'}
        </p>
      </button>
      <div className="mt-3 flex gap-2">
        <Botao className="flex-[2] py-2.5" onClick={() => abrir({ tipo: 'mover', meta: m.meta, retirada: false })}>Guardar</Botao>
        <Botao tipo="secundario" className="flex-1 py-2.5" onClick={() => abrir({ tipo: 'mover', meta: m.meta, retirada: true })}>Usar</Botao>
      </div>
    </article>
  );
}

function Mover({ meta, retirada, aoFechar }: { meta: Meta; retirada: boolean; aoFechar: () => void }) {
  const cad = useCadastros();
  const [valor, setValor] = useState(0);
  const [contaId, setContaId] = useState('');
  const conta = contaId || cad?.contaPadraoId || cad?.contas[0]?.id || '';
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-2">{retirada ? 'O valor sai da meta e volta para a conta hoje.' : 'O valor sai da conta hoje e fica guardado na meta.'}</p>
      <CampoValor rotulo={retirada ? 'Quanto vai usar' : 'Quanto vai guardar'} valor={valor} aoMudar={setValor} />
      {cad && cad.contas.length > 1 && (
        <CampoEscolha rotulo={retirada ? 'Volta para a conta' : 'Sai da conta'} valor={conta} aoMudar={setContaId} opcoes={cad.contas.map((c) => ({ valor: c.id, rotulo: c.nome }))} />
      )}
      <Botao disabled={valor <= 0} onClick={async () => { await movimentarDestino({ tipo: 'meta', id: meta.id, nome: meta.nome }, valor, retirada, conta); aoFechar(); }}>
        {retirada ? 'Usar' : 'Guardar'} {formatarReais(valor)}
      </Botao>
    </div>
  );
}

function FormMeta({ item, aoFechar }: { item?: Meta; aoFechar: () => void }) {
  const [nome, setNome] = useState(item?.nome ?? '');
  const [alvo, setAlvo] = useState(item?.valorAlvo ?? 0);
  const [temPrazo, setTemPrazo] = useState<'sim' | 'nao'>(item && !item.prazo ? 'nao' : 'sim');
  const [prazo, setPrazo] = useState(item?.prazo ?? '');
  const [jaTem, setJaTem] = useState(item?.saldoAtual ?? 0);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!nome.trim()) return setErro('Dê um nome para a meta.');
    if (alvo <= 0) return setErro('Informe quanto quer juntar.');
    if (temPrazo === 'sim' && (!prazo || prazo <= hojeISO())) return setErro('Escolha uma data no futuro para o prazo.');
    const dados: Omit<Meta, 'id'> = { nome: nome.trim(), tipo: 'meta', valorAlvo: alvo, saldoAtual: jaTem, criadaEm: item?.criadaEm ?? hojeISO(), prazo: temPrazo === 'sim' ? prazo : undefined };
    if (item) await repositorio.metas.salvar({ ...item, ...dados });
    else await repositorio.metas.criar(dados);
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} placeholder="ex.: Viagem, Carro, Curso" autoFocus={!item} />
      <CampoValor rotulo="Quanto quer juntar" valor={alvo} aoMudar={setAlvo} />
      <Segmentos rotulo="Tem prazo?" valor={temPrazo} aoMudar={setTemPrazo} opcoes={[{ valor: 'sim', rotulo: 'Sim' }, { valor: 'nao', rotulo: 'Sem prazo' }]} />
      {temPrazo === 'sim' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="meta-prazo" className="text-sm font-bold text-texto-2">Até quando</label>
          <input id="meta-prazo" type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="rounded-2xl border border-borda bg-superficie px-4 py-3 text-base text-texto" />
        </div>
      )}
      <CampoValor rotulo="Quanto já tem guardado para ela" valor={jaTem} aoMudar={setJaTem} ajuda="Dinheiro que já estava separado antes. O que você guardar pelo app soma a este valor." />
      {erro && <p className="text-sm font-semibold text-saida">{erro}</p>}
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.metas.excluir(item.id); aoFechar(); } : undefined} />
      {item && <p className="text-xs text-texto-2">Excluir a meta não apaga o que já foi guardado: esse dinheiro continua aparecendo como economia nos dias em que foi guardado.</p>}
    </div>
  );
}
