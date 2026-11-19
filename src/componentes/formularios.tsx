// Formulários de cadastro. Usados no onboarding e nas Configurações.
// Cada um grava pelo repositório e chama aoFechar quando termina.
import { useState } from 'react';
import { repositorio } from '../data/repositorio';
import { useConsulta } from '../data/useConsulta';
import { hojeISO } from '../calculos/datas';
import { formatarTaxa, textoParaTaxa } from '../calculos/dinheiro';
import { separarPalavrasChave } from '../calculos/texto';
import {
  CORES_CATEGORIA, DESCRICAO_CERTEZA, NOME_OUTROS_ENTRADA, NOME_OUTROS_SAIDA, ROTULO_CERTEZA, ROTULO_TIPO_FONTE,
} from '../calculos/padroes';
import {
  validarCartao, validarCategoria, validarConta, validarFonte, validarRecorrencia, valido, type Erros,
} from '../calculos/validacoes';
import type { Cartao, Categoria, Certeza, Conta, FonteRenda, Recorrencia, TipoFonteRenda } from '../tipos';
import { Botao, CampoEscolha, CampoNumero, CampoTexto, CampoValor, Segmentos } from './ui';

type PropsForm<T> = { item?: T; aoFechar: () => void };

/** Rodapé com Salvar, Cancelar e (na edição) Excluir com confirmação em dois toques. */
function Acoes({ aoSalvar, aoCancelar, aoExcluir, bloqueioExclusao }: {
  aoSalvar: () => void; aoCancelar: () => void; aoExcluir?: () => void; bloqueioExclusao?: string;
}) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <Botao tipo="secundario" onClick={aoCancelar} className="flex-1">Cancelar</Botao>
        <Botao onClick={aoSalvar} className="flex-[2]">Salvar</Botao>
      </div>
      {aoExcluir && (bloqueioExclusao ? (
        <p className="pt-1 text-center text-sm text-texto-2">{bloqueioExclusao}</p>
      ) : (
        <Botao tipo="perigo" onClick={() => (confirmar ? aoExcluir() : setConfirmar(true))}>
          {confirmar ? 'Toque de novo para excluir' : 'Excluir'}
        </Botao>
      ))}
    </div>
  );
}

// ---------- Conta ----------

export function FormConta({ item, aoFechar }: PropsForm<Conta>) {
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const usos = useConsulta(async () => {
    if (!item) return 0;
    const [cartoes, recs] = await Promise.all([repositorio.cartoes.listar(), repositorio.recorrencias.listar()]);
    return cartoes.filter((c) => c.contaPagamentoId === item.id).length + recs.filter((r) => r.modelo.contaId === item.id).length;
  }, [item?.id]);
  const [nome, setNome] = useState(item?.nome ?? '');
  const [tipo, setTipo] = useState<Conta['tipo']>(item?.tipo ?? 'corrente');
  const [saldo, setSaldo] = useState(item?.saldoInicial ?? 0);
  const [padrao, setPadrao] = useState<boolean | undefined>(undefined);
  const [erros, setErros] = useState<Erros>({});
  const ehPadrao = padrao ?? (item ? config?.contaPadraoId === item.id : !config?.contaPadraoId);

  async function salvar() {
    const dados = { nome: nome.trim(), tipo, saldoInicial: saldo, dataSaldoInicial: item?.dataSaldoInicial ?? hojeISO() };
    const e = validarConta(dados);
    setErros(e);
    if (!valido(e)) return;
    const salvo = item
      ? (await repositorio.contas.salvar({ ...item, ...dados }))
      : await repositorio.contas.criar(dados);
    if (ehPadrao) await repositorio.salvarConfig({ contaPadraoId: salvo.id });
    else if (config?.contaPadraoId === salvo.id) await repositorio.salvarConfig({ contaPadraoId: undefined });
    aoFechar();
  }
  async function excluir() {
    if (!item) return;
    await repositorio.contas.excluir(item.id);
    if (config?.contaPadraoId === item.id) await repositorio.salvarConfig({ contaPadraoId: undefined });
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} erro={erros.nome} placeholder="ex.: Nubank, Itaú, Carteira" autoFocus={!item} />
      <Segmentos rotulo="Tipo" valor={tipo} aoMudar={setTipo}
        opcoes={[{ valor: 'corrente', rotulo: 'Conta no banco' }, { valor: 'carteira', rotulo: 'Dinheiro vivo' }]} />
      <CampoValor rotulo={item ? 'Saldo inicial' : 'Quanto tem nela hoje'} valor={saldo} aoMudar={setSaldo} erro={erros.saldoInicial}
        permitirNegativo ajuda={item ? 'Saldo informado no cadastro. Os lançamentos são somados a partir dele.' : 'Se estiver no negativo, toque no + para virar −.'} />
      <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
        <input type="checkbox" checked={ehPadrao} onChange={(e) => setPadrao(e.target.checked)} className="h-5 w-5 accent-[var(--color-destaque)]" />
        <span>
          <span className="block font-bold">Conta padrão</span>
          <span className="block text-sm text-texto-2">Usada quando o lançamento não diz qual conta.</span>
        </span>
      </label>
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar} aoExcluir={item ? excluir : undefined}
        bloqueioExclusao={usos ? 'Esta conta paga um cartão ou um fixo. Troque a conta deles antes de excluir.' : undefined} />
    </div>
  );
}

// ---------- Cartão ----------

export function FormCartao({ item, aoFechar }: PropsForm<Cartao>) {
  const contas = useConsulta(() => repositorio.contas.listar(), []) ?? [];
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const usos = useConsulta(async () => (item ? (await repositorio.recorrencias.listar()).filter((r) => r.modelo.cartaoId === item.id).length : 0), [item?.id]);
  const [nome, setNome] = useState(item?.nome ?? '');
  const [limite, setLimite] = useState(item?.limite ?? 0);
  const [fechamento, setFechamento] = useState(String(item?.diaFechamento ?? ''));
  const [vencimento, setVencimento] = useState(String(item?.diaVencimento ?? ''));
  const [conta, setConta] = useState(item?.contaPagamentoId ?? '');
  const [erros, setErros] = useState<Erros>({});
  const contaEscolhida = conta || config?.contaPadraoId || contas[0]?.id || '';

  async function salvar() {
    const dados = {
      nome: nome.trim(), limite, diaFechamento: Number(fechamento), diaVencimento: Number(vencimento), contaPagamentoId: contaEscolhida,
    };
    const e = validarCartao(dados);
    setErros(e);
    if (!valido(e)) return;
    if (item) await repositorio.cartoes.salvar({ ...item, ...dados });
    else await repositorio.cartoes.criar(dados);
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} erro={erros.nome} placeholder="ex.: Nubank" autoFocus={!item}
        ajuda="Use o nome que você vai digitar no lançamento rápido." />
      <CampoValor rotulo="Limite" valor={limite} aoMudar={setLimite} erro={erros.limite} />
      <div className="grid grid-cols-2 gap-3">
        <CampoNumero rotulo="Fecha no dia" valor={fechamento} aoMudar={setFechamento} erro={erros.diaFechamento} />
        <CampoNumero rotulo="Vence no dia" valor={vencimento} aoMudar={setVencimento} erro={erros.diaVencimento} />
      </div>
      <CampoEscolha rotulo="Fatura paga pela conta" valor={contaEscolhida} aoMudar={setConta} erro={erros.contaPagamentoId}
        opcoes={contas.map((c) => ({ valor: c.id, rotulo: c.nome }))}
        ajuda="No vencimento, o valor da fatura sai desta conta." />
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.cartoes.excluir(item.id); aoFechar(); } : undefined}
        bloqueioExclusao={usos ? 'Há fixos cobrados neste cartão. Troque o cartão deles antes de excluir.' : undefined} />
    </div>
  );
}

// ---------- Fonte de renda ----------

const OPCOES_CERTEZA = (['garantida', 'provavel', 'possivel'] as Certeza[]).map((c) => ({ valor: c, rotulo: ROTULO_CERTEZA[c] }));

export function FormFonte({ item, aoFechar }: PropsForm<FonteRenda>) {
  const [nome, setNome] = useState(item?.nome ?? '');
  const [tipo, setTipo] = useState<TipoFonteRenda>(item?.tipo ?? 'variavel');
  const [valor, setValor] = useState(item?.valorMedioMensal ?? 0);
  const [certeza, setCerteza] = useState<Certeza>(item?.certezaPadrao ?? 'provavel');
  const [taxa, setTaxa] = useState(item?.taxaComissao ? formatarTaxa(item.taxaComissao).replace('%', '') : '');
  const [erros, setErros] = useState<Erros>({});

  async function salvar() {
    const taxaComissao = taxa.trim() ? (textoParaTaxa(taxa) ?? Number.NaN) : undefined;
    const dados: Omit<FonteRenda, 'id'> = { nome: nome.trim(), tipo, valorMedioMensal: valor, certezaPadrao: certeza };
    if (taxaComissao !== undefined) dados.taxaComissao = taxaComissao;
    const e = validarFonte(dados);
    setErros(e);
    if (!valido(e)) return;
    if (item) {
      const { taxaComissao: _, ...resto } = item;
      await repositorio.fontesRenda.salvar({ ...resto, ...dados });
    } else await repositorio.fontesRenda.criar(dados);
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} erro={erros.nome} placeholder="ex.: Comissão" autoFocus={!item} />
      <CampoEscolha rotulo="Tipo" valor={tipo} aoMudar={setTipo}
        opcoes={(Object.keys(ROTULO_TIPO_FONTE) as TipoFonteRenda[]).map((t) => ({ valor: t, rotulo: ROTULO_TIPO_FONTE[t] }))} />
      <CampoValor rotulo="Média por mês" valor={valor} aoMudar={setValor} erro={erros.valorMedioMensal}
        ajuda="Usada na previsão quando o mês ainda não tem entrada lançada." />
      <Segmentos rotulo="Certeza de costume" valor={certeza} aoMudar={setCerteza} opcoes={OPCOES_CERTEZA} />
      <p className="-mt-2 text-xs text-texto-2">{DESCRICAO_CERTEZA[certeza]}. O dia a dia usa só o garantido.</p>
      <CampoNumero rotulo="Taxa de comissão (opcional)" valor={taxa} aoMudar={setTaxa} erro={erros.taxaComissao} sufixo="%"
        ajuda="Ex.: 3,5. Serve para calcular quanto você precisa produzir no mês." />
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.fontesRenda.excluir(item.id); aoFechar(); } : undefined} />
    </div>
  );
}

// ---------- Fixo (recorrência) ----------

export function FormRecorrencia({ item, aoFechar }: PropsForm<Recorrencia>) {
  const contas = useConsulta(() => repositorio.contas.listar(), []) ?? [];
  const cartoes = useConsulta(() => repositorio.cartoes.listar(), []) ?? [];
  const categorias = useConsulta(() => repositorio.categorias.listar(), []) ?? [];
  const fontes = useConsulta(() => repositorio.fontesRenda.listar(), []) ?? [];
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const m = item?.modelo;
  const [tipo, setTipo] = useState<'saida' | 'entrada'>(m?.tipo === 'entrada' ? 'entrada' : 'saida');
  const [descricao, setDescricao] = useState(m?.descricao ?? '');
  const [valor, setValor] = useState(m?.valor ?? 0);
  const [dia, setDia] = useState(String(item?.diaDoMes ?? ''));
  const [categoriaId, setCategoriaId] = useState(m?.categoriaId ?? '');
  const [onde, setOnde] = useState(m?.cartaoId ? `cartao:${m.cartaoId}` : m?.contaId ? `conta:${m.contaId}` : '');
  const [fonteId, setFonteId] = useState(m?.fonteRendaId ?? '');
  const [certeza, setCerteza] = useState<Certeza>(m?.certeza ?? 'garantida');
  const [ativa, setAtiva] = useState(item?.ativa ?? true);
  const [erros, setErros] = useState<Erros>({});

  const ondePadrao = config?.contaPadraoId ? `conta:${config.contaPadraoId}` : contas[0] ? `conta:${contas[0].id}` : '';
  const ondeEscolhido = onde.startsWith('cartao:') && tipo === 'entrada' ? ondePadrao : onde || ondePadrao;
  const catsDoTipo = categorias.filter((c) => c.tipo === tipo);
  const outros = catsDoTipo.find((c) => c.nome === (tipo === 'saida' ? NOME_OUTROS_SAIDA : NOME_OUTROS_ENTRADA));
  const categoriaEscolhida = catsDoTipo.some((c) => c.id === categoriaId) ? categoriaId : outros?.id ?? catsDoTipo[0]?.id ?? '';

  async function salvar() {
    const [qual, id] = ondeEscolhido.split(':');
    const modelo: Recorrencia['modelo'] = {
      tipo, descricao: descricao.trim(), valor, categoriaId: categoriaEscolhida || undefined,
      contaId: qual === 'conta' ? id : undefined, cartaoId: qual === 'cartao' ? id : undefined,
      certeza: tipo === 'saida' ? 'garantida' : certeza,
      fonteRendaId: tipo === 'entrada' && fonteId ? fonteId : undefined,
    };
    for (const k of Object.keys(modelo) as (keyof typeof modelo)[]) if (modelo[k] === undefined) delete modelo[k];
    const dados: Omit<Recorrencia, 'id'> = { modelo, diaDoMes: Number(dia), ativa };
    const e = validarRecorrencia(dados);
    setErros(e);
    if (!valido(e)) return;
    if (item) await repositorio.recorrencias.salvar({ ...item, ...dados });
    else await repositorio.recorrencias.criar(dados);
    aoFechar();
  }

  const opcoesOnde = [
    ...contas.map((c) => ({ valor: `conta:${c.id}`, rotulo: c.nome })),
    ...(tipo === 'saida' ? cartoes.map((c) => ({ valor: `cartao:${c.id}`, rotulo: `Cartão ${c.nome}` })) : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Segmentos valor={tipo} aoMudar={setTipo}
        opcoes={[{ valor: 'saida', rotulo: 'Conta a pagar' }, { valor: 'entrada', rotulo: 'Entrada fixa' }]} />
      <CampoTexto rotulo="O que é" valor={descricao} aoMudar={setDescricao} erro={erros.descricao}
        placeholder={tipo === 'saida' ? 'ex.: Aluguel, Internet, Academia' : 'ex.: Salário, Ajuda de custo'} autoFocus={!item} />
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <CampoValor rotulo="Valor por mês" valor={valor} aoMudar={setValor} erro={erros.valor} />
        <CampoNumero rotulo="Todo dia" valor={dia} aoMudar={setDia} erro={erros.diaDoMes} />
      </div>
      <CampoEscolha rotulo="Categoria" valor={categoriaEscolhida} aoMudar={setCategoriaId}
        opcoes={catsDoTipo.map((c) => ({ valor: c.id, rotulo: `${c.icone} ${c.nome}` }))} />
      <CampoEscolha rotulo={tipo === 'saida' ? 'Sai de' : 'Cai em'} valor={ondeEscolhido} aoMudar={setOnde} erro={erros.contaId} opcoes={opcoesOnde}
        ajuda={tipo === 'saida' ? 'No dia, o valor já é descontado do saldo previsto.' : undefined} />
      {tipo === 'entrada' && (
        <>
          {fontes.length > 0 && (
            <CampoEscolha rotulo="Fonte de renda" valor={fonteId || ''} aoMudar={setFonteId}
              opcoes={[{ valor: '', rotulo: 'Nenhuma' }, ...fontes.map((f) => ({ valor: f.id, rotulo: f.nome }))]} />
          )}
          <Segmentos rotulo="Certeza" valor={certeza} aoMudar={setCerteza} opcoes={OPCOES_CERTEZA} />
        </>
      )}
      {item && (
        <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
          <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} className="h-5 w-5 accent-[var(--color-destaque)]" />
          <span className="font-bold">Ativo</span>
          <span className="text-sm text-texto-2">Desligue para pausar sem apagar.</span>
        </label>
      )}
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.recorrencias.excluir(item.id); aoFechar(); } : undefined} />
    </div>
  );
}

// ---------- Categoria ----------

const ICONES_RAPIDOS = ['🍽️', '🛒', '🚗', '🏠', '💊', '🎉', '🛍️', '📺', '📚', '💇', '🐾', '🧾', '🎁', '✈️', '⛽', '👶', '💼', '💰', '📈', '📦'];

export function FormCategoria({ item, aoFechar, tipoInicial = 'saida' }: PropsForm<Categoria> & { tipoInicial?: Categoria['tipo'] }) {
  const todas = useConsulta(() => repositorio.categorias.listar(), []) ?? [];
  const usos = useConsulta(async () => (item ? (await repositorio.recorrencias.listar()).filter((r) => r.modelo.categoriaId === item.id).length : 0), [item?.id]);
  const [nome, setNome] = useState(item?.nome ?? '');
  const [tipo, setTipo] = useState<Categoria['tipo']>(item?.tipo ?? tipoInicial);
  const [icone, setIcone] = useState(item?.icone ?? '📦');
  const [cor, setCor] = useState(item?.cor ?? CORES_CATEGORIA[0]);
  const [palavras, setPalavras] = useState(item?.palavrasChave.join(', ') ?? '');
  const [erros, setErros] = useState<Erros>({});
  const ehOutros = item && (item.nome === NOME_OUTROS_SAIDA || item.nome === NOME_OUTROS_ENTRADA);

  async function salvar() {
    const dados = { nome: nome.trim(), tipo, icone: icone.trim() || '📦', cor, palavrasChave: separarPalavrasChave(palavras) };
    const e = validarCategoria({ ...dados, id: item?.id }, todas);
    setErros(e);
    if (!valido(e)) return;
    if (item) await repositorio.categorias.salvar({ ...item, ...dados });
    else await repositorio.categorias.criar(dados);
    aoFechar();
  }

  return (
    <div className="flex flex-col gap-4">
      {!item && (
        <Segmentos rotulo="Tipo" valor={tipo} aoMudar={setTipo}
          opcoes={[{ valor: 'saida', rotulo: 'Gasto' }, { valor: 'entrada', rotulo: 'Entrada' }]} />
      )}
      <CampoTexto rotulo="Nome" valor={nome} aoMudar={setNome} erro={erros.nome} autoFocus={!item} />
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-texto-2">Ícone</span>
        <div className="flex flex-wrap gap-1.5">
          {ICONES_RAPIDOS.map((i) => (
            <button key={i} type="button" onClick={() => setIcone(i)} aria-label={`Ícone ${i}`} aria-pressed={icone === i}
              className={`h-10 w-10 rounded-xl text-xl ${icone === i ? 'bg-superficie ring-2 ring-destaque' : 'bg-superficie-2'}`}>{i}</button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-texto-2">Cor</span>
        <div className="flex flex-wrap gap-2">
          {CORES_CATEGORIA.map((c) => (
            <button key={c} type="button" onClick={() => setCor(c)} aria-label={`Cor ${c}`} aria-pressed={cor === c}
              className={`h-8 w-8 rounded-full ${cor === c ? 'ring-2 ring-texto ring-offset-2 ring-offset-fundo' : ''}`} style={{ background: c }} />
          ))}
        </div>
      </div>
      <CampoTexto rotulo="Palavras-chave" valor={palavras} aoMudar={setPalavras}
        ajuda="Separe por vírgula. Ao digitar “uber 18” no lançamento rápido, o app usa essas palavras para achar a categoria." />
      <Acoes aoSalvar={salvar} aoCancelar={aoFechar}
        aoExcluir={item ? async () => { await repositorio.categorias.excluir(item.id); aoFechar(); } : undefined}
        bloqueioExclusao={ehOutros ? 'Esta categoria é usada quando nenhuma palavra combina, por isso não pode ser excluída.'
          : usos ? 'Há fixos nesta categoria. Troque a categoria deles antes de excluir.' : undefined} />
    </div>
  );
}
