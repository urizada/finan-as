import { useState, type ReactNode } from 'react';
import { Tela, EmConstrucao } from '../componentes/Tela';
import { CadastroCartoes, CadastroCategorias, CadastroContas, CadastroFixos, CadastroFontes } from '../componentes/cadastros';
import { Botao, CampoEscolha, Segmentos } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { useConsulta } from '../data/useConsulta';
import { PERFIS } from '../calculos/padroes';
import { PERCENTUAIS_PADRAO, percentuaisValidos, type Percentuais } from '../calculos/orcamento';
import { linkPara } from '../navegacao';
import type { PerfilRenda } from '../tipos';
import { SeletorMeses } from './Onboarding';

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-bold">{titulo}</h2>
        {descricao && <p className="text-sm text-texto-2">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

export function Configuracoes() {
  const config = useConsulta(() => repositorio.obterConfig(), []);
  const [refazer, setRefazer] = useState(false);
  if (!config) return <Tela titulo="Configurações" voltar={linkPara('mais')}>{null}</Tela>;
  const perfil = PERFIS[config.perfilRenda];

  return (
    <Tela titulo="Configurações" voltar={linkPara('mais')}>
      <div className="flex flex-col gap-8">
        <Secao titulo="Aparência">
          <Segmentos valor={config.tema} aoMudar={(tema) => repositorio.salvarConfig({ tema })}
            opcoes={[{ valor: 'claro', rotulo: 'Claro' }, { valor: 'escuro', rotulo: 'Escuro' }]} />
        </Secao>

        <Secao titulo="Perfil de renda" descricao="Muda as sugestões de reserva e de certeza das entradas.">
          <CampoEscolha rotulo="Como você recebe" valor={config.perfilRenda}
            aoMudar={(p: PerfilRenda) => repositorio.salvarConfig({ perfilRenda: p })}
            opcoes={(Object.keys(PERFIS) as PerfilRenda[]).map((p) => ({ valor: p, rotulo: PERFIS[p].rotulo }))}
            ajuda={perfil.descricao} />
          <SeletorMeses valor={config.mesesReservaAlvo} faixa={perfil.faixaReserva}
            aoMudar={(m) => repositorio.salvarConfig({ mesesReservaAlvo: m })} />
          <Segmentos rotulo="O que sobrar no fim do mês vai para" valor={config.destinoSobraMes}
            aoMudar={(d) => repositorio.salvarConfig({ destinoSobraMes: d })}
            opcoes={[{ valor: 'reserva', rotulo: 'Reserva' }, { valor: 'proximoMes', rotulo: 'Próximo mês' }]} />
        </Secao>

        <Secao titulo="Divisão das entradas" descricao="Quando uma entrada cai, o app cobre primeiro os fixos do mês e sugere dividir o resto assim.">
          <DivisaoConfig valor={config.divisaoEntrada ?? PERCENTUAIS_PADRAO} sugerir={config.sugerirDivisao ?? false} />
        </Secao>

        <Secao titulo="Contas" descricao="Onde o dinheiro fica parado e disponível."><CadastroContas /></Secao>
        <Secao titulo="Cartões de crédito"><CadastroCartoes /></Secao>
        <Secao titulo="Fontes de renda"><CadastroFontes /></Secao>
        <Secao titulo="Fixos e repetições" descricao="O que se repete (todo mês, a cada 15 dias ou toda semana). Entra sozinho como previsto."><CadastroFixos /></Secao>
        <Secao titulo="Categorias"><CadastroCategorias /></Secao>

        <Secao titulo="Backup">
          <EmConstrucao fase={8} itens={['Exportar todos os dados em um arquivo', 'Importar de um arquivo']} />
        </Secao>

        <Secao titulo="Configuração inicial">
          {refazer ? (
            <div className="flex gap-2">
              <Botao tipo="secundario" className="flex-1" onClick={() => setRefazer(false)}>Cancelar</Botao>
              <Botao className="flex-[2]" onClick={() => repositorio.salvarConfig({ onboardingConcluido: false })}>Refazer agora</Botao>
            </div>
          ) : (
            <Botao tipo="secundario" onClick={() => setRefazer(true)}>Refazer passo a passo</Botao>
          )}
          <p className="text-xs text-texto-2">Seus cadastros são mantidos. Você só passa pelas telas de novo.</p>
        </Secao>
      </div>
    </Tela>
  );
}

function DivisaoConfig({ valor, sugerir }: { valor: Percentuais; sugerir: boolean }) {
  const [p, setP] = useState<Percentuais>(valor);
  const soma = p.reserva + p.investimentos + p.metas + p.livre;
  const campo = (k: keyof Percentuais, rot: string) => (
    <label className="flex items-center justify-between gap-3 px-4 py-2.5">
      <span className="font-semibold">{rot}</span>
      <span className="flex items-center gap-1">
        <input inputMode="numeric" value={String(p[k])} aria-label={`${rot} em %`}
          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0; const novo = { ...p, [k]: n }; setP(novo); if (percentuaisValidos(novo)) repositorio.salvarConfig({ divisaoEntrada: novo }); }}
          className="w-16 rounded-xl border border-borda bg-fundo px-2 py-1.5 text-right text-base font-bold" />
        <span className="text-texto-2">%</span>
      </span>
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="divide-y divide-borda rounded-2xl border border-borda bg-superficie">
        {campo('reserva', 'Reserva')}{campo('investimentos', 'Investimentos')}{campo('metas', 'Metas')}{campo('livre', 'Livre para gastar')}
      </div>
      {soma !== 100 && <p className="text-sm font-semibold text-saida">A soma está em {soma}%. Ajuste para 100% para salvar.</p>}
      <label className="flex items-center gap-3 rounded-2xl bg-superficie px-4 py-3">
        <input type="checkbox" checked={sugerir} onChange={(e) => repositorio.salvarConfig({ sugerirDivisao: e.target.checked })} className="h-5 w-5 accent-[var(--color-destaque)]" />
        <span className="font-bold">Sugerir ao lançar uma entrada que caiu</span>
      </label>
    </div>
  );
}
