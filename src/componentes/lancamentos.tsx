// Peças da Fase 2: formulário de lançamento, linha da lista e seletor de mês.
import { useId, useState } from 'react';
import { repositorio } from '../data/repositorio';
import { marcarComoPago } from '../data/servicos';
import type { Cadastros } from '../data/useCadastros';
import { formatarData, hojeISO, nomeDoMes, paraISO, somarMeses } from '../calculos/datas';
import { formatarReais } from '../calculos/dinheiro';
import { statusSugerido, validarLancamento } from '../calculos/lancamentos';
import { NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA, ROTULO_CERTEZA } from '../calculos/padroes';
import { valido, type Erros } from '../calculos/validacoes';
import type { Certeza, DataISO, Lancamento, MesRef } from '../tipos';
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

export function FormLancamento({ item, cad, dataInicial, aoFechar }: {
  item?: Lancamento; cad: Cadastros; dataInicial?: DataISO; aoFechar: () => void;
}) {
  const [tipo, setTipo] = useState<'saida' | 'entrada'>(item?.tipo === 'entrada' ? 'entrada' : 'saida');
  const [valor, setValor] = useState(item?.valor ?? 0);
  const [descricao, setDescricao] = useState(item?.descricao ?? '');
  const [data, setData] = useState(item?.data ?? dataInicial ?? hojeISO());
  const [categoriaId, setCategoriaId] = useState(item?.categoriaId ?? '');
  const [onde, setOnde] = useState(item?.cartaoId ? `cartao:${item.cartaoId}` : item?.contaId ? `conta:${item.contaId}` : '');
  const [certeza, setCerteza] = useState<Certeza>(item?.certeza ?? 'garantida');
  const [fonteId, setFonteId] = useState(item?.fonteRendaId ?? '');
  const [aconteceu, setAconteceu] = useState<boolean | null>(item ? item.status === 'realizado' : null);
  const [erros, setErros] = useState<Erros>({});

  const catsDoTipo = cad.categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const outros = catsDoTipo.find((c) => c.nome === (tipo === 'saida' ? NOME_OUTROS_SAIDA : NOME_OUTROS_ENTRADA));
  const categoriaEscolhida = catsDoTipo.some((c) => c.id === categoriaId) ? categoriaId : outros?.id ?? '';
  const ondePadrao = `conta:${cad.contaPadraoId ?? cad.contas[0]?.id ?? ''}`;
  const ondeEscolhido = onde && !(tipo === 'entrada' && onde.startsWith('cartao:')) ? onde : ondePadrao;
  const certezaFinal: Certeza = tipo === 'saida' ? 'garantida' : certeza;
  const realizado = aconteceu ?? statusSugerido(data, hojeISO(), certezaFinal) === 'realizado';
  const fixo = item?.recorrenciaId;

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
    for (const k of Object.keys(dados) as (keyof typeof dados)[]) if (dados[k] === undefined) delete dados[k];
    const e = validarLancamento(dados);
    setErros(e);
    if (!valido(e)) return;
    if (item) await repositorio.lancamentos.salvar({ ...dados, id: item.id });
    else await repositorio.lancamentos.criar(dados);
    aoFechar();
  }

  const opcoesOnde = [
    ...cad.contas.map((c) => ({ valor: `conta:${c.id}`, rotulo: c.nome })),
    ...(tipo === 'saida' ? cad.cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: `Cartão ${c.nome}` })) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {fixo && <p className="rounded-2xl bg-superficie-2 px-4 py-3 text-sm text-texto-2">Veio de um fixo. O que mudar aqui vale só para este mês.</p>}
      <Segmentos valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'saida', rotulo: 'Gasto' }, { valor: 'entrada', rotulo: 'Entrada' }]} />
      <CampoValor rotulo="Valor" valor={valor} aoMudar={setValor} erro={erros.valor} />
      <CampoTexto rotulo="O que foi" valor={descricao} aoMudar={setDescricao} erro={erros.descricao}
        placeholder={tipo === 'saida' ? 'ex.: Almoço' : 'ex.: Comissão de outubro'} />
      <CampoData valor={data} aoMudar={setData} erro={erros.data} />
      <CampoEscolha rotulo="Categoria" valor={categoriaEscolhida} aoMudar={setCategoriaId}
        opcoes={catsDoTipo.map((c) => ({ valor: c.id, rotulo: `${c.icone} ${c.nome}` }))} />
      <CampoEscolha rotulo={tipo === 'saida' ? 'Pagou com' : 'Caiu em'} valor={ondeEscolhido} aoMudar={setOnde} erro={erros.contaId} opcoes={opcoesOnde} />
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
          <span className="block font-bold">{tipo === 'saida' ? 'Já foi pago' : 'Já caiu na conta'}</span>
          <span className="block text-sm text-texto-2">Desmarcado, fica como previsto.</span>
        </span>
      </label>
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.lancamentos.excluir(item.id); aoFechar(); } : undefined} />
    </div>
  );
}

/** Linha da lista. Fixo previsto ganha botão de "pagar" com um toque. */
export function LinhaLancamento({ l, cad, aoTocar }: { l: Lancamento; cad: Cadastros; aoTocar: () => void }) {
  const cat = cad.categoria(l.categoriaId);
  const onde = l.cartaoId ? `Cartão ${cad.cartao(l.cartaoId)?.nome ?? ''}` : cad.conta(l.contaId)?.nome;
  const entrada = l.tipo === 'entrada';
  const previsto = l.status === 'previsto';
  const sub = [cat?.nome, onde, l.recorrenciaId ? 'fixo' : null, entrada && l.certeza !== 'garantida' ? ROTULO_CERTEZA[l.certeza].toLowerCase() : null]
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
