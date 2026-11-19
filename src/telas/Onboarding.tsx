// Primeira abertura: perfil → contas → fontes de renda → fixos → cartões → reserva.
import { useState, type ReactNode } from 'react';
import { CadastroCartoes, CadastroContas, CadastroFixos, CadastroFontes } from '../componentes/cadastros';
import { Botao } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { garantirCategoriasPadrao } from '../data/semente';
import { useConsulta } from '../data/useConsulta';
import { PERFIS, limitarMesesReserva } from '../calculos/padroes';
import type { PerfilRenda } from '../tipos';

export function SeletorMeses({ valor, faixa, aoMudar }: { valor: number; faixa: [number, number]; aoMudar: (m: number) => void }) {
  const botao = 'h-12 w-12 rounded-full bg-superficie-2 text-2xl font-bold disabled:opacity-30';
  return (
    <div className="rounded-2xl border border-borda bg-superficie p-4">
      <p className="text-sm font-bold text-texto-2">Reserva de emergência</p>
      <div className="mt-2 flex items-center justify-between">
        <button type="button" className={botao} aria-label="Menos um mês" disabled={valor <= 1} onClick={() => aoMudar(limitarMesesReserva(valor - 1))}>−</button>
        <p className="text-center">
          <span className="block text-4xl font-extrabold tabular-nums">{valor}</span>
          <span className="text-sm text-texto-2">{valor === 1 ? 'mês' : 'meses'} de custo fixo</span>
        </p>
        <button type="button" className={botao} aria-label="Mais um mês" disabled={valor >= 24} onClick={() => aoMudar(limitarMesesReserva(valor + 1))}>+</button>
      </div>
      <p className="mt-3 text-center text-xs text-texto-2">Sugestão para o seu perfil: {faixa[0]} a {faixa[1]} meses.</p>
    </div>
  );
}

const PASSOS = ['perfil', 'contas', 'fontes', 'fixos', 'cartoes', 'reserva'] as const;
type Passo = (typeof PASSOS)[number];

const TEXTOS: Record<Passo, { titulo: string; descricao: string }> = {
  perfil: { titulo: 'Como você recebe?', descricao: 'Isso ajusta as sugestões do app. Dá para mudar depois.' },
  contas: { titulo: 'Onde está seu dinheiro?', descricao: 'Cadastre suas contas com o saldo de hoje. O saldo previsto de cada dia parte daqui.' },
  fontes: { titulo: 'De onde vem sua renda?', descricao: 'Informe a média por mês. Ela só entra na previsão, nunca no que você pode gastar hoje.' },
  fixos: { titulo: 'Quais contas se repetem?', descricao: 'Aluguel, internet, academia, assinaturas. Elas entram sozinhas todo mês e você só lança o resto.' },
  cartoes: { titulo: 'Usa cartão de crédito?', descricao: 'Com o dia de fechamento, o app sabe em qual fatura cada compra cai.' },
  reserva: { titulo: 'Quanto quer guardar de reserva?', descricao: 'Em meses de custo fixo. Com renda variável, uma reserva maior dá mais tranquilidade.' },
};

export function Onboarding() {
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const contas = useConsulta(() => repositorio.contas.listar(), []);
  const [passo, setPasso] = useState<Passo>('perfil');
  const [perfil, setPerfil] = useState<PerfilRenda | null>(null);
  const i = PASSOS.indexOf(passo);
  const perfilAtual = perfil ?? config?.perfilRenda ?? 'variavel';

  async function avancar() {
    if (passo === 'perfil') {
      await garantirCategoriasPadrao();
      const mudou = perfilAtual !== config?.perfilRenda || !config?.onboardingConcluido;
      await repositorio.salvarConfig({
        perfilRenda: perfilAtual,
        ...(mudou ? { mesesReservaAlvo: PERFIS[perfilAtual].mesesReservaAlvo } : {}),
      });
      if ((await repositorio.fontesRenda.listar()).length === 0)
        for (const f of PERFIS[perfilAtual].fontesSugeridas) await repositorio.fontesRenda.criar({ ...f, valorMedioMensal: 0 });
    }
    if (passo === 'reserva') {
      await repositorio.salvarConfig({ onboardingConcluido: true });
      location.hash = '#/';
      return;
    }
    setPasso(PASSOS[i + 1]);
    window.scrollTo(0, 0);
  }

  const podeAvancar = passo !== 'contas' || (contas?.length ?? 0) > 0;
  const opcional = passo === 'fixos' || passo === 'cartoes';
  const { titulo, descricao } = TEXTOS[passo];

  let conteudo: ReactNode;
  if (passo === 'perfil') {
    conteudo = (
      <ul className="flex flex-col gap-2" role="radiogroup" aria-label="Perfil de renda">
        {(Object.keys(PERFIS) as PerfilRenda[]).map((p) => {
          const marcado = perfilAtual === p;
          return (
            <li key={p}>
              <button type="button" role="radio" aria-checked={marcado} onClick={() => setPerfil(p)}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-superficie px-4 py-3.5 text-left transition ${marcado ? 'border-destaque' : 'border-borda'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${marcado ? 'border-destaque' : 'border-borda'}`}>
                  {marcado && <span className="h-2.5 w-2.5 rounded-full bg-destaque" />}
                </span>
                <span>
                  <span className="block font-bold">{PERFIS[p].rotulo}</span>
                  <span className="block text-sm text-texto-2">{PERFIS[p].descricao}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );
  } else if (passo === 'contas') conteudo = <CadastroContas />;
  else if (passo === 'fontes') conteudo = <CadastroFontes />;
  else if (passo === 'fixos') conteudo = <CadastroFixos />;
  else if (passo === 'cartoes') conteudo = <CadastroCartoes />;
  else conteudo = config && (
    <SeletorMeses valor={config.mesesReservaAlvo} faixa={PERFIS[config.perfilRenda].faixaReserva}
      aoMudar={(m) => repositorio.salvarConfig({ mesesReservaAlvo: m })} />
  );

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-36">
      <div className="mb-6 flex gap-1.5" aria-label={`Passo ${i + 1} de ${PASSOS.length}`}>
        {PASSOS.map((p, n) => (
          <span key={p} className={`h-1.5 flex-1 rounded-full ${n <= i ? 'bg-destaque' : 'bg-borda'}`} />
        ))}
      </div>
      {i === 0 && <p className="mb-1 text-sm font-bold text-destaque">Vamos configurar seu app</p>}
      <h1 className="text-2xl font-extrabold tracking-tight text-balance">{titulo}</h1>
      <p className="mt-1.5 mb-5 text-texto-2">{descricao}</p>
      {conteudo}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borda bg-fundo/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-md gap-2">
          {i > 0 && <Botao tipo="secundario" className="flex-1" onClick={() => setPasso(PASSOS[i - 1])}>Voltar</Botao>}
          <Botao className="flex-[2]" onClick={avancar} disabled={!podeAvancar}>
            {passo === 'reserva' ? 'Começar a usar' : 'Continuar'}
          </Botao>
        </div>
        {!podeAvancar && <p className="mx-auto mt-2 max-w-md text-center text-xs text-texto-2">Cadastre pelo menos uma conta para continuar.</p>}
        {opcional && <p className="mx-auto mt-2 max-w-md text-center text-xs text-texto-2">Este passo é opcional.</p>}
      </div>
    </main>
  );
}
