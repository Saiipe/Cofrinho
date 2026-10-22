import type { Language } from '@/i18n';

/**
 * Release history shown in "Novidades" (and mirrored in CHANGELOG.md).
 * Versioning: first number = major features; second number = fixes, improvements and small features.
 */

export type ChangeKind = 'feature' | 'improvement' | 'fix';

type Text = Record<Language, string>;

export interface Release {
  version: string;
  date: string;
  title: Text;
  changes: { kind: ChangeKind; text: Text }[];
}

export const RELEASES: Release[] = [
  {
    version: '5.5.0',
    date: '2026-10-22',
    title: { 'pt-BR': 'Resumo nos gráficos, investimentos e cadastros prontos', en: 'Chart summary, investments and ready-made defaults' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Nova aba "Resumo" em Gráficos com receitas × despesas, saldo e taxa de economia, filtro por Semana, Mês, Ano e Período personalizado (em modal) e visão de calendário integrado na evolução.', en: 'New "Summary" tab in Charts with income vs. expenses, balance and savings rate, filter by Week, Month, Year and custom Period (in a modal) and an inline calendar view in the trend chart.' } },
      { kind: 'feature', text: { 'pt-BR': 'Contas, categorias, subcategorias e tags já vêm pré-cadastradas (incluindo Reserva de emergência, Investimentos, Vale-Refeição, A receber e A pagar), com guia explicativo na tela de Contas.', en: 'Accounts, categories, subcategories and tags come pre-populated (including Emergency fund, Investments, Meal voucher, Receivable and Payable), with an explanatory guide on the Accounts screen.' } },
      { kind: 'feature', text: { 'pt-BR': 'Simulador de rendimento (CDI, 1% a.m., Poupança) e atalhos rápidos de Aportar, Resgatar e Lançar rendimento nas contas de investimento, além de atalho de Metas na tela Início.', en: 'Yield simulator (CDI, 1%/mo, Savings) and quick Deposit, Redeem and Record yield actions on investment accounts, plus a Goals strip on the Home screen.' } },
      { kind: 'fix', text: { 'pt-BR': 'Textos completos nas configurações sem corte por reticências, balão ao segurar categorias, subcategorias e tipos de conta, e correção do espaçamento entre o topo e os cards em todas as telas.', en: 'Full descriptions in settings without ellipsis truncation, long-press tooltips on categories, subcategories and account types, and fixed spacing between the top bar and cards across all screens.' } },
    ],
  },
  {
    version: '5.4.0',
    date: '2026-10-21',
    title: { 'pt-BR': 'Sons e dicas nos ícones', en: 'Sounds and icon tips' },
    changes: [
      { kind: 'fix', text: { 'pt-BR': 'Tocar e segurar um ícone voltou a mostrar o balão com o nome: o Android assumia o toque antes do balão aparecer. O balão também fica 2 segundos na tela depois de soltar o dedo.', en: 'Touching and holding an icon shows its name again: Android took over the touch before the tip appeared. The tip also stays 2 seconds after you lift your finger.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Sons em todo o app: botões, abas, chaves liga/desliga, menu de baixo, janelas que abrem e fecham, fatias dos gráficos, salvar, apagar, erros, desbloqueio e meta alcançada.', en: 'Sounds across the app: buttons, tabs, switches, the bottom menu, sheets opening and closing, chart slices, saving, deleting, errors, unlocking and reaching a goal.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Sons configuráveis em Configurações › Sons: liga/desliga geral, volume (baixo, médio, alto) e quais sons tocar — botões, teclado, abas e chaves, menu e janelas, dicas, salvar, moedas e metas, apagar e erros —, cada um com ▶ para ouvir.', en: 'Configurable sounds in Settings › Sounds: on/off, volume (low, medium, high) and which sounds play — buttons, keypad, tabs and switches, menu and sheets, tips, saving, coins and goals, deleting and errors — each with ▶ to hear it.' } },
    ],
  },
  {
    version: '5.3.0',
    date: '2026-10-21',
    title: { 'pt-BR': 'Cadastro mais claro', en: 'Clearer forms' },
    changes: [
      { kind: 'improvement', text: { 'pt-BR': 'Cadastro de conta personalizado para cada tipo (cartão, conta, carteira, investimento, a receber, a pagar), com explicações e as opções raras em "Mais opções".', en: 'Account form tailored to each type (card, bank, wallet, investment, receivable, payable), with explanations and rare options under "More options".' } },
      { kind: 'feature', text: { 'pt-BR': 'Ao cadastrar um cartão, lance as compras que já estão nele: parceladas (só as parcelas que faltam) e o valor da fatura. As compras aparecem nas suas despesas e nas faturas certas.', en: 'When adding a card, record what is already on it: installments (only the ones left) and the invoice amount. Purchases show up in your expenses and in the right invoices.' } },
      { kind: 'improvement', text: { 'pt-BR': 'No cadastro de despesa, "Pago com" separa cartões e contas e mostra o limite disponível do cartão.', en: 'In the expense form, "Paid with" separates cards from accounts and shows the available card limit.' } },
      { kind: 'fix', text: { 'pt-BR': 'Repetir, Parcelas, Tags, Observações e Anexos viraram uma barra de botões fixa: nada mais sai da tela no celular.', en: 'Repeat, Installments, Tags, Details and Attachments became a fixed button bar: nothing goes off screen on phones anymore.' } },
    ],
  },
  {
    version: '5.2.0',
    date: '2026-10-21',
    title: { 'pt-BR': 'Cadastro pelo widget', en: 'Add from the widget' },
    changes: [
      { kind: 'improvement', text: { 'pt-BR': 'Widget "Cadastro rápido" (3×2, 6 blocos) com Despesa, Receita e as 3 categorias que você mais usa.', en: '"Quick entry" widget (3×2, 6 cells) with Expense, Income and your 3 most used categories.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Os botões dos widgets abrem uma mini tela por cima da tela inicial: valor, categoria e conta, sem abrir o app. Ao salvar, ela fecha e o widget se atualiza.', en: 'Widget buttons open a mini screen over the home screen: amount, category and account, without opening the app. It closes after saving and the widget refreshes.' } },
      { kind: 'improvement', text: { 'pt-BR': '"Mais opções no app" leva o que você digitou para o cadastro completo (tags, anexos, parcelas).', en: '"More options in the app" carries what you typed to the full form (tags, attachments, installments).' } },
    ],
  },
  {
    version: '5.1.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Novidades da atualização', en: 'Update notes' },
    changes: [
      { kind: 'improvement', text: { 'pt-BR': 'Ao abrir uma versão nova, o app mostra o que mudou desde a versão que você usava.', en: 'When you open a new version, the app shows what changed since the version you were using.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Histórico completo de versões em Perfil › Sobre o app › Novidades.', en: "Full version history in Profile › About › What's new." } },
    ],
  },
  {
    version: '5.0.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Widgets', en: 'Widgets' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Widget "Lançamento rápido" com botões de despesa e receita na tela inicial do celular.', en: '"Quick add" widget with expense and income buttons on the phone home screen.' } },
      { kind: 'feature', text: { 'pt-BR': 'Widget "Resumo do mês" com gastos, receitas e saldo, além dos botões.', en: '"Month summary" widget with spending, income and balance, plus the buttons.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Os widgets escondem os valores quando "Ocultar valores" ou o bloqueio estão ativos.', en: 'Widgets hide amounts when "Hide amounts" or the app lock is on.' } },
    ],
  },
  {
    version: '4.0.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Metas', en: 'Goals' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Metas de economia com valor, data, ícone e cor: guarde e retire dinheiro e acompanhe o progresso.', en: 'Savings goals with amount, date, icon and color: put money in or take it out and follow the progress.' } },
      { kind: 'feature', text: { 'pt-BR': 'Quanto guardar por mês para chegar na data e previsão de quando a meta será alcançada.', en: 'How much to save per month to make the date, and when you will reach the goal at your pace.' } },
      { kind: 'feature', text: { 'pt-BR': 'Metas alcançadas ganham comemoração e podem ser arquivadas.', en: 'Reached goals are celebrated and can be archived.' } },
    ],
  },
  {
    version: '3.0.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Cartões de crédito', en: 'Credit cards' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Lista oficial de bancos do Banco Central (469 instituições, com logos) para escolher o banco do cartão ou da conta.', en: 'Official Banco Central bank list (469 institutions, with logos) to pick the bank of a card or account.' } },
      { kind: 'feature', text: { 'pt-BR': 'Cartões com limite, dia de fechamento e de vencimento: limite usado e disponível, faturas por mês e status.', en: 'Cards with limit, closing and due days: used and available limit, invoices by month and their status.' } },
      { kind: 'feature', text: { 'pt-BR': 'Compras parceladas (até 48x), com cada parcela no seu mês e aviso de em qual fatura a compra entra.', en: 'Installment purchases (up to 48), each installment in its month, showing which invoice a purchase goes to.' } },
      { kind: 'feature', text: { 'pt-BR': '"Pagar fatura" já preenche a transferência com o valor em aberto.', en: '"Pay invoice" pre-fills the transfer with the amount due.' } },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Tags, observações e anexos', en: 'Tags, details and attachments' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Tags nos lançamentos: crie na hora, com cor, e filtre na busca.', en: 'Tags on records: create them on the spot, with a color, and filter by them in search.' } },
      { kind: 'feature', text: { 'pt-BR': 'Campo "Observações" para textos longos, além da descrição curta.', en: '"Details" field for longer notes, besides the short description.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Anexos à vista no cadastro: tire foto do recibo na hora ou escolha da galeria.', en: 'Attachments right in the form: take a receipt photo or pick one from the gallery.' } },
      { kind: 'improvement', text: { 'pt-BR': 'Tags e observações também saem na exportação (Excel, CSV, JSON).', en: 'Tags and details are included in exports (Excel, CSV, JSON).' } },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Repetir no cadastro', en: 'Repeat while adding' },
    changes: [
      { kind: 'feature', text: { 'pt-BR': 'Botão "Repetir" no cadastro de despesa, receita e transferência.', en: '"Repeat" button when adding an expense, income or transfer.' } },
      { kind: 'fix', text: { 'pt-BR': 'O recorrente aparece na lista assim que é cadastrado.', en: 'A new recurring record shows up in the list right away.' } },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Gráfico de pizza', en: 'Pie chart' },
    changes: [{ kind: 'improvement', text: { 'pt-BR': 'Gráfico de pizza por categoria na aba Gráficos.', en: 'Pie chart by category in the Charts tab.' } }],
  },
  {
    version: '1.4.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Dicas nos ícones', en: 'Icon tooltips' },
    changes: [{ kind: 'improvement', text: { 'pt-BR': 'Toque e segurar um ícone para ver o que ele faz.', en: 'Touch and hold an icon to see what it does.' } }],
  },
  {
    version: '1.3.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Atalhos na tela do celular', en: 'Home screen shortcuts' },
    changes: [
      { kind: 'fix', text: { 'pt-BR': 'Criar atalho agora coloca um ícone de verdade na tela inicial do celular (Perfil › Widgets e atalhos).', en: 'Adding a shortcut now places a real icon on the phone home screen (Profile › Widgets and shortcuts).' } },
      { kind: 'improvement', text: { 'pt-BR': 'Toque e segure o ícone do Cofrinho para Nova despesa, Nova receita e Buscar.', en: 'Touch and hold the Cofrinho icon for New expense, New income and Search.' } },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Confirmar saída', en: 'Confirm before leaving' },
    changes: [{ kind: 'fix', text: { 'pt-BR': 'O botão voltar na tela Início pergunta antes de sair do app.', en: 'The back button on Home asks before leaving the app.' } }],
  },
  {
    version: '1.1.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Voltar no cadastro', en: 'Back in the form' },
    changes: [
      { kind: 'fix', text: { 'pt-BR': 'No cadastro, o voltar primeiro esconde o teclado de valores em vez de fechar a tela.', en: 'In the form, back first hides the amount keypad instead of closing the screen.' } },
      { kind: 'improvement', text: { 'pt-BR': 'O app pergunta antes de descartar um lançamento preenchido.', en: 'The app asks before discarding a filled-in record.' } },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-20',
    title: { 'pt-BR': 'Primeira versão', en: 'First release' },
    changes: [{ kind: 'feature', text: { 'pt-BR': 'Despesas, receitas, contas, orçamentos, recorrentes, gráficos, relatórios, livro dividido, backup e jardim da sorte.', en: 'Expenses, income, accounts, budgets, recurring records, charts, reports, split books, backup and the lucky garden.' } }],
  },
];

export const PLANNED: { version: string; text: Text }[] = [
  { version: '6.0', text: { 'pt-BR': 'Investimentos com regra de rendimento e projeção no tempo.', en: 'Investments with a yield rule and projections over time.' } },
  { version: '7.0', text: { 'pt-BR': 'Assistente de IA com a API do Gemini (camada gratuita, com limite de uso).', en: 'AI assistant with the Gemini API (free tier, with usage limits).' } },
  { version: '7.1', text: { 'pt-BR': 'Desafios simples sugeridos pela IA (ex.: 10 dias sem delivery).', en: 'Simple AI-suggested challenges (e.g. 10 days without delivery).' } },
  { version: '8.0', text: { 'pt-BR': 'Backup e restauração direto no Google Drive.', en: 'Backup and restore straight to Google Drive.' } },
];

/** Numeric comparison of `major.minor.patch` versions. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Releases newer than `seen`, newest first, up to `current`. Installs from before 5.1 never
 * recorded a version: they come from the first release.
 */
export function releasesSince(seen: string | null, current: string): Release[] {
  const from = seen ?? '1.0.0';
  return RELEASES.filter((r) => compareVersions(r.version, from) > 0 && compareVersions(r.version, current) <= 0);
}
