// Peças da Fase 2: formulário de lançamento, linha da lista e seletor de mês.
import { useId, useState } from 'react';
import { repositorio } from '../data/repositorio';
import { criarLancamento, excluirParcelas, marcarComoPago } from '../data/servicos';
import type { Cadastros } from '../data/useCadastros';
import { formatarData, hojeISO, nomeDoMes, paraISO, somarMeses } from '../calculos/datas';
import { dividirCentavos, formatarReais } from '../calculos/dinheiro';
import { ROTULO_FREQUENCIA, dataDaOcorrencia, rotuloRepeticao } from '../calculos/recorrencias';
import { statusSugerido, validarLancamento } from '../calculos/lancamentos';
import { NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA, ROTULO_CERTEZA } from '../calculos/padroes';
import { valido, type Erros } from '../calculos/validacoes';
import type { Certeza, DataISO, Frequencia, Lancamento, MesRef } from '../tipos';
import { Acoes } from './formularios';
import { IconeSeta, IconeVoltar } from './Icones';
import { Campo, CampoEscolha, CampoTexto, CampoValor, Segmentos } from './ui';

export function SeletorMes({ mes, aoMudar }: { mes: MesRef; aoMudar: (m: MesRef) => void }) {
  const atual = mes === hojeISO().slice(0, 7);
  return (
    <div className="flex items-center justify-between">
      <button type="button" aria-label="Mês anterior" onClick={() => aoMudar(somarMeses(mes, -1))} className="rounded-full p-2.5 hover:bg-superficie-2">
        <IconeVoltar className="h-5 w-5" />
      </button>
      <button type="button" onClick={() => aoMudar(hojeISO().slice(0, 7))} className="text-center" aria-label="Voltar para o mês atual">
        <span className="block font-bold first-letter:uppercase">{nomeDoMes(mes)}</span>
        {!atual && <span className="block text-xs font-bold text-destaque">voltar para hoje</span>}
      </button>
      <button type="button" aria-label="Próximo mês" onClick={() => aoMudar(somarMeses(mes, 1))} className="rounded-full p-2.5 hover:bg-superficie-2">
        <IconeSeta className="h-5 w-5" />
      </button>
    </div>
  );
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function rotuloDia(data: DataISO): string {
  const hoje = hojeISO();
  const ontem = paraISO(new Date(Date.now() - 864e5));
  const [a, m, d] = data.split('-').map(Number);
  const semana = DIAS[new Date(a, m - 1, d).getDay()];
  if (data === hoje) return `Hoje, ${formatarData(data).slice(0, 5)}`;
  if (data === ontem) return `Ontem, ${formatarData(data).slice(0, 5)}`;
  return `${semana[0].toUpperCase()}${semana.slice(1)}, ${formatarData(data).slice(0, 5)}`;
}

function CampoData({ valor, aoMudar, erro }: { valor: DataISO; aoMudar: (d: DataISO) => void; erro?: string }) {
  const id = useId();
  const hoje = hojeISO();
  const ontem = paraISO(new Date(Date.now() - 864e5));
  const chip = (d: DataISO, r: string) => (
    <button type="button" onClick={() => aoMudar(d)} aria-pressed={valor === d}
      className={`rounded-full px-3 py-1.5 text-sm font-bold ${valor === d ? 'bg-texto text-fundo' : 'bg-superficie-2 text-texto-2'}`}>{r}</button>
  );
  return (
    <Campo rotulo="Data" erro={erro} id={id}>
      <div className="flex items-center gap-2">
        {chip(hoje, 'Hoje')}
        {chip(ontem, 'Ontem')}
        <input id={id} type="date" value={valor} onChange={(e) => e.target.value && aoMudar(e.target.value)}
          className="min-w-0 flex-1 rounded-2xl border border-borda bg-superficie px-3 py-2.5 text-base text-texto" />
      </div>
    </Campo>
  );
}

export interface InicialLancamento extends Partial<Omit<Lancamento, 'id'>> {
  parcelas?: number;
  frequencia?: Frequencia;
  vezes?: number | null;
}

type Repetir = 'nao' | Frequencia;

/** "Sem fim" ou "N vezes", com a data da última vez. */
export function CampoVezes({ vezes, aoMudar, inicio, frequencia }: {
  vezes: number | null; aoMudar: (v: number | null) => void; inicio: DataISO; frequencia: Frequencia;
}) {
  const [texto, setTexto] = useState(vezes ? String(vezes) : '');
  const n = vezes && vezes >= 2 ? vezes : null;
  return (
    <div className="flex flex-col gap-2">
      <Segmentos valor={vezes === null ? 'sempre' : 'vezes'} aoMudar={(v) => aoMudar(v === 'sempre' ? null : Number(texto) || 2)}
        opcoes={[{ valor: 'sempre', rotulo: 'Sem fim' }, { valor: 'vezes', rotulo: 'Número de vezes' }]} />
      {vezes !== null && (
        <div className="flex items-center gap-3">
          <input inputMode="numeric" aria-label="Quantas vezes" value={texto}
            onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 3); setTexto(t); aoMudar(Number(t) || 0); }}
            className="w-20 rounded-2xl border border-borda bg-superficie px-3 py-2.5 text-center text-base font-bold" />
          <span className="text-sm text-texto-2">
            {n ? <>vezes · a última em <b className="text-texto">{formatarData(dataDaOcorrencia(inicio, frequencia, n))}</b></> : 'vezes (2 ou mais)'}
          </span>
        </div>
      )}
    </div>
  );
}

export function FormLancamento({ item, cad, dataInicial, inicial, aoFechar }: {
  item?: Lancamento; cad: Cadastros; dataInicial?: DataISO; inicial?: InicialLancamento; aoFechar: () => void;
}) {
  const base = item ?? inicial;
  const [tipo, setTipo] = useState<'saida' | 'entrada'>(base?.tipo === 'entrada' ? 'entrada' : 'saida');
  const [valor, setValor] = useState(base?.valor ?? 0);
  const [descricao, setDescricao] = useState(base?.descricao ?? '');
  const [data, setData] = useState(base?.data ?? dataInicial ?? hojeISO());
  const [categoriaId, setCategoriaId] = useState(base?.categoriaId ?? '');
  const [onde, setOnde] = useState(base?.cartaoId ? `cartao:${base.cartaoId}` : base?.contaId ? `conta:${base.contaId}` : '');
  const [certeza, setCerteza] = useState<Certeza>(base?.certeza ?? 'garantida');
  const [fonteId, setFonteId] = useState(base?.fonteRendaId ?? '');
  const [aconteceu, setAconteceu] = useState<boolean | null>(item ? item.status === 'realizado' : inicial?.status ? inicial.status === 'realizado' : null);
  const [parcelas, setParcelas] = useState(inicial?.parcelas ?? 1);
  const [repetir, setRepetir] = useState<Repetir>(inicial?.frequencia ?? 'nao');
  const [vezes, setVezes] = useState<number | null>(inicial?.vezes ?? null);
  const [erros, setErros] = useState<Erros>({});

  const catsDoTipo = cad.categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const outros = catsDoTipo.find((c) => c.nome === (tipo === 'saida' ? NOME_OUTROS_SAIDA : NOME_OUTROS_ENTRADA));
  const categoriaEscolhida = catsDoTipo.some((c) => c.id === categoriaId) ? categoriaId : outros?.id ?? '';
  const ondePadrao = `conta:${cad.contaPadraoId ?? cad.contas[0]?.id ?? ''}`;
  const ondeEscolhido = onde && !(tipo === 'entrada' && onde.startsWith('cartao:')) ? onde : ondePadrao;
  const noCartao = tipo === 'saida' && ondeEscolhido.startsWith('cartao:');
  const certezaFinal: Certeza = tipo === 'saida' ? 'garantida' : certeza;
  const realizado = aconteceu ?? statusSugerido(data, hojeISO(), certezaFinal) === 'realizado';
  const rec = cad.recorrencia(item?.recorrenciaId);
  const parcela = item?.parcela;
  const novo = !item;
  const parcelasFinal = noCartao ? parcelas : 1;
  const repetirFinal: Repetir = parcelasFinal > 1 ? 'nao' : repetir;

  async function salvar() {
    const [qual, id] = ondeEscolhido.split(':');
    const dados: Omit<Lancamento, 'id'> = {
      ...(item ?? {}), tipo, valor, descricao: descricao.trim(), data, certeza: certezaFinal,
      status: realizado ? 'realizado' : 'previsto',
      categoriaId: categoriaEscolhida || undefined,
      contaId: qual === 'conta' ? id : undefined,
      cartaoId: qual === 'cartao' ? id : undefined,
      fonteRendaId: tipo === 'entrada' && fonteId ? fonteId : undefined,
    };
    if (!item) delete (dados as Partial<Lancamento>).id;
    for (const k of Object.keys(dados) as (keyof typeof dados)[]) if (dados[k] === undefined) delete dados[k];
    const e = validarLancamento(dados);
    if (novo && repetirFinal !== 'nao' && vezes !== null && vezes < 2) e.vezes = 'Use 2 vezes ou mais, ou escolha "Sem fim".';
    setErros(e);
    if (!valido(e)) return;
    if (item) await repositorio.lancamentos.salvar({ ...dados, id: item.id });
    else await criarLancamento(dados, {
      parcelas: parcelasFinal,
      repeticao: repetirFinal !== 'nao' ? { frequencia: repetirFinal, vezes } : undefined,
    });
    aoFechar();
  }

  const opcoesOnde = [
    ...cad.contas.map((c) => ({ valor: `conta:${c.id}`, rotulo: c.nome })),
    ...(tipo === 'saida' ? cad.cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: `Cartão ${c.nome}` })) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {rec && (
        <p className="rounded-2xl bg-superficie-2 px-4 py-3 text-sm text-texto-2">
          Repetição ({rotuloRepeticao(rec, item!.recorrenciaData ?? item!.data)}). O que mudar aqui vale só para esta vez.
          Para mudar todas, vá em Mais › Configurações › Fixos e repetições.
        </p>
      )}
      {parcela && (
        <p className="rounded-2xl bg-superficie-2 px-4 py-3 text-sm text-texto-2">
          Parcela {parcela.numero} de {parcela.total}. O que mudar aqui vale só para esta parcela.
        </p>
      )}
      <Segmentos valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'saida', rotulo: 'Gasto' }, { valor: 'entrada', rotulo: 'Entrada' }]} />
      <CampoValor rotulo={parcelasFinal > 1 ? 'Valor total da compra' : 'Valor'} valor={valor} aoMudar={setValor} erro={erros.valor} />
      <CampoTexto rotulo="O que foi" valor={descricao} aoMudar={setDescricao} erro={erros.descricao}
        placeholder={tipo === 'saida' ? 'ex.: Almoço' : 'ex.: Comissão de outubro'} />
      <CampoData valor={data} aoMudar={setData} erro={erros.data} />
      <CampoEscolha rotulo="Categoria" valor={categoriaEscolhida} aoMudar={setCategoriaId}
        opcoes={catsDoTipo.map((c) => ({ valor: c.id, rotulo: `${c.icone} ${c.nome}` }))} />
      <CampoEscolha rotulo={tipo === 'saida' ? 'Pagou com' : 'Caiu em'} valor={ondeEscolhido} aoMudar={setOnde} erro={erros.contaId} opcoes={opcoesOnde} />

      {novo && noCartao && (
        <div className="flex flex-col gap-1.5">
          <CampoEscolha rotulo="Parcelas" valor={String(parcelas)} aoMudar={(v) => setParcelas(Number(v))}
            opcoes={Array.from({ length: 24 }, (_, k) => ({ valor: String(k + 1), rotulo: k === 0 ? 'À vista' : `${k + 1}x` }))} />
          {parcelas > 1 && valor > 0 && (
            <p className="text-sm text-texto-2">{parcelas}× de <b className="text-texto">{formatarReais(dividirCentavos(valor, parcelas)[0])}</b>, uma em cada fatura.</p>
          )}
        </div>
      )}
      {novo && parcelasFinal === 1 && (
        <div className="flex flex-col gap-2">
          <CampoEscolha rotulo="Repetir" valor={repetir} aoMudar={setRepetir}
            opcoes={[{ valor: 'nao', rotulo: 'Não repete' }, ...(['semanal', 'quinzenal', 'mensal'] as Frequencia[]).map((f) => ({ valor: f, rotulo: ROTULO_FREQUENCIA[f] }))]}
            ajuda={repetir === 'nao' ? 'Para comissão semanal, assinatura ou conta que se repete.' : undefined} />
          {repetir !== 'nao' && <CampoVezes vezes={vezes} aoMudar={setVezes} inicio={data} frequencia={repetir} />}
          {erros.vezes && <p className="text-sm font-semibold text-saida">{erros.vezes}</p>}
        </div>
      )}

      {tipo === 'entrada' && (
        <>
          <Segmentos rotulo="Certeza" valor={certeza} aoMudar={(c) => { setCerteza(c); setAconteceu(null); }}
            opcoes={(['garantida', 'provavel', 'possivel'] as Certeza[]).map((c) => ({ valor: c, rotulo: ROTULO_CERTEZA[c] }))} />
          {certeza !== 'garantida' && <p className="-mt-2 text-xs text-texto-2">Entradas incertas aparecem na grade, mas não entram no saldo até virarem garantidas.</p>}
          {cad.fontes.length > 0 && (
            <CampoEscolha rotulo="Fonte de renda" valor={fonteId} aoMudar={setFonteId}
              opcoes={[{ valor: '', rotulo: 'Nenhuma' }, ...cad.fontes.map((f) => ({ valor: f.id, rotulo: f.nome }))]} />
          )}
        </>
      )}
      <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
        <input type="checkbox" checked={realizado} onChange={(e) => setAconteceu(e.target.checked)} className="h-5 w-5 accent-[var(--color-destaque)]" />
        <span>
          <span className="block font-bold">{tipo === 'saida' ? 'Já foi pago' : 'Já caiu na conta'}{novo && (repetirFinal !== 'nao' || parcelasFinal > 1) ? ' (a primeira)' : ''}</span>
          <span className="block text-sm text-texto-2">Desmarcado, fica como previsto.</span>
        </span>
      </label>
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.lancamentos.excluir(item.id); aoFechar(); } : undefined}
        rotuloExcluir={parcela ? 'Excluir só esta parcela' : undefined}
        extra={parcela ? { rotulo: `Excluir as ${parcela.total} parcelas`, acao: async () => { await excluirParcelas(parcela.grupoId); aoFechar(); } } : undefined} />
    </div>
  );
}

/** Linha da lista. Fixo previsto ganha botão de "pagar" com um toque. */
export function LinhaLancamento({ l, cad, aoTocar }: { l: Lancamento; cad: Cadastros; aoTocar: () => void }) {
  const cat = cad.categoria(l.categoriaId);
  const onde = l.cartaoId ? `Cartão ${cad.cartao(l.cartaoId)?.nome ?? ''}` : cad.conta(l.contaId)?.nome;
  const entrada = l.tipo === 'entrada';
  const previsto = l.status === 'previsto';
  const rec = cad.recorrencia(l.recorrenciaId);
  const repete = l.parcela ? `parcela ${l.parcela.numero}/${l.parcela.total}` : rec ? rotuloRepeticao(rec, l.recorrenciaData ?? l.data) : l.recorrenciaId ? 'fixo' : null;
  const sub = [cat?.nome, onde, repete, entrada && l.certeza !== 'garantida' ? ROTULO_CERTEZA[l.certeza].toLowerCase() : null]
    .filter(Boolean).join(' · ');
  return (
    <li className="flex items-center">
      <button type="button" onClick={aoTocar} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left hover:bg-superficie-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `${cat?.cor ?? '#6f7f78'}26` }} aria-hidden="true">
          {cat?.icone ?? '•'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{l.descricao}</span>
          <span className="block truncate text-sm text-texto-2">{sub}</span>
        </span>
        <span className={`shrink-0 pr-4 text-right font-bold tabular-nums ${entrada ? 'text-entrada' : ''} ${previsto ? 'opacity-60' : ''}`}>
          {entrada ? '+' : '−'}{formatarReais(l.valor)}
          {previsto && <span className="block text-[11px] font-bold uppercase tracking-wide text-texto-2">previsto</span>}
        </span>
      </button>
      {previsto && l.recorrenciaId && (
        <button type="button" onClick={() => marcarComoPago(l.id)}
          className="mr-3 shrink-0 rounded-full border border-destaque px-3 py-1.5 text-sm font-bold text-destaque active:scale-95">
          {entrada ? 'Caiu' : 'Pagar'}
        </button>
      )}
    </li>
  );
}
