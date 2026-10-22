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

export interface DefaultTag {
  key: string;
  color: string;
}

export interface DefaultAccount {
  key: string;
  type: AccountType;
  icon: string;
  color: string;
  isDefault?: boolean;
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

export const DEFAULT_TAGS: DefaultTag[] = [
  { key: 'essential', color: '#16a34a' },
  { key: 'non_essential', color: '#ea580c' },
  { key: 'fixed', color: '#2563eb' },
  { key: 'emergency', color: '#dc2626' },
  { key: 'trip', color: '#0d9488' },
  { key: 'work', color: '#4f46e5' },
  { key: 'family', color: '#db2777' },
  { key: 'home', color: '#7c3aed' },
  { key: 'reimbursable', color: '#0891b2' },
  { key: 'gift', color: '#ca8a04' },
];

export const DEFAULT_ACCOUNTS: DefaultAccount[] = [
  { key: 'checking', type: 'debit', icon: 'landmark', color: '#2563eb', isDefault: true },
  { key: 'wallet', type: 'cash', icon: 'banknote', color: '#16a34a' },
  { key: 'benefits', type: 'virtual', icon: 'smartphone-nfc', color: '#7c3aed' },
  { key: 'emergency_cdi', type: 'investment', icon: 'piggy-bank', color: '#0d9488' },
  { key: 'investments', type: 'investment', icon: 'trending-up', color: '#059669' },
  { key: 'receivable', type: 'receivable', icon: 'hand-coins', color: '#ca8a04' },
  { key: 'payable', type: 'payable', icon: 'receipt-text', color: '#ea580c' },
];

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    key: 'food',
    kind: 'expense',
    icon: 'utensils',
    color: '#ea580c',
    keywords: ['comida', 'alimentacao', 'food', 'comer'],
    children: [
      { key: 'groceries', icon: 'shopping-basket', keywords: ['mercado', 'supermercado', 'atacadao', 'assai', 'carrefour', 'grocery', 'groceries', 'supermarket'] },
      { key: 'restaurant', icon: 'utensils-crossed', keywords: ['restaurante', 'almoco', 'jantar', 'pizzaria', 'churrascaria', 'self service', 'rodizio', 'lunch', 'dinner', 'restaurant', 'cena', 'comida fora'] },
      { key: 'delivery', icon: 'package', keywords: ['ifood', 'rappi', 'delivery', 'uber eats', 'ze delivery', 'aiqfome', 'entrega'] },
      { key: 'snacks', icon: 'coffee', keywords: ['lanche', 'cafe', 'sorvete', 'doce', 'pastel', 'salgado', 'acai', 'hamburguer', 'coffee', 'snack', 'merienda'] },
      { key: 'bakery', icon: 'croissant', keywords: ['padaria', 'pao', 'confeitaria', 'bolo', 'bakery'] },
      { key: 'fair', icon: 'apple', keywords: ['feira', 'hortifruti', 'sacolao', 'acougue', 'peixaria', 'frutas', 'verduras', 'butcher'] },
      { key: 'drinks', icon: 'beer', keywords: ['bebida', 'bebidas', 'cerveja', 'vinho', 'refrigerante', 'suco', 'adega', 'drinks', 'beer', 'wine'] },
      { key: 'supplements', icon: 'milk', keywords: ['suplemento', 'whey', 'creatina', 'vitamina', 'supplement'] },
    ],
  },
  {
    key: 'transport',
    kind: 'expense',
    icon: 'bus',
    color: '#0284c7',
    keywords: ['transporte', 'transport', 'locomocao'],
    children: [
      { key: 'fuel', icon: 'fuel', keywords: ['gasolina', 'combustivel', 'posto', 'etanol', 'diesel', 'gnv', 'abastecer', 'fuel', 'gas station', 'nafta'] },
      { key: 'public_transport', icon: 'train-front', keywords: ['onibus', 'metro', 'trem', 'bilhete', 'passagem de onibus', 'bus', 'subway', 'train', 'colectivo'] },
      { key: 'ride', icon: 'car-taxi-front', keywords: ['uber', '99', 'taxi', 'cabify', 'indrive', 'lyft', 'corrida', 'mototaxi'] },
      { key: 'parking', icon: 'square-parking', keywords: ['estacionamento', 'pedagio', 'zona azul', 'sem parar', 'veloe', 'tag pedagio', 'parking', 'toll', 'peaje'] },
      { key: 'car_maintenance', icon: 'wrench', keywords: ['oficina', 'mecanico', 'pneu', 'revisao', 'troca de oleo', 'alinhamento', 'balanceamento', 'bateria', 'peca'] },
      { key: 'car_insurance', icon: 'shield', keywords: ['seguro do carro', 'seguro auto', 'ipva', 'licenciamento', 'detran', 'vistoria', 'car insurance'] },
      { key: 'car_wash', icon: 'droplets', keywords: ['lava jato', 'lava rapido', 'lavagem', 'polimento', 'higienizacao', 'car wash'] },
      { key: 'traffic_fine', icon: 'receipt', keywords: ['multa de transito', 'multa carro', 'infracao', 'traffic fine'] },
    ],
  },
  {
    key: 'housing',
    kind: 'expense',
    icon: 'house',
    color: '#7c3aed',
    keywords: ['casa', 'moradia', 'housing', 'home', 'vivienda'],
    children: [
      { key: 'rent', icon: 'key', keywords: ['aluguel', 'rent', 'alquiler', 'locacao'] },
      { key: 'condo', icon: 'building-2', keywords: ['condominio', 'taxa de condominio', 'sindico', 'condo'] },
      { key: 'utilities', icon: 'lightbulb', keywords: ['luz', 'agua', 'gas', 'energia', 'conta de luz', 'conta de agua', 'botijao', 'electricity', 'water bill', 'utilities'] },
      { key: 'internet', icon: 'wifi', keywords: ['internet', 'wifi', 'fibra', 'tv a cabo', 'banda larga'] },
      { key: 'home_maintenance', icon: 'hammer', keywords: ['reforma', 'encanador', 'eletricista', 'conserto', 'pedreiro', 'pintor', 'material de construcao', 'repair'] },
      { key: 'cleaning', icon: 'spray-can', keywords: ['diarista', 'faxina', 'limpeza', 'produtos de limpeza', 'cleaning'] },
      { key: 'laundry', icon: 'washing-machine', keywords: ['lavanderia', 'passadeira', 'laundry'] },
      { key: 'property_tax', icon: 'shield-plus', keywords: ['iptu', 'seguro residencial', 'seguro da casa', 'property tax'] },
    ],
  },
  {
    key: 'shopping',
    kind: 'expense',
    icon: 'shopping-bag',
    color: '#db2777',
    keywords: ['compras', 'shopping', 'loja'],
    children: [
      { key: 'clothing', icon: 'shirt', keywords: ['roupa', 'roupas', 'camisa', 'calca', 'vestido', 'tenis', 'sapato', 'calcado', 'blusa', 'jaqueta', 'clothes', 'shoes', 'ropa'] },
      { key: 'electronics', icon: 'monitor-smartphone', keywords: ['eletronico', 'notebook', 'computador', 'fone', 'carregador', 'cabo', 'mouse', 'teclado', 'tablet', 'electronics'] },
      { key: 'home_goods', icon: 'sofa', keywords: ['movel', 'moveis', 'decoracao', 'utensilios', 'cama', 'mesa', 'cortina', 'tapete', 'enxoval', 'furniture'] },
      { key: 'appliances', icon: 'plug', keywords: ['eletrodomestico', 'geladeira', 'fogao', 'microondas', 'airfryer', 'liquidificador', 'aspirador', 'appliance'] },
      { key: 'accessories', icon: 'watch', keywords: ['acessorio', 'relogio', 'oculos de sol', 'bolsa', 'carteira', 'joia', 'bijuteria', 'watch', 'jewelry'] },
      { key: 'online_shopping', icon: 'shopping-cart', keywords: ['shopee', 'mercado livre', 'amazon', 'shein', 'aliexpress', 'magalu', 'compra online'] },
      { key: 'stationery', icon: 'paperclip', keywords: ['papelaria', 'caderno', 'caneta', 'impressao', 'xerox', 'stationery'] },
    ],
  },
  {
    key: 'health',
    kind: 'expense',
    icon: 'heart-pulse',
    color: '#dc2626',
    keywords: ['saude', 'health', 'salud'],
    children: [
      { key: 'pharmacy', icon: 'pill', keywords: ['farmacia', 'remedio', 'drogaria', 'medicamento', 'antibiotico', 'pharmacy', 'medicine'] },
      { key: 'doctor', icon: 'stethoscope', keywords: ['medico', 'consulta', 'exame', 'laboratorio', 'checkup', 'doctor', 'medical'] },
      { key: 'dentist', icon: 'smile', keywords: ['dentista', 'odonto', 'aparelho ortodontico', 'clareamento', 'dentist'] },
      { key: 'therapy', icon: 'brain', keywords: ['psicologo', 'terapia', 'psiquiatra', 'fisioterapia', 'fonoaudiologo', 'nutricionista', 'therapy'] },
      { key: 'health_insurance', icon: 'shield-plus', keywords: ['plano de saude', 'convenio', 'unimed', 'amil', 'bradesco saude', 'sulamerica', 'health insurance'] },
      { key: 'eyecare', icon: 'glasses', keywords: ['otica', 'oculos de grau', 'lente de contato', 'oftalmologista', 'eyecare'] },
      { key: 'hospital', icon: 'hospital', keywords: ['hospital', 'pronto socorro', 'cirurgia', 'internacao', 'emergencia medica'] },
    ],
  },
  {
    key: 'education',
    kind: 'expense',
    icon: 'graduation-cap',
    color: '#2563eb',
    keywords: ['educacao', 'estudo', 'education'],
    children: [
      { key: 'courses', icon: 'presentation', keywords: ['curso', 'aula', 'workshop', 'mentoria', 'treinamento', 'udemy', 'alura', 'course', 'class'] },
      { key: 'books', icon: 'book-open', keywords: ['livro', 'livros', 'apostila', 'ebook', 'kindle', 'book', 'libro'] },
      { key: 'tuition', icon: 'school', keywords: ['mensalidade', 'escola', 'faculdade', 'universidade', 'pos graduacao', 'colegio', 'tuition', 'school'] },
      { key: 'languages', icon: 'languages', keywords: ['ingles', 'espanhol', 'idioma', 'aula de ingles', 'cultura inglesa', 'wizard', 'duolingo'] },
      { key: 'school_supplies', icon: 'backpack', keywords: ['material escolar', 'uniforme', 'mochila', 'school supplies'] },
      { key: 'certifications', icon: 'award', keywords: ['certificacao', 'prova', 'concurso', 'vestibular', 'enem', 'inscricao'] },
    ],
  },
  {
    key: 'leisure',
    kind: 'expense',
    icon: 'ticket',
    color: '#9333ea',
    keywords: ['lazer', 'diversao', 'entretenimento', 'leisure', 'entertainment', 'ocio'],
    children: [
      { key: 'streaming', icon: 'tv', keywords: ['netflix', 'spotify', 'disney', 'prime video', 'hbo', 'max', 'youtube premium', 'globoplay', 'apple tv', 'deezer', 'crunchyroll', 'assinatura', 'streaming', 'subscription'] },
      { key: 'outings', icon: 'popcorn', keywords: ['passeio', 'parque', 'museu', 'zoologico', 'boliche', 'outing'] },
      { key: 'cinema', icon: 'clapperboard', keywords: ['cinema', 'filme', 'teatro', 'ingresso cinema', 'movie', 'theater'] },
      { key: 'music_events', icon: 'music', keywords: ['show', 'festa', 'balada', 'festival', 'ingresso', 'concert', 'party'] },
      { key: 'bars', icon: 'wine', keywords: ['bar', 'barzinho', 'happy hour', 'pub', 'chopp'] },
      { key: 'games', icon: 'gamepad-2', keywords: ['jogo', 'jogos', 'steam', 'playstation', 'psn', 'xbox', 'game pass', 'nintendo', 'roblox', 'game', 'games'] },
      { key: 'hobbies', icon: 'palette', keywords: ['hobby', 'instrumento', 'pintura', 'artesanato', 'fotografia', 'colecao'] },
    ],
  },
  {
    key: 'phone',
    kind: 'expense',
    icon: 'smartphone',
    color: '#0891b2',
    keywords: ['celular', 'recarga', 'plano de celular', 'telefone', 'phone bill', 'claro', 'vivo', 'tim'],
    children: [
      { key: 'mobile_plan', icon: 'phone', keywords: ['conta de celular', 'recarga', 'chip', 'credito celular', 'claro', 'vivo', 'tim', 'oi'] },
      { key: 'apps_cloud', icon: 'cloud', keywords: ['icloud', 'google one', 'drive', 'chatgpt', 'app', 'aplicativo', 'play store', 'app store'] },
    ],
  },
  {
    key: 'personal_care',
    kind: 'expense',
    icon: 'scissors',
    color: '#c026d3',
    keywords: ['cuidados pessoais', 'beleza', 'estetica', 'personal care', 'beauty'],
    children: [
      { key: 'hair_barber', icon: 'scissors', keywords: ['cabeleireiro', 'barbeiro', 'barbearia', 'salao', 'corte de cabelo', 'escova', 'tintura', 'haircut', 'barber'] },
      { key: 'cosmetics', icon: 'sparkles', keywords: ['cosmetico', 'perfume', 'maquiagem', 'creme', 'skincare', 'protetor solar', 'boticario', 'natura', 'sephora'] },
      { key: 'nails_spa', icon: 'flower-2', keywords: ['manicure', 'pedicure', 'unha', 'depilacao', 'sobrancelha', 'massagem', 'estetica', 'spa'] },
      { key: 'hygiene', icon: 'bath', keywords: ['shampoo', 'sabonete', 'desodorante', 'pasta de dente', 'higiene'] },
    ],
  },
  {
    key: 'sports',
    kind: 'expense',
    icon: 'dumbbell',
    color: '#059669',
    keywords: ['esporte', 'esportes', 'atividade fisica', 'sports', 'fitness'],
    children: [
      { key: 'gym', icon: 'dumbbell', keywords: ['academia', 'gym', 'smartfit', 'crossfit', 'pilates', 'yoga', 'musculacao', 'personal trainer', 'gimnasio'] },
      { key: 'matches', icon: 'trophy', keywords: ['futebol', 'quadra', 'society', 'beach tennis', 'natacao', 'lutas', 'corrida', 'inscricao corrida'] },
      { key: 'sports_gear', icon: 'footprints', keywords: ['tenis de corrida', 'chuteira', 'bola', 'bicicleta', 'equipamento esportivo', 'decathlon'] },
    ],
  },
  {
    key: 'travel',
    kind: 'expense',
    icon: 'plane',
    color: '#0d9488',
    keywords: ['viagem', 'ferias', 'turismo', 'travel', 'viaje'],
    children: [
      { key: 'flights', icon: 'tickets-plane', keywords: ['passagem', 'passagem aerea', 'voo', 'aviao', 'latam', 'gol', 'azul', 'flight'] },
      { key: 'lodging', icon: 'hotel', keywords: ['hotel', 'pousada', 'airbnb', 'hostel', 'hospedagem', 'resort', 'booking'] },
      { key: 'tours', icon: 'compass', keywords: ['passeio turistico', 'excursao', 'ingresso parque', 'aluguel de carro', 'tour'] },
      { key: 'luggage_visa', icon: 'luggage', keywords: ['mala', 'bagagem', 'seguro viagem', 'passaporte', 'visto'] },
    ],
  },
  {
    key: 'pets',
    kind: 'expense',
    icon: 'paw-print',
    color: '#d97706',
    keywords: ['pet', 'pets', 'cachorro', 'gato', 'mascota'],
    children: [
      { key: 'pet_food', icon: 'bone', keywords: ['racao', 'petisco', 'areia de gato', 'sache', 'pet food'] },
      { key: 'vet', icon: 'syringe', keywords: ['veterinario', 'vacina pet', 'vermifugo', 'antipulgas', 'consulta pet', 'vet'] },
      { key: 'grooming', icon: 'paw-print', keywords: ['banho e tosa', 'petshop', 'coleira', 'brinquedo pet', 'cobasi', 'petz'] },
    ],
  },
  {
    key: 'kids',
    kind: 'expense',
    icon: 'baby',
    color: '#e11d48',
    keywords: ['filho', 'filhos', 'crianca', 'bebe', 'kids', 'baby'],
    children: [
      { key: 'diapers_baby', icon: 'baby', keywords: ['fralda', 'fraldas', 'lenco umedecido', 'leite em po', 'mamadeira', 'enxoval bebe'] },
      { key: 'toys', icon: 'puzzle', keywords: ['brinquedo', 'roupa infantil', 'passeio infantil', 'toys'] },
      { key: 'daycare', icon: 'heart', keywords: ['creche', 'baba', 'escolinha', 'mesada filho', 'daycare'] },
    ],
  },
  {
    key: 'gifts',
    kind: 'expense',
    icon: 'gift',
    color: '#ca8a04',
    keywords: ['presente', 'doacao', 'gift', 'donation', 'regalo'],
    children: [
      { key: 'birthday_gifts', icon: 'gift', keywords: ['presente de aniversario', 'presente de natal', 'dia das maes', 'dia dos pais', 'dia dos namorados', 'lembrancinha'] },
      { key: 'donations', icon: 'hand-heart', keywords: ['doacao', 'dizimo', 'oferta', 'caridade', 'ong', 'ajuda'] },
      { key: 'celebrations', icon: 'cake', keywords: ['festa de aniversario', 'comemoracao', 'casamento', 'cha de bebe', 'decoracao festa'] },
    ],
  },
  {
    key: 'work_business',
    kind: 'expense',
    icon: 'briefcase-business',
    color: '#16a34a',
    keywords: ['trabalho', 'profissional', 'empresa', 'negocio', 'work', 'business'],
    children: [
      { key: 'coworking_office', icon: 'building', keywords: ['coworking', 'escritorio', 'aluguel sala', 'equipamento de trabalho'] },
      { key: 'software_tools', icon: 'laptop', keywords: ['software', 'assinatura profissional', 'dominio', 'hospedagem site', 'ferramenta'] },
      { key: 'marketing', icon: 'flag', keywords: ['anuncio', 'trafego pago', 'divulgacao', 'cartao de visita', 'marketing'] },
    ],
  },
  {
    key: 'financial',
    kind: 'expense',
    icon: 'receipt-text',
    color: '#e11d48',
    keywords: ['divida', 'emprestimo', 'financiamento', 'loan', 'debt'],
    children: [
      { key: 'loan_payment', icon: 'hand-coins', keywords: ['emprestimo', 'parcela emprestimo', 'consignado', 'loan'] },
      { key: 'financing', icon: 'key', keywords: ['financiamento imobiliario', 'financiamento veiculo', 'parcela carro', 'parcela casa'] },
      { key: 'consortium', icon: 'piggy-bank', keywords: ['consorcio', 'lance consorcio'] },
    ],
  },
  {
    key: 'taxes',
    kind: 'expense',
    icon: 'landmark',
    color: '#475569',
    keywords: ['imposto', 'taxa', 'tarifa', 'tax', 'fee', 'impuesto'],
    children: [
      { key: 'bank_fees', icon: 'credit-card', keywords: ['anuidade', 'tarifa bancaria', 'iof', 'ted', 'manutencao de conta'] },
      { key: 'gov_taxes', icon: 'landmark', keywords: ['imposto de renda', 'irpf', 'darf', 'das', 'mei', 'inss', 'tributo'] },
      { key: 'interest_fines', icon: 'percent', keywords: ['juros', 'multa atraso', 'cheque especial', 'rotativo'] },
      { key: 'documents_notary', icon: 'file-text', keywords: ['cartorio', 'documento', 'segunda via', 'reconhecimento de firma', 'contador'] },
    ],
  },
  { key: 'other_expense', kind: 'expense', icon: 'circle-ellipsis', color: '#57534e', keywords: ['outros', 'outro', 'other', 'otros'] },

  {
    key: 'salary',
    kind: 'income',
    icon: 'briefcase',
    color: '#16a34a',
    keywords: ['salario', 'pagamento', 'holerite', 'salary', 'paycheck', 'sueldo'],
    children: [
      { key: 'monthly_salary', icon: 'briefcase', keywords: ['salario mensal', 'pagamento mensal', 'pro labore', 'remuneracao'] },
      { key: 'advance', icon: 'banknote', keywords: ['adiantamento', 'vale salarial', 'quinzena'] },
      { key: 'thirteenth', icon: 'calendar', keywords: ['13o', 'decimo terceiro', 'parcela 13'] },
      { key: 'vacation_pay', icon: 'tree-palm', keywords: ['ferias', 'abono de ferias', 'terco de ferias'] },
      { key: 'benefits', icon: 'wallet-cards', keywords: ['vale refeicao', 'vale alimentacao', 'auxilio home office', 'vr', 'va'] },
    ],
  },
  {
    key: 'freelance',
    kind: 'income',
    icon: 'laptop',
    color: '#0d9488',
    keywords: ['freela', 'freelance', 'bico', 'servico prestado', 'trabalho extra', 'autonomo'],
    children: [
      { key: 'projects', icon: 'laptop', keywords: ['projeto', 'freela', 'servico', 'job', 'cliente'] },
      { key: 'consulting', icon: 'presentation', keywords: ['consultoria', 'mentoria', 'aula particular', 'palestra', 'honorarios'] },
      { key: 'commissions', icon: 'badge-dollar-sign', keywords: ['comissao', 'indicacao', 'afiliado', 'gorjeta'] },
    ],
  },
  {
    key: 'investments',
    kind: 'income',
    icon: 'trending-up',
    color: '#2563eb',
    keywords: ['rendimento', 'dividendo', 'dividendos', 'juros recebidos', 'investimento', 'cdb', 'tesouro', 'dividend', 'interest'],
    children: [
      { key: 'dividends', icon: 'coins', keywords: ['dividendo', 'dividendos', 'fii', 'fiis', 'jcp', 'proventos'] },
      { key: 'fixed_income', icon: 'trending-up', keywords: ['cdb', 'tesouro direto', 'lci', 'lca', 'poupanca', 'rendimento cdi'] },
      { key: 'crypto_stocks', icon: 'bitcoin', keywords: ['acoes', 'lucro acoes', 'cripto', 'bitcoin', 'day trade'] },
    ],
  },
  {
    key: 'bonus',
    kind: 'income',
    icon: 'award',
    color: '#ca8a04',
    keywords: ['bonus', 'premio', 'plr', 'gratificacao'],
    children: [
      { key: 'plr', icon: 'trophy', keywords: ['plr', 'participacao nos lucros', 'meta batida', 'bonus anual'] },
      { key: 'prize_award', icon: 'medal', keywords: ['premio', 'sorteio', 'loteria', 'premiacao'] },
    ],
  },
  {
    key: 'sales',
    kind: 'income',
    icon: 'store',
    color: '#ea580c',
    keywords: ['venda', 'vendas', 'vendi', 'sale', 'sold', 'venta'],
    children: [
      { key: 'product_sales', icon: 'store', keywords: ['venda de produto', 'encomenda', 'loja', 'faturamento'] },
      { key: 'used_items', icon: 'tag', keywords: ['desapego', 'olx', 'enjoei', 'venda usado', 'bazar'] },
      { key: 'rental_income', icon: 'house', keywords: ['aluguel recebido', 'inquilino', 'locacao recebida', 'temporada'] },
    ],
  },
  {
    key: 'refunds',
    kind: 'income',
    icon: 'undo-2',
    color: '#0891b2',
    keywords: ['reembolso', 'estorno', 'devolucao', 'cashback', 'refund'],
    children: [
      { key: 'cashback', icon: 'sparkles', keywords: ['cashback', 'meliuz', 'pontos', 'milhas'] },
      { key: 'reimbursement', icon: 'undo-2', keywords: ['reembolso empresa', 'estorno cartao', 'devolucao compra'] },
      { key: 'tax_refund', icon: 'landmark', keywords: ['restituicao', 'restituicao ir', 'imposto de renda restituicao', 'nota paulista'] },
    ],
  },
  { key: 'gifts_received', kind: 'income', icon: 'gift', color: '#db2777', keywords: ['ganhei de presente', 'presente recebido', 'mesada', 'heranca'] },
  { key: 'pension_aid', kind: 'income', icon: 'shield-plus', color: '#4f46e5', keywords: ['aposentadoria', 'pensao', 'beneficio', 'inss recebido', 'bolsa', 'auxilio'] },
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
