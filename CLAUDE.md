# App de Finanças Pessoais — Especificação v1

> Este arquivo é a fonte da verdade do projeto. Leia inteiro antes de qualquer código.
> Construa **uma fase por vez**, na ordem da seção 8. Ao fim de cada fase, pare, me mostre o que foi feito e espere eu aprovar antes de seguir.

## 1. Visão

App de organização financeira pessoal, **mobile-first**, que responde três perguntas:
1. **Quanto posso gastar hoje?**
2. **Pra onde está indo meu dinheiro?**
3. **Como vai estar minha situação daqui a 3, 6 e 12 meses?**

**Público e tom:** o app é para quem **não tem muito controle financeiro**. Tudo precisa ser simples de entender: uma resposta clara por tela, poucas palavras técnicas, números grandes, cores que dizem a situação. Na dúvida entre mostrar mais ou mostrar menos, mostrar menos.

A v1 é para um único usuário (eu), com renda **100% variável (comissão)**. Mas a arquitetura deve ser **genérica desde o início**, para depois servir qualquer tipo de renda (CLT, autônomo, sazonal, mista) e vários usuários sem reescrever.

**Princípio central — renda com grau de certeza.** Toda entrada tem um nível:
- `garantida` — já caiu na conta, ou é salário fixo certo
- `provavel` — contrato fechado, comissão a receber
- `possivel` — pipeline, negociação em andamento

O orçamento do dia a dia usa **apenas o garantido**. Provável e possível só entram nos cenários de previsão.

## 2. Stack

- **React + Vite + TypeScript**
- **Tailwind CSS**
- **PWA** (`vite-plugin-pwa`) — instalável na tela inicial do celular, funciona offline
- **Dexie (IndexedDB)** — dados salvos localmente no aparelho
- **Recharts** — gráficos
- **Vitest** — testes das funções de cálculo
- Deploy: **Vercel** (grátis)

**Regra de arquitetura:** todo acesso a dados passa por uma camada `src/data/repositorio.ts`. Nenhum componente fala com o Dexie direto. Assim, na v2, trocamos por Supabase (login + sincronização celular/PC) mexendo só nessa camada.

**Limitação conhecida da v1:** dados ficam só no aparelho. Por isso a v1 precisa de **exportar/importar backup em JSON**.

## 3. Regras gerais

- Interface 100% em **português (pt-BR)**. Moeda `R$ 1.234,56`, datas `dd/mm/aaaa`.
- **Dinheiro sempre em centavos (inteiro)** no banco e nos cálculos. Nunca `float` para valor.
- Toda lógica de cálculo fica em `src/calculos/` como **funções puras**, com testes.
- Mobile-first: projetar para tela de ~390px; no PC, layout centralizado.
- Visual limpo, **tema claro como padrão** (escuro opcional nas Configurações), número principal grande e legível.
- Ações principais com no máximo 2 toques.

## 4. Modelo de dados

```ts
type Centavos = number;
type Certeza = 'garantida' | 'provavel' | 'possivel';

Config {
  perfilRenda: 'fixa' | 'variavel' | 'autonoma' | 'sazonal' | 'mista';
  mesesReservaAlvo: number;          // padrão: 6 (fixa: 3–6, variável: 6–12)
  destinoSobraMes: 'reserva' | 'proximoMes';
  tema: 'claro' | 'escuro';          // padrão: 'claro'
  contaPadraoId?;                    // conta usada quando o lançamento não diz qual
  onboardingConcluido: boolean;
  divisaoEntrada?: { reserva; investimentos; metas; livre };  // % que somam 100 (padrão 20/10/0/70)
  sugerirDivisao?: boolean;          // mostrar a divisão ao lançar entrada que caiu (padrão: sim)
}

Conta {                              // onde o dinheiro fica parado e disponível
  id; nome; tipo: 'corrente' | 'carteira';
  saldoInicial: Centavos;
  dataSaldoInicial: string;          // dia em que o saldo foi informado; o saldo projetado parte daqui
}

Categoria {
  id; nome; tipo: 'entrada' | 'saida'; icone; cor;
  palavrasChave: string[];           // usadas pelo lançamento rápido
  limiteMensal?: Centavos;           // limite de gasto por mês (só saída)
}

FonteRenda {
  id; nome;
  tipo: 'fixa' | 'variavel' | 'autonoma' | 'sazonal';
  valorMedioMensal: Centavos;
  certezaPadrao: Certeza;
  taxaComissao?: number;             // ex.: 0.035 — para ponto de equilíbrio em produção
}

Lancamento {
  id;
  tipo: 'entrada' | 'saida' | 'transferencia';
  valor: Centavos;
  data: string;                      // data da compra/recebimento (competência)
  descricao: string;
  categoriaId?;
  contaId?;                          // saída/entrada em conta
  cartaoId?;                         // se foi no cartão
  faturaRef?: string;                // 'AAAA-MM' da fatura em que cai
  fonteRendaId?;
  certeza: Certeza;                  // entradas; saídas são sempre 'garantida'
  status: 'realizado' | 'previsto';
  recorrenciaId?;
  recorrenciaData?: string;          // data prevista da ocorrência (mesmo se o usuário mudar a data)
  parcela?: { numero: number; total: number; grupoId: string };
  saldoAnterior?: boolean;           // fatura que já estava aberta antes de usar o app
  retirada?: boolean;                // transferência que tira da meta/investimento e volta para a conta
  destino?: { tipo: 'meta' | 'investimento'; id };  // para transferências/aportes
}

Recorrencia {                        // fixos, assinaturas, salário, comissão semanal
  id; modelo: Partial<Lancamento>;
  frequencia?: 'mensal' | 'quinzenal' | 'semanal';   // padrão: mensal
  diaDoMes: number;                  // mensal
  dataInicio?: string;               // semanal/quinzenal: 1ª ocorrência (e conta "3 de 10")
  ativa: boolean; fim?: string;      // fim = data da última ocorrência
  excecoes?: string[];               // datas excluídas "só esta vez"
}

Cartao {
  id; nome; limite: Centavos;
  diaFechamento: number; diaVencimento: number;
  contaPagamentoId;
}

Meta {                               // inclui a reserva de emergência
  id; nome;
  tipo: 'reserva_emergencia' | 'meta';
  valorAlvo: Centavos;               // reserva: calculado = custoFixo × mesesReservaAlvo
  prazo?: string;
  saldoAtual: Centavos;              // saldo antes do app; o atual = este + aportes − retiradas
  criadaEm?: string;                 // para saber se está no ritmo
}

Investimento {                       // investimentos e caixinhas
  id; nome;
  tipo: 'caixinha' | 'cdb' | 'tesouro' | 'acoes' | 'fii' | 'cripto' | 'outro';
  instituicao: string;
  rendimentoDescricao?: string;      // ex.: '100% CDI'
  aporteMensalPlanejado: Centavos;
}

SnapshotInvestimento {               // atualização manual de saldo → histórico
  id; investimentoId; data: string; saldo: Centavos;
}
```

## 5. Cálculos (em `src/calculos/`, todos com teste)

### 5.1 Livre por dia — o número principal
Base de **competência** (a compra conta no dia em que foi feita, mesmo no cartão):

```
orcamentoLivreMes =
    entradas GARANTIDAS do mês (realizadas + previstas)
  − saídas fixas do mês (recorrências, pagas ou não)
  − parcelas de cartão com competência no mês
  − aportes planejados do mês (reserva, metas, investimentos)
  − gastos variáveis do mês até ONTEM (conta + cartão)

livreHoje        = orcamentoLivreMes ÷ dias restantes no mês (incluindo hoje)
aindaPossoHoje   = livreHoje − gastos variáveis de HOJE
```
- Gastou menos hoje → amanhã sobe. Gastou mais → cai.
- Se negativo: mostrar em vermelho + "faltam R$ X de entrada para fechar o mês".
- O pagamento da fatura é **neutro** no orçamento (é só transferência); as compras já foram contadas.

### 5.2 Alerta de caixa
Separado do orçamento: se `saldo das contas < (faturas + fixos a pagar até o fim do mês)`, mostrar alerta "vai faltar R$ X na conta até dia DD".

### 5.3 Fatura do cartão
- Compra com dia **≤ fechamento** → fatura do mês corrente; **> fechamento** → fatura seguinte.
- Parcelado: gera N lançamentos, um por fatura, com `parcela`.
- Por cartão: fatura atual, próximas faturas, limite usado/disponível, **melhor dia de compra** (dia seguinte ao fechamento).

### 5.4 Reserva de emergência
```
custoFixoMensal  = soma das recorrências de saída
mesesDeReserva   = saldo da reserva ÷ custoFixoMensal       → "2,3 de 6 meses"
fôlego           = (saldo contas + reserva) ÷ custoFixoMensal → "aguenta X meses sem entrar nada"
```

### 5.5 Metas
```
aporteMensalNecessario = (valorAlvo − saldoAtual) ÷ meses até o prazo
status = 'no ritmo' | 'atrasada' | 'adiantada'   (compara saldo real vs saldo esperado na data)
```

### 5.6 Ponto de equilíbrio
```
necessarioNoMes = custoFixoMensal + aportes planejados
```
(Decisão do usuário: **não** mostrar meta de vendas / produção necessária.)

### 5.9 Limites por categoria
```
gastoNoMes(categoria) = saídas da categoria no mês, pela data da compra (conta + cartão)
perto     = gasto ≥ 80% do limite
estourado = gasto > limite
```
Ao lançar um gasto que deixa a categoria perto ou acima do limite, perguntar antes de salvar: "Você já gastou R$ X de R$ Y em Mercado. Com este gasto vai para R$ Z. Quer continuar?"

### 5.7 Divisão automática de entrada
Ao lançar entrada garantida, sugerir divisão (o usuário confirma ou edita):
1. Primeiro, completar o que falta dos **fixos do mês**.
2. O restante divide por percentuais configuráveis entre reserva, investimentos, metas e livre.

### 5.8 Previsão 3 / 6 / 12 meses
Por mês futuro:
- **Pessimista:** só entradas garantidas
- **Base:** garantidas + prováveis (+ `valorMedioMensal` das fontes sem lançamento)
- **Otimista:** base + possíveis
- Saídas: fixos + parcelas futuras + média dos gastos variáveis dos últimos 3 meses
- Resultado: saldo acumulado projetado, evolução da reserva e mês previsto para bater cada meta.

## 6. Lançamento rápido (parser)

Campo único fixo na home. O usuário digita como fala:

| Entrada | Resultado |
|---|---|
| `almoço 32` | saída R$ 32,00 · Alimentação · conta padrão · hoje |
| `uber 18,50 nubank` | saída R$ 18,50 · Transporte · cartão Nubank |
| `tênis 600 nubank 3x` | 3 parcelas de R$ 200 no cartão Nubank |
| `recebi 1200 comissão` | entrada R$ 1.200 · garantida · fonte Comissão |
| `vou receber 2500 comissão` | entrada prevista · provável |
| `mercado 150 ontem` | saída com data de ontem |

Regras (v1 por regex + dicionário, sem IA):
- Valor: primeiro número (aceita `32`, `32,50`, `1.200`, `1200`).
- `recebi`/`entrou`/`salário` → entrada; `vou receber` → provável. Padrão: saída.
- Categoria: casar palavras com `Categoria.palavrasChave`; sem match → "Outros" e pede confirmação.
- Cartão: nome do cartão no texto; parcelas: `Nx`.
- Data: `hoje` (padrão), `ontem`, `dd/mm`.
- Sempre mostrar **pré-visualização** antes de salvar, com campos editáveis.
- Se o usuário corrige a categoria, adicionar a palavra às `palavrasChave` (o app aprende).

Recorrências geram os lançamentos previstos do mês automaticamente, para que o usuário só precise lançar gasto variável.

## 7. Telas

1. **Hoje** (antes chamada Home)
   - "Livre hoje" (número grande) + "ainda posso hoje"
   - Lançamento rápido (também pelo botão **+** central da barra)
   - Resumo do mês: entrou / saiu / falta pagar
   - Fatura atual do cartão
   - Reserva em meses + fôlego
   - Cards resumidos de metas e carteira (toque abre)
   - Alerta de caixa, se houver
2. **Saldos** — onde se **anota** (layout da referência do usuário): cada dia é um bloco com as linhas **Entradas · Fixos · Dia a dia · Economia · Cartão** e, ao lado, o **saldo previsto** do dia ocupando o bloco todo (cor do horizonte). Filtro "Todas" ou uma linha só. Tocar numa linha mostra o que foi lançado nela naquele dia e permite lançar ali (já com tipo e data). Cartão mostra a fatura que vence no dia (e as compras do dia em letra pequena). ✓ no dia que passou; ! se tem conta a pagar. Topo: ir para hoje, ‹ mês ›, botão do Horizonte.
2a. **Horizonte de saldos** — onde se **enxerga**: um mês por coluna (12 meses, rola para o lado), um dia por linha, saldo curto ("5,85k"). Cores: verde forte (sobra mais que um mês de fixos), verde (cobre o mês), amarelo (não cobre o que ainda sai), rosa (negativo até 10% de um mês de fixos), vermelho. Diz o primeiro dia em que o dinheiro fica negativo. Tocar num dia abre esse dia em Saldos.
2b. **Lançamentos** — lista por dia, filtros (mês, categoria, cartão, tipo), editar/excluir (acesso pelo dia em Saldos e pelo Mais)
2c. **Totais** — números do mês (entrou − saiu, custo de vida, gasto diário médio vs. livre por dia), **economizado** (% guardado por mês e no ano) e a **Previsão** (tela 7)
3. **Para onde foi** — gastos por categoria (gráfico), fixo vs variável, comparação com meses anteriores
4. **Cartões** — faturas atual e futuras, parcelas, limite, melhor dia de compra
5. **Reserva e metas** — progresso, aporte necessário, status, botão "aportar"
6. **Investimentos** — total da carteira, distribuição por tipo, evolução, atualizar saldo
7. **Previsão** — gráfico de 12 meses com os 3 cenários + ponto de equilíbrio
8. **Configurações** — perfil de renda, contas, cartões, categorias, fontes de renda, recorrências, percentuais de divisão, backup (exportar/importar JSON)

Navegação: barra inferior com **Hoje · Saldos · (+) · Totais · Mais**. O **+** central abre o lançamento rápido em 1 toque. Mais: Lançamentos, Para onde foi, Cartões, Reserva e metas, Investimentos, Configurações.

**Onboarding (primeira abertura):** como você recebe (**Salário fixo · Comissão · Autônomo · Salário + comissão**, uma opção só) → contas e saldo atual → **salário** (se tiver: quanto cai e em que dia; vira entrada garantida todo mês) → fixos → **comissão num mês fraco** (se tiver: estimativa pessimista e como cai — toda semana, a cada 15 dias ou 1 vez no mês; vira entrada provável repetida) com o resumo "para pagar seus fixos você precisa fazer pelo menos R$ X por mês, cerca de R$ Y por semana" → cartões → meses de reserva.

## 8. Fases de construção

Cada fase termina com o app rodando e os testes passando.

- **Fase 0 — Base:** projeto Vite + TS + Tailwind + PWA, camada `repositorio`, schema Dexie, navegação e tema.
- **Fase 1 — Cadastros:** onboarding + Configurações (contas, categorias com palavras-chave padrão, fontes de renda, cartões, recorrências).
- **Fase 2 — Lançamentos e Saldos:** formulário manual, lista, editar/excluir, geração automática das recorrências do mês, marcar fixo como pago, **grade de Saldos** com saldo projetado por dia.
- **Fase 3 — Lançamento rápido e repetições:** parser da seção 6 + pré-visualização + aprendizado de palavras-chave. Testes com todos os exemplos da tabela. Opção **Repetir** no lançamento (semanal, quinzenal, mensal; sem fim ou N vezes) e **parcelas** em compras no cartão; a lista mostra "3 de 10" / "parcela 2/3".
- **Fase 4 — Cartões:** cálculo de fatura, tela de cartões (fatura atual e futuras, limite, melhor dia), **informar fatura que já estava em aberto** antes de usar o app, **pagar fatura** (sai da conta corrente no vencimento).
- **Fase 5 — Hoje, Totais e Livre por dia:** cálculos 5.1, 5.2 e 5.7 + tela Hoje completa (**visão geral**: contas chegando, situação das contas) + Totais do mês e economizado.
- **Fase 6 — Limites, reserva, metas e investimentos:** limites por categoria (5.9) com aviso antes de salvar; cálculos 5.4 e 5.5; guardar/usar reserva; metas com prazo; investimentos com atualização de saldo; tela Hoje e Saldos mais simples.
- **Fase 7 — Análise e previsão:** "Para onde foi" + cálculos 5.6 (sem produção) e 5.8 + gráficos.
- **Fase 8 — Acabamento:** backup JSON, estados vazios, revisão visual mobile, deploy na Vercel e instruções para instalar no celular.

## 8.1 Decisões tomadas

- **Uso no celular, como app.** A v1 é um PWA instalado na tela inicial do iPhone (abre em tela cheia, sem barra do navegador, funciona offline). Não há foco em uso no computador por enquanto.
- **Pagamento de fatura** é um lançamento `transferencia` que sai da conta corrente (`contaPagamentoId` do cartão) na data de vencimento. Reduz o saldo da conta, mas é neutro no orçamento (as compras já foram contadas).
- **Contas fixas na data:** quando chega o dia de uma recorrência de saída, o valor já é descontado do saldo projetado da conta corrente, mesmo antes de ser marcado como pago. Um toque marca o lançamento como `realizado` (o mesmo lançamento muda de status, não cria outro).
- **Tema claro é o padrão**; escuro opcional, com troca nas Configurações.
- **Barra inferior:** Hoje · Saldos · (+) · Totais · Mais (substitui Home · Lançamentos · Previsão · Mais).
- **Saldo projetado (tela Saldos):** parte do saldo de cada conta em `dataSaldoInicial` e soma, dia a dia, todos os lançamentos da conta (pagos ou previstos) **e as faturas dos cartões no dia do vencimento** (o que ainda não foi pago sai da `contaPagamentoId`). Entradas **certas e prováveis** entram (é a previsão da conta, como o cenário base da 5.8); as "talvez" (`possivel`) aparecem na grade e num valor à parte. O "livre para gastar hoje" (5.1) continua usando só o garantido. No topo da grade, a conta do mês: início + entradas − saídas (com faturas e economias) = fim. Para abrir um mês futuro, o app gera antes os fixos de todos os meses do meio.
- **Cartão:** a compra (à vista ou parcelada) cai sozinha na fatura certa pelo dia de fechamento; cada parcela vai para a fatura do seu mês. A fatura não é um lançamento guardado: é a soma das compras daquela `faturaRef` menos os pagamentos. "Marcar como paga" cria uma `transferencia` da conta de pagamento (com `cartaoId` e `faturaRef`). A fatura que já estava aberta antes do app é informada no cadastro do cartão e vira um lançamento com `saldoAnterior: true` (não é gasto do mês).
- **Linhas do dia em Saldos:** Entradas · Fixos (contas que se repetem, na conta) · Dia a dia (gastos na conta não fixos) · Economia (guardado, avulso ou repetido) · Cartão (fatura no vencimento; compras do dia em letra pequena). Mudança do dia = Entradas − Fixos − Dia a dia − Economia − Cartão.
- **Cores do saldo:** vermelho = negativo; amarelo = o saldo do dia não cobre o que ainda vai sair da conta até o fim do mês; verde = cobre.
- **Fixos:** os previstos de cada mês são criados quando o mês é aberto. No primeiro mês, fixos com dia anterior ao início do uso entram como já pagos. Editar um fixo refaz os previstos ainda não pagos deste mês em diante; excluir apaga esses previstos e mantém o histórico pago.
- **Lançamento futuro ou entrada incerta** é salvo como `previsto` por padrão; o usuário pode marcar "já foi pago" / "já caiu".
- **Repetições** (pedido do usuário: comissão que cai toda semana): qualquer lançamento pode repetir semanal, quinzenal ou mensal, sem fim ou por N vezes. Por baixo é uma `Recorrencia` com `fim`. Aparecem em Configurações › Fixos e repetições. Numa entrada repetida, a primeira vez tem a certeza escolhida e **as próximas usam a certeza de costume da fonte** (comissão = provável), para não inflar o futuro.
- **Entrada:** o formulário pergunta "De onde veio" (fonte), "Já caiu na conta?" e, se ainda vai cair, "É certo que cai?" (Certo / Provável / Talvez). No lançamento rápido, entrada sem verbo com data de hoje ou passada conta como já caiu.
- **Botão +:** abre a escolha do tipo — **Entrada, Saída (na conta), Cartão (compra no crédito), Fixo, Economia** — e, embaixo, o campo de lançamento rápido.
- **Economia:** é uma `transferencia` da conta para uma meta (`destino: { tipo: 'meta' }`); a "Reserva de emergência" é criada sozinha. Sai do saldo da conta e pode repetir.
- **Excluir:** botão sempre visível na edição. Parcelado: só esta / esta e as próximas / todas. Repetição: só esta vez (a data vira `excecoes` da recorrência e não volta) / esta e as próximas (a recorrência ganha `fim`) / todas. Pagamento de fatura e economia não viram gasto ao editar: só dá para ver e excluir.
- **Tela Cartões (Fase 4 adiantada):** por cartão, fatura atual (aberta/fechada/paga) com marcar como paga, compras de cada fatura (tocar para corrigir/excluir), próximas faturas, limite usado (o que ainda não foi pago, inclusive parcelas futuras), disponível e melhor dia de compra.
- **Livre por dia (5.1) — dinheiro de partida:** além das entradas garantidas do mês, entra o que já estava na conta no começo do mês: no primeiro mês de uso, o saldo informado; nos seguintes, a sobra do mês anterior se `destinoSobraMes = 'proximoMes'` (se for `'reserva'`, só entra se for negativa, e a tela Hoje sugere guardar a sobra). Menos a fatura que já estava aberta antes do app, se vence no mês. Pagamento de fatura e `saldoAnterior` são neutros; parcelas contam pela competência; economia conta como aporte. A tela mostra "Como é calculado" com cada linha.
- **Alerta de caixa (5.2):** de hoje ao fim do mês, contando só entradas garantidas; se o saldo das contas ficar negativo, mostra o primeiro dia e o pior valor que vai faltar.
- **Divisão de entrada (5.7):** ao lançar entrada garantida que já caiu, abre a sugestão: primeiro cobre o que falta dos fixos e faturas até o fim do mês (descontando o que já havia na conta), o resto pelos percentuais. Botão "Guardar R$ X" cria a economia na reserva (valor editável).
- **Tela Hoje:** livre para gastar hoje + ainda posso hoje (e "se as prováveis caírem"), alerta de caixa, lançamento rápido, **Chegando** (fixos, entradas e faturas dos próximos 10 dias e atrasados, com Pagar/Caiu), **Suas contas** (saldo hoje por conta e previsto no fim do mês), este mês (entrou/gastou/falta pagar), cartões, reserva.
- **Totais:** resultado do mês (entrou − gastou − guardou), entrou, custo de vida (fixos + dia a dia + parcelas, pela competência), economizado % e por mês no ano, gasto médio por dia (no primeiro mês, a partir do início do uso) vs livre hoje.
- **Limites (5.9):** ficam na própria categoria (`limiteMensal`). Tela Mais › Limites por categoria (barra por categoria, "ainda pode gastar" / "passou R$ X"). Antes de salvar um gasto (formulário ou lançamento rápido) que deixa a categoria em ≥ 80% ou acima do limite no mês da compra, aparece o aviso com "Voltar" / "Continuar". Parcelado conta só a parcela do mês. Ao editar, só avisa de novo se o valor aumentou ou a categoria mudou.
- **Reserva (5.4):** saldo = aportes − retiradas na meta "Reserva de emergência". Alvo = custo fixo mensal × meses desejados. Mostra "X de Y meses", quanto falta e o fôlego (contas garantidas + reserva ÷ custo fixo). Botões Guardar / Usar ("usar" é uma `transferencia` com `retirada: true`, que volta para a conta).
- **Metas (5.5):** nome, valor, prazo opcional e quanto já tinha. Mostra progresso, "guarde R$ X por mês" e status (no ritmo / atrasada / adiantada / concluída, com folga de 5% do alvo).
- **Investimentos:** saldo = última atualização manual + aportes − resgates depois dela. Total, divisão por tipo, atualizar saldo, aportar, resgatar. A Economia do botão + também guarda em investimento.
- **Tela Hoje simplificada:** no topo, a situação **Tranquilo / Atenção / Aperto** com o motivo em uma frase (conta negativa, mês não fecha, alerta de caixa, passou do livre de hoje, categoria acima do limite) + livre para gastar hoje. Depois: lançamento rápido, Chegando, Limites (só os perto/acima) e um único cartão **Visão geral** (na conta hoje, previsto no fim do mês, falta pagar, próxima fatura, reserva em meses, próximos 12 meses).
- **Saldos compacto:** por padrão mostra só as linhas com valor ("Só com valor"); o botão mostra todas as linhas.
- **Repetições já lançadas para 12 meses:** ao abrir o app (e ao criar/editar uma repetição), os fixos e repetições de todos os meses desde o início do uso até 12 meses à frente já ficam gerados, para aparecerem em qualquer tela.
- **Precisa entrar para os fixos (5.6):** para perfis com comissão, a Visão geral da tela Hoje mostra quanto precisa entrar por mês (fixos − salário) e por semana (× 12 ÷ 52). Não é meta de vendas.
- **Livre no primeiro mês:** lançamentos com data anterior ao início do uso não entram no livre por dia (o saldo informado já os considera). "Na conta hoje" conta só o garantido.
- **Referência visual:** o usuário enviou prints de um app de finanças que gosta (grade de saldos dia a dia, totais do mês, economizado). Serve de inspiração, não de cópia: a ideia é ser mais visual e mais simples.

## 9. Fora da v1 (já previsto na arquitetura)

- Login e sincronização entre celular e PC (Supabase)
- Bot de lançamento por Telegram/WhatsApp (reaproveita o parser)
- Leitura de notificação do banco (Android, app nativo)
- Open Finance
- Multiusuário / versão para outras pessoas
