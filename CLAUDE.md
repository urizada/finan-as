# App de Finanças Pessoais — Especificação v1

> Este arquivo é a fonte da verdade do projeto. Leia inteiro antes de qualquer código.
> Construa **uma fase por vez**, na ordem da seção 8. Ao fim de cada fase, pare, me mostre o que foi feito e espere eu aprovar antes de seguir.

## 1. Visão

App de organização financeira pessoal, **mobile-first**, que responde três perguntas:
1. **Quanto posso gastar hoje?**
2. **Pra onde está indo meu dinheiro?**
3. **Como vai estar minha situação daqui a 3, 6 e 12 meses?**

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
}

Conta {                              // onde o dinheiro fica parado e disponível
  id; nome; tipo: 'corrente' | 'carteira';
  saldoInicial: Centavos;
}

Categoria {
  id; nome; tipo: 'entrada' | 'saida'; icone; cor;
  palavrasChave: string[];           // usadas pelo lançamento rápido
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
  parcela?: { numero: number; total: number; grupoId: string };
  destino?: { tipo: 'meta' | 'investimento'; id };  // para transferências/aportes
}

Recorrencia {                        // fixos, assinaturas, salário
  id; modelo: Partial<Lancamento>;
  diaDoMes: number; ativa: boolean; fim?: string;
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
  saldoAtual: Centavos;              // soma dos aportes
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
se a fonte tiver taxaComissao: producaoNecessaria = necessarioNoMes ÷ taxaComissao
   ex.: R$ 3.500 ÷ 0,035 = R$ 100.000 de produção
```

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
2. **Saldos** — grade do mês dia a dia (inspirada na referência): uma linha por dia, uma coluna que alterna entre entradas / saídas / cartão / fixos, e o **saldo projetado da conta** em cada dia (já descontando fixos e fatura nas datas). Cor do saldo: verde = tranquilo, amarelo = apertado, vermelho = negativo. Tocar no dia abre os lançamentos dele.
2b. **Lançamentos** — lista por dia, filtros (mês, categoria, cartão, tipo), editar/excluir (acesso pelo dia em Saldos e pelo Mais)
2c. **Totais** — números do mês (entrou − saiu, custo de vida, gasto diário médio vs. livre por dia), **economizado** (% guardado por mês e no ano) e a **Previsão** (tela 7)
3. **Para onde foi** — gastos por categoria (gráfico), fixo vs variável, comparação com meses anteriores
4. **Cartões** — faturas atual e futuras, parcelas, limite, melhor dia de compra
5. **Reserva e metas** — progresso, aporte necessário, status, botão "aportar"
6. **Investimentos** — total da carteira, distribuição por tipo, evolução, atualizar saldo
7. **Previsão** — gráfico de 12 meses com os 3 cenários + ponto de equilíbrio
8. **Configurações** — perfil de renda, contas, cartões, categorias, fontes de renda, recorrências, percentuais de divisão, backup (exportar/importar JSON)

Navegação: barra inferior com **Hoje · Saldos · (+) · Totais · Mais**. O **+** central abre o lançamento rápido em 1 toque. Mais: Lançamentos, Para onde foi, Cartões, Reserva e metas, Investimentos, Configurações.

**Onboarding (primeira abertura):** perfil de renda → contas e saldo atual → fontes de renda → fixos → cartões → meses de reserva desejados. Os padrões mudam conforme o perfil escolhido.

## 8. Fases de construção

Cada fase termina com o app rodando e os testes passando.

- **Fase 0 — Base:** projeto Vite + TS + Tailwind + PWA, camada `repositorio`, schema Dexie, navegação e tema.
- **Fase 1 — Cadastros:** onboarding + Configurações (contas, categorias com palavras-chave padrão, fontes de renda, cartões, recorrências).
- **Fase 2 — Lançamentos e Saldos:** formulário manual, lista, editar/excluir, geração automática das recorrências do mês, marcar fixo como pago, **grade de Saldos** com saldo projetado por dia.
- **Fase 3 — Lançamento rápido:** parser da seção 6 + pré-visualização + aprendizado de palavras-chave. Testes com todos os exemplos da tabela.
- **Fase 4 — Cartões:** cálculo de fatura, parcelamento, tela de cartões.
- **Fase 5 — Hoje, Totais e Livre por dia:** cálculos 5.1, 5.2 e 5.7 + tela Hoje completa + Totais do mês e economizado.
- **Fase 6 — Reserva, metas e investimentos:** cálculos 5.4 e 5.5, snapshots, telas.
- **Fase 7 — Análise e previsão:** "Para onde foi" + cálculos 5.6 e 5.8 + gráficos.
- **Fase 8 — Acabamento:** backup JSON, estados vazios, revisão visual mobile, deploy na Vercel e instruções para instalar no celular.

## 8.1 Decisões tomadas

- **Uso no celular, como app.** A v1 é um PWA instalado na tela inicial do iPhone (abre em tela cheia, sem barra do navegador, funciona offline). Não há foco em uso no computador por enquanto.
- **Pagamento de fatura** é um lançamento `transferencia` que sai da conta corrente (`contaPagamentoId` do cartão) na data de vencimento. Reduz o saldo da conta, mas é neutro no orçamento (as compras já foram contadas).
- **Contas fixas na data:** quando chega o dia de uma recorrência de saída, o valor já é descontado do saldo projetado da conta corrente, mesmo antes de ser marcado como pago. Um toque marca o lançamento como `realizado` (o mesmo lançamento muda de status, não cria outro).
- **Tema claro é o padrão**; escuro opcional, com troca nas Configurações.
- **Barra inferior:** Hoje · Saldos · (+) · Totais · Mais (substitui Home · Lançamentos · Previsão · Mais).
- **Referência visual:** o usuário enviou prints de um app de finanças que gosta (grade de saldos dia a dia, totais do mês, economizado). Serve de inspiração, não de cópia: a ideia é ser mais visual e mais simples.

## 9. Fora da v1 (já previsto na arquitetura)

- Login e sincronização entre celular e PC (Supabase)
- Bot de lançamento por Telegram/WhatsApp (reaproveita o parser)
- Leitura de notificação do banco (Android, app nativo)
- Open Finance
- Multiusuário / versão para outras pessoas
