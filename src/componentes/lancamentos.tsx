// Peças da Fase 2: formulário de lançamento, linha da lista e seletor de mês.
import { useId, useState } from 'react';
import { repositorio } from '../data/repositorio';
import { criarLancamento, excluirLancamento, marcarComoPago, verificarLimite, type AvisoComCategoria, type Escopo } from '../data/servicos';
import { AvisoLimite } from './AvisoLimite';
import type { Cadastros } from '../data/useCadastros';
import { formatarData, hojeISO, nomeDoMes, paraISO, somarMeses } from '../calculos/datas';
import { faturaDaCompra, vencimentoDaFatura } from '../calculos/cartao';
import { normalizar } from '../calculos/texto';
import { dividirCentavos, formatarReais } from '../calculos/dinheiro';
import { ROTULO_FREQUENCIA, dataDaOcorrencia, rotuloRepeticao } from '../calculos/recorrencias';
import { validarLancamento } from '../calculos/lancamentos';
import { NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA, ROTULO_CERTEZA } from '../calculos/padroes';
import { valido, type Erros } from '../calculos/validacoes';
import type { Certeza, DataISO, Frequencia, Lancamento, MesRef } from '../tipos';
import { Acoes } from './formularios';
import { IconeLixeira, IconeSeta, IconeVoltar } from './Icones';
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
        opcoes={[{ valor: 'sempre', rotulo: 'Sem fim' }, { valor: 'vezes', rotulo: 'Só algumas vezes' }]} />
      {vezes === null && (
        <p className="text-sm text-texto-2">
          Repete {frequencia === 'semanal' ? 'toda semana' : frequencia === 'quinzenal' ? 'a cada 15 dias' : 'todo mês'}, em todos os meses, sem data para acabar. Você pode parar quando quiser.
        </p>
      )}
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

/** Botão de excluir sempre visível. Em parcelado/repetição pergunta: só este, este e os próximos, ou todos. */
export function ExcluirLancamento({ l, aoExcluido }: { l: Lancamento; aoExcluido: () => void }) {
  const [aberto, setAberto] = useState(false);
  const excluir = async (e: Escopo) => { await excluirLancamento(l, e); aoExcluido(); };
  const op = (rotulo: string, e: Escopo, sub?: string) => (
    <button key={e} type="button" onClick={() => excluir(e)}
      className="flex w-full flex-col items-start rounded-2xl border border-saida/40 bg-superficie px-4 py-3 text-left">
      <span className="font-bold text-saida">{rotulo}</span>
      {sub && <span className="text-sm text-texto-2">{sub}</span>}
    </button>
  );
  if (!aberto) return (
    <button type="button" onClick={() => setAberto(true)}
      className="flex items-center justify-center gap-2 rounded-2xl border border-saida/40 py-3 font-bold text-saida">
      <IconeLixeira className="h-5 w-5" /> Excluir
    </button>
  );
  const p = l.parcela;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-saldo-negativo/50 p-3">
      <p className="px-1 text-sm font-bold">{p ? `Esta é a parcela ${p.numero} de ${p.total}. O que excluir?` : l.recorrenciaId ? 'Este lançamento se repete. O que excluir?' : 'Excluir este lançamento?'}</p>
      {p ? (
        <>
          {op('Só esta parcela', 'este')}
          {p.numero < p.total && op(`Esta e as próximas (${p.total - p.numero + 1})`, 'proximos', `Parcelas ${p.numero} a ${p.total}`)}
          {op(`Todas as ${p.total} parcelas`, 'todos', 'A compra inteira')}
        </>
      ) : l.recorrenciaId ? (
        <>
          {op('Só esta vez', 'este', formatarData(l.recorrenciaData ?? l.data))}
          {op('Esta e as próximas', 'proximos', 'Para de repetir a partir daqui; o que já passou fica')}
          {op('Todas', 'todos', 'Apaga a repetição inteira, inclusive as que já passaram')}
        </>
      ) : op('Excluir', 'este')}
      <button type="button" onClick={() => setAberto(false)} className="py-2 text-sm font-bold text-texto-2">Cancelar</button>
    </div>
  );
}


/** Modo vindo do botão +: trava o tipo e o meio de pagamento. */
export type ModoLancamento = 'entrada' | 'saida' | 'cartao';

export function FormLancamento({ item, cad, dataInicial, inicial, modo, aoFechar }: {
  item?: Lancamento; cad: Cadastros; dataInicial?: DataISO; inicial?: InicialLancamento; modo?: ModoLancamento; aoFechar: () => void;
}) {
  if (item?.tipo === 'transferencia') return <DetalheTransferencia l={item} cad={cad} aoFechar={aoFechar} />;
  return <FormLancamentoEdicao item={item} cad={cad} dataInicial={dataInicial} inicial={inicial} modo={modo} aoFechar={aoFechar} />;
}

/** Pagamento de fatura ou economia: mostra o que é e deixa excluir. */
function DetalheTransferencia({ l, cad, aoFechar }: { l: Lancamento; cad: Cadastros; aoFechar: () => void }) {
  const fatura = !!l.cartaoId;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-superficie-2 px-4 py-3">
        <p className="font-bold">{l.descricao}</p>
        <p className="text-2xl font-extrabold tabular-nums">−{formatarReais(l.valor)}</p>
        <p className="text-sm text-texto-2">{formatarData(l.data)} · saiu de {cad.conta(l.contaId)?.nome ?? 'conta'}</p>
        <p className="mt-2 text-sm text-texto-2">
          {fatura ? 'Pagamento de fatura. As compras já foram contadas; excluir aqui deixa a fatura em aberto de novo.'
            : 'Dinheiro guardado. Excluir devolve o valor para o saldo da conta.'}
        </p>
      </div>
      <ExcluirLancamento l={l} aoExcluido={aoFechar} />
      <button type="button" onClick={aoFechar} className="py-2 font-bold text-texto-2">Fechar</button>
    </div>
  );
}

function FormLancamentoEdicao({ item, cad, dataInicial, inicial, modo, aoFechar }: {
  item?: Lancamento; cad: Cadastros; dataInicial?: DataISO; inicial?: InicialLancamento; modo?: ModoLancamento; aoFechar: () => void;
}) {
  const base = item ?? (modo ? { ...inicial, tipo: modo === 'entrada' ? 'entrada' as const : 'saida' as const } : inicial);
  const hoje = hojeISO();
  const [tipo, setTipo] = useState<'saida' | 'entrada'>(base?.tipo === 'entrada' ? 'entrada' : 'saida');
  const [valor, setValor] = useState(base?.valor ?? 0);
  const [descricao, setDescricao] = useState(base?.descricao ?? '');
  const [data, setData] = useState(base?.data ?? dataInicial ?? hoje);
  const [categoriaId, setCategoriaId] = useState(base?.categoriaId ?? '');
  const [onde, setOnde] = useState(base?.cartaoId ? `cartao:${base.cartaoId}` : base?.contaId ? `conta:${base.contaId}` : '');
  const [fonteId, setFonteId] = useState<string | null>(base?.fonteRendaId ?? null);
  // Gasto: já foi pago?
  const [pago, setPago] = useState<boolean | null>(item && item.tipo !== 'entrada' ? item.status === 'realizado' : null);
  const [parcelas, setParcelas] = useState(inicial?.parcelas ?? 1);
  const [repetir, setRepetir] = useState<Repetir>(inicial?.frequencia ?? 'nao');
  const [vezes, setVezes] = useState<number | null>(inicial?.vezes ?? null);
  const [mais, setMais] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [avisoLimite, setAvisoLimite] = useState<AvisoComCategoria | null>(null);

  const entrada = tipo === 'entrada';
  const novo = !item;
  const fonte = cad.fontes.find((f) => f.id === (fonteId ?? (entrada && !base?.fonteRendaId && cad.fontes.length === 1 ? cad.fontes[0].id : undefined)));
  const catsDoTipo = cad.categorias.filter((c) => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const outros = catsDoTipo.find((c) => c.nome === (entrada ? NOME_OUTROS_ENTRADA : NOME_OUTROS_SAIDA));
  const catDaFonte = fonte ? catsDoTipo.find((c) => normalizar(c.nome) === normalizar(fonte.nome)) : undefined;
  const categoriaEscolhida = catsDoTipo.some((c) => c.id === categoriaId) ? categoriaId : (entrada ? catDaFonte?.id : undefined) ?? outros?.id ?? '';
  const ondePadrao = modo === 'cartao' ? `cartao:${cad.cartoes[0]?.id ?? ''}` : `conta:${cad.contaPadraoId ?? cad.contas[0]?.id ?? ''}`;
  const ondeValido = (o: string) => !!o && !(entrada && o.startsWith('cartao:')) && !(modo === 'cartao' && !o.startsWith('cartao:')) && !(modo === 'saida' && o.startsWith('cartao:'));
  const ondeEscolhido = ondeValido(onde) ? onde : ondePadrao;
  const cartao = !entrada && ondeEscolhido.startsWith('cartao:') ? cad.cartao(ondeEscolhido.slice(7)) : undefined;
  // Entrada é simples: lançou, conta como recebida no dia (sem "provável"/"talvez").
  const certezaFinal: Certeza = 'garantida';
  const realizado = entrada || cartao ? data <= hoje : pago ?? data <= hoje;
  const rec = cad.recorrencia(item?.recorrenciaId);
  const parcela = item?.parcela;
  const parcelasFinal = cartao ? parcelas : 1;
  const repetirFinal: Repetir = parcelasFinal > 1 ? 'nao' : repetir;
  const fatura1 = cartao ? (item?.faturaRef ?? faturaDaCompra(data, cartao.diaFechamento)) : undefined;

  async function salvar(confirmouLimite = false) {
    const [qual, id] = ondeEscolhido.split(':');
    const dados: Omit<Lancamento, 'id'> = {
      ...(item ?? {}), tipo, valor, data, certeza: certezaFinal,
      descricao: descricao.trim() || (entrada ? fonte?.nome ?? 'Entrada' : ''),
      status: realizado ? 'realizado' : 'previsto',
      categoriaId: categoriaEscolhida || undefined,
      contaId: qual === 'conta' ? id : undefined,
      cartaoId: qual === 'cartao' ? id : undefined,
      fonteRendaId: entrada && fonte ? fonte.id : undefined,
    };
    if (!item) delete (dados as Partial<Lancamento>).id;
    if (item && cartao && item.cartaoId !== cartao.id) delete dados.faturaRef;
    for (const k of Object.keys(dados) as (keyof typeof dados)[]) if (dados[k] === undefined) delete dados[k];
    const e = validarLancamento(dados);
    if (novo && repetirFinal !== 'nao' && vezes !== null && vezes < 2) e.vezes = 'Use 2 vezes ou mais, ou escolha "Sem fim".';
    setErros(e);
    if (!valido(e)) return;
    if (tipo === 'saida' && !confirmouLimite) {
      // 5.9: pergunta antes se o gasto deixa a categoria perto ou acima do limite do mês
      const valorNoMes = parcelasFinal > 1 ? dividirCentavos(valor, parcelasFinal)[0] : valor;
      const aviso = await verificarLimite(dados.categoriaId, data, valorNoMes, item?.id);
      if (aviso && (!item || aviso.depois > aviso.antes + (item.categoriaId === dados.categoriaId && item.data.slice(0, 7) === data.slice(0, 7) ? item.valor : 0))) {
        setAvisoLimite(aviso); return;
      }
    }
    if (item) await repositorio.lancamentos.salvar({ ...dados, id: item.id });
    else await criarLancamento(dados, {
      parcelas: parcelasFinal,
      repeticao: repetirFinal !== 'nao' ? { frequencia: repetirFinal, vezes } : undefined,
    });
    aoFechar();
  }

  const chip = (ativo: boolean, rotulo: string, aoTocar: () => void) => (
    <button key={rotulo} type="button" onClick={aoTocar} aria-pressed={ativo}
      className={`rounded-full px-3.5 py-2 text-sm font-bold ${ativo ? 'bg-texto text-fundo' : 'bg-superficie-2 text-texto'}`}>{rotulo}</button>
  );
  const opcoesOnde = [
    ...(modo !== 'cartao' ? cad.contas.map((c) => ({ valor: `conta:${c.id}`, rotulo: c.nome })) : []),
    ...(!entrada && modo !== 'saida' ? cad.cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: `Cartão ${c.nome}` })) : []),
  ];
  if (modo === 'cartao' && cad.cartoes.length === 0) return (
    <div className="flex flex-col gap-3">
      <p className="rounded-2xl bg-superficie-2 px-4 py-4 text-sm">Você ainda não cadastrou nenhum cartão. Cadastre em Mais › Cartões e volte aqui.</p>
      <a href="#cartoes" className="rounded-2xl bg-texto py-3.5 text-center font-bold text-fundo">Ir para Cartões</a>
    </div>
  );
  const campoCategoria = (
    <CampoEscolha rotulo="Categoria" valor={categoriaEscolhida} aoMudar={setCategoriaId}
      opcoes={catsDoTipo.map((c) => ({ valor: c.id, rotulo: `${c.icone} ${c.nome}` }))} />
  );

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
      {!modo && !(item && item.tipo === 'transferencia') && (
        <Segmentos valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'saida', rotulo: 'Gasto' }, { valor: 'entrada', rotulo: 'Entrada' }]} />
      )}
      <CampoValor rotulo={parcelasFinal > 1 ? 'Valor total da compra' : 'Valor'} valor={valor} aoMudar={setValor} erro={erros.valor} />

      {entrada ? (
        <>
          {cad.fontes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-texto-2">De onde veio</span>
              <div className="flex flex-wrap gap-1.5">
                {cad.fontes.map((f) => chip(fonte?.id === f.id, f.nome, () => { setFonteId(f.id); setCategoriaId(''); }))}
                {chip(!fonte, 'Outra', () => { setFonteId(''); setCategoriaId(''); })}
              </div>
            </div>
          )}
          <CampoData valor={data} aoMudar={setData} erro={erros.data} />
          {cad.contas.length > 1 && <CampoEscolha rotulo="Caiu em" valor={ondeEscolhido} aoMudar={setOnde} erro={erros.contaId} opcoes={opcoesOnde} />}
        </>
      ) : (
        <>
          <CampoTexto rotulo="O que foi" valor={descricao} aoMudar={setDescricao} erro={erros.descricao} placeholder="ex.: Almoço" />
          <CampoData valor={data} aoMudar={setData} erro={erros.data} />
          {campoCategoria}
          {opcoesOnde.length > 1 && (
            <CampoEscolha rotulo={modo === 'cartao' ? 'Cartão' : 'Pagou com'} valor={ondeEscolhido} aoMudar={setOnde} erro={erros.contaId} opcoes={opcoesOnde} />
          )}
          {cartao && novo && (
            <CampoEscolha rotulo="Parcelas" valor={String(parcelas)} aoMudar={(v) => setParcelas(Number(v))}
              opcoes={Array.from({ length: 24 }, (_, k) => ({ valor: String(k + 1), rotulo: k === 0 ? 'À vista' : `${k + 1}x` }))} />
          )}
          {cartao && fatura1 && (
            <p className="-mt-1 rounded-2xl bg-superficie-2 px-4 py-3 text-sm">
              {parcelasFinal > 1 && valor > 0 ? <>{parcelasFinal}× de <b>{formatarReais(dividirCentavos(valor, parcelasFinal)[0])}</b>. A 1ª </> : 'Cai na '}
              fatura que vence em <b>{formatarData(vencimentoDaFatura(fatura1, cartao))}</b>
              {parcelasFinal > 1 && <>, a última em <b>{formatarData(vencimentoDaFatura(somarMeses(fatura1, parcelasFinal - 1), cartao))}</b></>}.
              {' '}Sai da conta {cad.conta(cartao.contaPagamentoId)?.nome ?? ''} nesse dia.
            </p>
          )}
          {!cartao && data > hoje && (
            <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
              <input type="checkbox" checked={pago ?? false} onChange={(e) => setPago(e.target.checked)} className="h-5 w-5 accent-[var(--color-destaque)]" />
              <span className="font-bold">Já foi pago</span>
            </label>
          )}
          {!cartao && data <= hoje && item && (
            <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
              <input type="checkbox" checked={pago ?? true} onChange={(e) => setPago(e.target.checked)} className="h-5 w-5 accent-[var(--color-destaque)]" />
              <span><span className="block font-bold">Já foi pago</span><span className="block text-sm text-texto-2">Desmarcado, fica como a pagar.</span></span>
            </label>
          )}
        </>
      )}

      {novo && parcelasFinal === 1 && (
        <div className="flex flex-col gap-2">
          <CampoEscolha rotulo="Repetir" valor={repetir} aoMudar={setRepetir}
            opcoes={[{ valor: 'nao', rotulo: 'Não repete' }, ...(['semanal', 'quinzenal', 'mensal'] as Frequencia[]).map((f) => ({ valor: f, rotulo: ROTULO_FREQUENCIA[f] }))]}
            ajuda={repetir === 'nao' ? (entrada ? 'Para comissão semanal ou salário.' : 'Para assinatura ou conta que se repete.') : undefined} />
          {repetir !== 'nao' && <CampoVezes vezes={vezes} aoMudar={setVezes} inicio={data} frequencia={repetir} />}
          {erros.vezes && <p className="text-sm font-semibold text-saida">{erros.vezes}</p>}
        </div>
      )}

      {entrada && (mais ? (
        <div className="flex flex-col gap-4">
          <CampoTexto rotulo="Descrição" valor={descricao} aoMudar={setDescricao} placeholder={fonte?.nome ?? 'Entrada'} />
          {campoCategoria}
        </div>
      ) : (
        <button type="button" onClick={() => setMais(true)} className="self-start text-sm font-bold text-destaque">+ Descrição e categoria</button>
      ))}

      {avisoLimite
        ? <AvisoLimite aviso={avisoLimite} aoVoltar={() => setAvisoLimite(null)} aoContinuar={() => { setAvisoLimite(null); salvar(true); }} />
        : <Acoes aoSalvar={() => salvar()} aoCancelar={aoFechar} />}
      {item && <ExcluirLancamento l={item} aoExcluido={aoFechar} />}
    </div>
  );
}

/** Linha da lista. Fixo previsto ganha botão de "pagar" com um toque. */
export function LinhaLancamento({ l, cad, aoTocar }: { l: Lancamento; cad: Cadastros; aoTocar: () => void }) {
  const pagamento = (l.tipo === 'transferencia' && l.cartaoId) || l.saldoAnterior;
  const economia = l.tipo === 'transferencia' && l.destino;
  const cat = cad.categoria(l.categoriaId)
    ?? (economia ? { icone: '🐷', cor: '#13955f', nome: 'Economia' } : pagamento ? { icone: '💳', cor: '#6d4ad8', nome: l.saldoAnterior ? 'Fatura anterior' : 'Pagamento de fatura' } : undefined);
  const onde = l.saldoAnterior ? `Cartão ${cad.cartao(l.cartaoId)?.nome ?? ''}` : pagamento ? `saiu de ${cad.conta(l.contaId)?.nome ?? 'conta'}` : l.cartaoId ? `Cartão ${cad.cartao(l.cartaoId)?.nome ?? ''}` : cad.conta(l.contaId)?.nome;
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
