import { useState, type ReactNode } from 'react';
import { Tela, EmConstrucao } from '../componentes/Tela';
import { CadastroCartoes, CadastroCategorias, CadastroContas, CadastroFixos, CadastroFontes } from '../componentes/cadastros';
import { Botao, CampoEscolha, Segmentos } from '../componentes/ui';
import { repositorio } from '../data/repositorio';
import { useConsulta } from '../data/useConsulta';
import { PERFIS } from '../calculos/padroes';
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

        <Secao titulo="Contas" descricao="Onde o dinheiro fica parado e disponível."><CadastroContas /></Secao>
        <Secao titulo="Cartões de crédito"><CadastroCartoes /></Secao>
        <Secao titulo="Fontes de renda"><CadastroFontes /></Secao>
        <Secao titulo="Fixos" descricao="Contas que se repetem todo mês. Entram sozinhas como previstas."><CadastroFixos /></Secao>
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
