// Listas de cadastro com botão de adicionar e edição numa folha. Usadas no onboarding e nas Configurações.
import { useCallback, useState, type ReactNode } from 'react';
import { repositorio } from '../data/repositorio';
import { useConsulta } from '../data/useConsulta';
import { formatarReais, formatarTaxa } from '../calculos/dinheiro';
import { ROTULO_CERTEZA, ROTULO_TIPO_FONTE } from '../calculos/padroes';
import type { Cartao, Categoria, Conta, FonteRenda, Id, Recorrencia } from '../tipos';
import { FormCartao, FormCategoria, FormConta, FormFonte, FormRecorrencia } from './formularios';
import { Folha, LinhaItem, Segmentos } from './ui';

type Edicao<T> = T | 'novo' | null;

function Gerenciador<T extends { id: Id }>({
  itens, vazio, rotuloAdicionar, tituloNovo, tituloEditar, linha, formulario, desabilitado,
}: {
  itens: T[] | undefined;
  vazio: string;
  rotuloAdicionar: string;
  tituloNovo: string;
  tituloEditar: string;
  linha: (t: T, abrir: () => void) => ReactNode;
  formulario: (item: T | undefined, fechar: () => void) => ReactNode;
  desabilitado?: string;
}) {
  const [editando, setEditando] = useState<Edicao<T>>(null);
  const fechar = useCallback(() => setEditando(null), []);
  return (
    <div className="flex flex-col gap-2">
      {itens && itens.length > 0 ? (
        <ul className="divide-y divide-borda overflow-hidden rounded-2xl border border-borda bg-superficie">
          {itens.map((t) => linha(t, () => setEditando(t)))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-borda px-4 py-4 text-sm text-texto-2">{itens ? vazio : 'Carregando…'}</p>
      )}
      {desabilitado ? (
        <p className="px-1 text-sm text-texto-2">{desabilitado}</p>
      ) : (
        <button type="button" onClick={() => setEditando('novo')}
          className="self-start rounded-full px-3 py-2 text-sm font-bold text-destaque hover:bg-superficie-2">
          + {rotuloAdicionar}
        </button>
      )}
      <Folha aberta={editando !== null} titulo={editando === 'novo' ? tituloNovo : tituloEditar} aoFechar={fechar}>
        {editando !== null && formulario(editando === 'novo' ? undefined : editando, fechar)}
      </Folha>
    </div>
  );
}

const Selo = ({ children }: { children: ReactNode }) => (
  <span className="ml-1.5 rounded-full bg-superficie-2 px-2 py-0.5 align-middle text-[11px] font-bold text-texto-2">{children}</span>
);

export function CadastroContas() {
  const contas = useConsulta(() => repositorio.contas.listar(), []);
  const config = useConsulta(() => repositorio.obterConfig(), []);
  return (
    <Gerenciador<Conta> itens={contas} vazio="Nenhuma conta ainda. Comece pela conta onde cai seu dinheiro."
      rotuloAdicionar="Adicionar conta" tituloNovo="Nova conta" tituloEditar="Editar conta"
      linha={(c, abrir) => (
        <LinhaItem key={c.id} aoTocar={abrir}
          titulo={<>{c.nome}{config?.contaPadraoId === c.id && <Selo>padrão</Selo>}</>}
          sub={c.tipo === 'corrente' ? 'Conta no banco' : 'Dinheiro vivo'}
          direita={<span className={c.saldoInicial < 0 ? 'text-saida' : ''}>{formatarReais(c.saldoInicial)}</span>} />
      )}
      formulario={(item, fechar) => <FormConta item={item} aoFechar={fechar} />} />
  );
}

export function CadastroCartoes() {
  const cartoes = useConsulta(() => repositorio.cartoes.listar(), []);
  const contas = useConsulta(() => repositorio.contas.listar(), []);
  return (
    <Gerenciador<Cartao> itens={cartoes} vazio="Nenhum cartão. Se você não usa, pode pular."
      rotuloAdicionar="Adicionar cartão" tituloNovo="Novo cartão" tituloEditar="Editar cartão"
      desabilitado={contas && contas.length === 0 ? 'Cadastre uma conta antes: é dela que sai o pagamento da fatura.' : undefined}
      linha={(c, abrir) => (
        <LinhaItem key={c.id} aoTocar={abrir} titulo={c.nome}
          sub={`Fecha dia ${c.diaFechamento} · vence dia ${c.diaVencimento}`} direita={formatarReais(c.limite)} />
      )}
      formulario={(item, fechar) => <FormCartao item={item} aoFechar={fechar} />} />
  );
}

export function CadastroFontes() {
  const fontes = useConsulta(() => repositorio.fontesRenda.listar(), []);
  return (
    <Gerenciador<FonteRenda> itens={fontes} vazio="Nenhuma fonte de renda ainda."
      rotuloAdicionar="Adicionar fonte" tituloNovo="Nova fonte de renda" tituloEditar="Editar fonte de renda"
      linha={(f, abrir) => (
        <LinhaItem key={f.id} aoTocar={abrir} titulo={f.nome}
          sub={[ROTULO_TIPO_FONTE[f.tipo], ROTULO_CERTEZA[f.certezaPadrao], f.taxaComissao ? formatarTaxa(f.taxaComissao) : null].filter(Boolean).join(' · ')}
          direita={<><span className="block">{formatarReais(f.valorMedioMensal)}</span><span className="block text-xs font-medium text-texto-2">média/mês</span></>} />
      )}
      formulario={(item, fechar) => <FormFonte item={item} aoFechar={fechar} />} />
  );
}

export function CadastroFixos() {
  const recs = useConsulta(async () => (await repositorio.recorrencias.listar()).sort((a, b) => a.diaDoMes - b.diaDoMes), []);
  const categorias = useConsulta(() => repositorio.categorias.listar(), []) ?? [];
  const contas = useConsulta(() => repositorio.contas.listar(), []);
  const icone = (id?: Id) => categorias.find((c) => c.id === id)?.icone ?? '•';
  return (
    <Gerenciador<Recorrencia> itens={recs} vazio="Nenhum fixo. Ex.: aluguel, internet, academia, assinaturas."
      rotuloAdicionar="Adicionar fixo" tituloNovo="Novo fixo" tituloEditar="Editar fixo"
      desabilitado={contas && contas.length === 0 ? 'Cadastre uma conta antes: é dela que os fixos saem.' : undefined}
      linha={(r, abrir) => (
        <LinhaItem key={r.id} aoTocar={abrir}
          marcador={<span className="w-7 text-center text-xl" aria-hidden="true">{icone(r.modelo.categoriaId)}</span>}
          titulo={<>{r.modelo.descricao}{!r.ativa && <Selo>pausado</Selo>}</>}
          sub={`Todo dia ${r.diaDoMes}${r.modelo.tipo === 'entrada' ? ` · entrada ${ROTULO_CERTEZA[r.modelo.certeza ?? 'garantida'].toLowerCase()}` : ''}`}
          direita={<span className={r.modelo.tipo === 'entrada' ? 'text-entrada' : 'text-saida'}>
            {r.modelo.tipo === 'entrada' ? '+' : '−'}{formatarReais(r.modelo.valor ?? 0)}</span>} />
      )}
      formulario={(item, fechar) => <FormRecorrencia item={item} aoFechar={fechar} />} />
  );
}

export function CadastroCategorias() {
  const [tipo, setTipo] = useState<Categoria['tipo']>('saida');
  const categorias = useConsulta(async () => (await repositorio.categorias.listar()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), []);
  return (
    <div className="flex flex-col gap-3">
      <Segmentos valor={tipo} aoMudar={setTipo} opcoes={[{ valor: 'saida', rotulo: 'Gastos' }, { valor: 'entrada', rotulo: 'Entradas' }]} />
      <Gerenciador<Categoria> itens={categorias?.filter((c) => c.tipo === tipo)} vazio="Nenhuma categoria."
        rotuloAdicionar="Adicionar categoria" tituloNovo="Nova categoria" tituloEditar="Editar categoria"
        linha={(c, abrir) => (
          <LinhaItem key={c.id} aoTocar={abrir}
            marcador={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: `${c.cor}26` }} aria-hidden="true">{c.icone}</span>}
            titulo={c.nome} sub={c.palavrasChave.length ? c.palavrasChave.join(', ') : 'Sem palavras-chave'} />
        )}
        formulario={(item, fechar) => <FormCategoria item={item} aoFechar={fechar} tipoInicial={tipo} />} />
    </div>
  );
}
