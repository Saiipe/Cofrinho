import type { AccountType, CategoryKind } from './types';

export interface DefaultCategory {
  key: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  /** Lowercase, accent-free words (pt/en/es) used by quick entry to recognize the category. */
  keywords: string[];
  children?: Omit<DefaultCategory, 'kind' | 'color' | 'children'>[];
}

/** Category circle colors: saturated enough for a white glyph in light and dark themes. */
export const CATEGORY_COLORS = [
  '#e11d48',
  '#dc2626',
  '#ea580c',
  '#d97706',
  '#ca8a04',
  '#65a30d',
  '#16a34a',
  '#059669',
  '#0d9488',
  '#0891b2',
  '#0284c7',
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#9333ea',
  '#c026d3',
  '#db2777',
  '#57534e',
  '#475569',
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: 'food',
    kind: 'expense',
    icon: 'utensils',
    color: '#ea580c',
    keywords: ['comida', 'alimentacao', 'food', 'comer'],
    children: [
      { key: 'groceries', icon: 'shopping-basket', keywords: ['mercado', 'supermercado', 'feira', 'hortifruti', 'atacadao', 'acougue', 'grocery', 'groceries', 'supermarket', 'supermercado'] },
      { key: 'restaurant', icon: 'utensils-crossed', keywords: ['restaurante', 'almoco', 'jantar', 'pizzaria', 'churrascaria', 'lunch', 'dinner', 'restaurant', 'cena', 'comida fora'] },
      { key: 'delivery', icon: 'package', keywords: ['ifood', 'rappi', 'delivery', 'uber eats', 'entrega'] },
      { key: 'snacks', icon: 'coffee', keywords: ['lanche', 'cafe', 'padaria', 'sorvete', 'doce', 'pastel', 'salgado', 'coffee', 'snack', 'bakery', 'merienda'] },
    ],
  },
  {
    key: 'transport',
    kind: 'expense',
    icon: 'bus',
    color: '#0284c7',
    keywords: ['transporte', 'transport', 'locomocao'],
    children: [
      { key: 'fuel', icon: 'fuel', keywords: ['gasolina', 'combustivel', 'posto', 'etanol', 'diesel', 'abastecer', 'fuel', 'gas station', 'nafta'] },
      { key: 'public_transport', icon: 'train-front', keywords: ['onibus', 'metro', 'trem', 'bilhete', 'passagem de onibus', 'bus', 'subway', 'train', 'colectivo'] },
      { key: 'ride', icon: 'car-taxi-front', keywords: ['uber', '99', 'taxi', 'cabify', 'lyft', 'corrida'] },
      { key: 'parking', icon: 'square-parking', keywords: ['estacionamento', 'pedagio', 'zona azul', 'parking', 'toll', 'peaje'] },
      { key: 'car_maintenance', icon: 'wrench', keywords: ['oficina', 'mecanico', 'pneu', 'revisao', 'lava jato', 'lavagem', 'troca de oleo', 'seguro do carro', 'ipva'] },
    ],
  },
  {
    key: 'housing',
    kind: 'expense',
    icon: 'house',
    color: '#7c3aed',
    keywords: ['casa', 'moradia', 'housing', 'home', 'vivienda'],
    children: [
      { key: 'rent', icon: 'key', keywords: ['aluguel', 'condominio', 'rent', 'alquiler', 'financiamento'] },
      { key: 'utilities', icon: 'lightbulb', keywords: ['luz', 'agua', 'gas', 'energia', 'conta de luz', 'conta de agua', 'electricity', 'water bill', 'utilities'] },
      { key: 'internet', icon: 'wifi', keywords: ['internet', 'wifi', 'fibra', 'tv a cabo', 'banda larga'] },
      { key: 'home_maintenance', icon: 'hammer', keywords: ['reforma', 'encanador', 'eletricista', 'conserto', 'diarista', 'faxina', 'repair'] },
    ],
  },
  {
    key: 'shopping',
    kind: 'expense',
    icon: 'shopping-bag',
    color: '#db2777',
    keywords: ['compras', 'shopping', 'loja'],
    children: [
      { key: 'clothing', icon: 'shirt', keywords: ['roupa', 'roupas', 'camisa', 'calca', 'vestido', 'tenis', 'sapato', 'clothes', 'shoes', 'ropa'] },
      { key: 'electronics', icon: 'monitor-smartphone', keywords: ['eletronico', 'notebook', 'computador', 'fone', 'carregador', 'electronics'] },
      { key: 'home_goods', icon: 'sofa', keywords: ['movel', 'moveis', 'decoracao', 'utensilios', 'cama', 'furniture'] },
    ],
  },
  {
    key: 'health',
    kind: 'expense',
    icon: 'heart-pulse',
    color: '#dc2626',
    keywords: ['saude', 'health', 'salud'],
    children: [
      { key: 'pharmacy', icon: 'pill', keywords: ['farmacia', 'remedio', 'drogaria', 'medicamento', 'pharmacy', 'medicine'] },
      { key: 'doctor', icon: 'stethoscope', keywords: ['medico', 'consulta', 'exame', 'dentista', 'psicologo', 'terapia', 'doctor', 'dentist'] },
      { key: 'health_insurance', icon: 'shield-plus', keywords: ['plano de saude', 'convenio', 'seguro saude', 'health insurance'] },
    ],
  },
  {
    key: 'education',
    kind: 'expense',
    icon: 'graduation-cap',
    color: '#2563eb',
    keywords: ['educacao', 'estudo', 'education'],
    children: [
      { key: 'courses', icon: 'presentation', keywords: ['curso', 'aula', 'workshop', 'course', 'class'] },
      { key: 'books', icon: 'book-open', keywords: ['livro', 'livros', 'apostila', 'material escolar', 'book', 'libro'] },
      { key: 'tuition', icon: 'school', keywords: ['mensalidade', 'escola', 'faculdade', 'universidade', 'tuition', 'school'] },
    ],
  },
  {
    key: 'leisure',
    kind: 'expense',
    icon: 'ticket',
    color: '#9333ea',
    keywords: ['lazer', 'diversao', 'entretenimento', 'leisure', 'entertainment', 'ocio'],
    children: [
      { key: 'streaming', icon: 'tv', keywords: ['netflix', 'spotify', 'disney', 'prime video', 'hbo', 'max', 'youtube premium', 'assinatura', 'streaming', 'subscription'] },
      { key: 'outings', icon: 'popcorn', keywords: ['cinema', 'show', 'teatro', 'bar', 'balada', 'passeio', 'festa', 'ingresso', 'movie', 'concert'] },
      { key: 'games', icon: 'gamepad-2', keywords: ['jogo', 'jogos', 'steam', 'playstation', 'xbox', 'nintendo', 'game', 'games'] },
    ],
  },
  { key: 'phone', kind: 'expense', icon: 'smartphone', color: '#0891b2', keywords: ['celular', 'recarga', 'plano de celular', 'telefone', 'phone bill', 'claro', 'vivo', 'tim'] },
  { key: 'personal_care', kind: 'expense', icon: 'scissors', color: '#c026d3', keywords: ['cabeleireiro', 'barbeiro', 'salao', 'manicure', 'cosmetico', 'perfume', 'maquiagem', 'haircut', 'beauty'] },
  { key: 'sports', kind: 'expense', icon: 'dumbbell', color: '#059669', keywords: ['academia', 'gym', 'futebol', 'natacao', 'esporte', 'crossfit', 'pilates', 'yoga', 'gimnasio'] },
  { key: 'travel', kind: 'expense', icon: 'plane', color: '#0d9488', keywords: ['viagem', 'hotel', 'passagem', 'airbnb', 'voo', 'pousada', 'travel', 'flight', 'viaje'] },
  { key: 'pets', kind: 'expense', icon: 'paw-print', color: '#d97706', keywords: ['pet', 'racao', 'veterinario', 'petshop', 'banho e tosa', 'mascota'] },
  { key: 'kids', kind: 'expense', icon: 'baby', color: '#e11d48', keywords: ['filho', 'filhos', 'fralda', 'brinquedo', 'creche', 'baba', 'kids', 'toys'] },
  { key: 'gifts', kind: 'expense', icon: 'gift', color: '#ca8a04', keywords: ['presente', 'doacao', 'dizimo', 'caridade', 'gift', 'donation', 'regalo'] },
  { key: 'taxes', kind: 'expense', icon: 'landmark', color: '#475569', keywords: ['imposto', 'taxa', 'tarifa', 'iptu', 'multa', 'juros', 'anuidade', 'tax', 'fee', 'impuesto'] },
  { key: 'other_expense', kind: 'expense', icon: 'circle-ellipsis', color: '#57534e', keywords: ['outros', 'outro', 'other', 'otros'] },

  { key: 'salary', kind: 'income', icon: 'briefcase', color: '#16a34a', keywords: ['salario', 'pagamento', 'holerite', 'adiantamento', 'salary', 'paycheck', 'sueldo'] },
  { key: 'freelance', kind: 'income', icon: 'laptop', color: '#0d9488', keywords: ['freela', 'freelance', 'bico', 'servico prestado', 'trabalho extra'] },
  { key: 'investments', kind: 'income', icon: 'trending-up', color: '#2563eb', keywords: ['rendimento', 'dividendo', 'dividendos', 'juros recebidos', 'investimento', 'cdb', 'tesouro', 'dividend', 'interest'] },
  { key: 'bonus', kind: 'income', icon: 'award', color: '#ca8a04', keywords: ['bonus', 'premio', '13o', 'decimo terceiro', 'plr', 'ferias'] },
  { key: 'gifts_received', kind: 'income', icon: 'gift', color: '#db2777', keywords: ['ganhei de presente', 'presente recebido', 'mesada'] },
  { key: 'refunds', kind: 'income', icon: 'undo-2', color: '#0891b2', keywords: ['reembolso', 'estorno', 'devolucao', 'cashback', 'refund'] },
  { key: 'sales', kind: 'income', icon: 'store', color: '#ea580c', keywords: ['venda', 'vendas', 'vendi', 'sale', 'sold', 'venta'] },
  { key: 'other_income', kind: 'income', icon: 'coins', color: '#57534e', keywords: ['outra receita', 'other income'] },
];

export const ACCOUNT_TYPE_STYLE: Record<AccountType, { icon: string; color: string }> = {
  cash: { icon: 'banknote', color: '#16a34a' },
  debit: { icon: 'landmark', color: '#2563eb' },
  credit: { icon: 'credit-card', color: '#dc2626' },
  virtual: { icon: 'smartphone-nfc', color: '#7c3aed' },
  investment: { icon: 'trending-up', color: '#0d9488' },
  receivable: { icon: 'hand-coins', color: '#ca8a04' },
  payable: { icon: 'receipt-text', color: '#ea580c' },
};

export const BOOK_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#ca8a04', '#16a34a', '#475569'];

/** Words that flag a quick-entry sentence as income. */
export const INCOME_HINTS = ['recebi', 'ganhei', 'receita', 'entrada', 'renda', 'recebimento', 'received', 'earned', 'income', 'got paid', 'cobrei', 'recibi', 'gane', 'ingreso'];

export const NOTE_MAX = 60;

/** Longer free text ("Observações") of a record. */
export const DETAILS_MAX = 1000;

export const TAG_NAME_MAX = 24;
