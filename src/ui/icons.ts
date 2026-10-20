import {
  Activity, Apple, Armchair, Award, Baby, Backpack, BadgeDollarSign, Banknote, Bath, Bed, Beef, Beer, Bell, Bike, Bitcoin, Bone, Book,
  BookOpen, Bookmark, Brain, Briefcase, BriefcaseBusiness, Building, Building2, Bus, BusFront, Cake, Calculator, Calendar, Camera, Candy,
  Car, CarTaxiFront, Carrot, Cat, ChartLine, ChefHat, Church, CircleDollarSign, CircleEllipsis, CircleHelp, Clapperboard, Clipboard, Clock,
  Cloud, Coffee, Coins, Compass, Cookie, CreditCard, Croissant, CupSoda, Dice5, Dog, DollarSign, Drama, Droplets, Drumstick, Dumbbell,
  Egg, EggFried, Euro, Eye, FileText, Film, Fish, Flag, Flame, Flower2, Folder, Footprints, Fuel, Gamepad2, Gem, Gift, Glasses, Globe,
  Goal, GraduationCap, Guitar, Hammer, HandCoins, HandHeart, HandPlatter, Headphones, Heart, HeartHandshake, HeartPulse, Hospital, Hotel,
  House, IceCreamCone, IdCard, Infinity as InfinityIcon, JapaneseYen, Joystick, Key, Lamp, Landmark, Languages, Laptop, Leaf, Library,
  Lightbulb, Lock, Luggage, Mail, Map, MapPin, Medal, MicVocal, Microscope, Milk, MonitorSmartphone, Moon, Motorbike, Mountain,
  MountainSnow, Music, Package, Paintbrush, PaintRoller, Palette, PartyPopper, PawPrint, Paperclip, Pencil, Percent, Phone, PiggyBank,
  Pill, Pizza, Plane, Plug, Popcorn, PoundSterling, Presentation, Printer, Puzzle, Receipt, ReceiptText, Route, Sailboat, Salad, Sandwich,
  Scale, School, Scissors, Shield, ShieldPlus, Ship, Shirt, ShoppingBag, ShoppingBasket, ShoppingCart, ShowerHead, Smartphone,
  SmartphoneNfc, Smile, Sofa, Soup, Sparkles, SprayCan, Sprout, SquareParking, Star, Stethoscope, Store, Sun, Syringe, Tag, Tent,
  Thermometer, Ticket, TicketsPlane, TrainFront, TramFront, Trash2, TreePalm, TreePine, TrendingDown, TrendingUp, Trophy, Truck, Tv,
  Umbrella, Undo2, User, Utensils, UtensilsCrossed, Vault, Volleyball, Wallet, WalletCards, WashingMachine, Watch,
  Waves, Wifi, Wine, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '@/i18n';

/** Icons are stored by their kebab-case name so data never depends on component identity. */
export const ICONS: Record<string, LucideIcon> = {
  activity: Activity, apple: Apple, armchair: Armchair, award: Award, baby: Baby, backpack: Backpack,
  'badge-dollar-sign': BadgeDollarSign, banknote: Banknote, bath: Bath, bed: Bed, beef: Beef, beer: Beer, bell: Bell, bike: Bike,
  bitcoin: Bitcoin, bone: Bone, book: Book, 'book-open': BookOpen, bookmark: Bookmark, brain: Brain, briefcase: Briefcase,
  'briefcase-business': BriefcaseBusiness, building: Building, 'building-2': Building2, bus: Bus, 'bus-front': BusFront, cake: Cake,
  calculator: Calculator, calendar: Calendar, camera: Camera, candy: Candy, car: Car, 'car-taxi-front': CarTaxiFront, carrot: Carrot,
  cat: Cat, 'chart-line': ChartLine, 'chef-hat': ChefHat, church: Church, 'circle-dollar-sign': CircleDollarSign,
  'circle-ellipsis': CircleEllipsis, 'circle-help': CircleHelp, clapperboard: Clapperboard, clipboard: Clipboard, clock: Clock,
  cloud: Cloud, coffee: Coffee, coins: Coins, compass: Compass, cookie: Cookie, 'credit-card': CreditCard, croissant: Croissant,
  'cup-soda': CupSoda, 'dice-5': Dice5, dog: Dog, 'dollar-sign': DollarSign, drama: Drama, droplets: Droplets, drumstick: Drumstick,
  dumbbell: Dumbbell, egg: Egg, 'egg-fried': EggFried, euro: Euro, eye: Eye, 'file-text': FileText, film: Film, fish: Fish, flag: Flag,
  flame: Flame, 'flower-2': Flower2, folder: Folder, footprints: Footprints, fuel: Fuel, 'gamepad-2': Gamepad2, gem: Gem, gift: Gift,
  glasses: Glasses, globe: Globe, goal: Goal, 'graduation-cap': GraduationCap, guitar: Guitar, hammer: Hammer, 'hand-coins': HandCoins,
  'hand-heart': HandHeart, 'hand-platter': HandPlatter, headphones: Headphones, heart: Heart, 'heart-handshake': HeartHandshake,
  'heart-pulse': HeartPulse, hospital: Hospital, hotel: Hotel, house: House, 'ice-cream-cone': IceCreamCone, 'id-card': IdCard,
  infinity: InfinityIcon, 'japanese-yen': JapaneseYen, joystick: Joystick, key: Key, lamp: Lamp, landmark: Landmark,
  languages: Languages, laptop: Laptop, leaf: Leaf, library: Library, lightbulb: Lightbulb, lock: Lock, luggage: Luggage, mail: Mail,
  map: Map, 'map-pin': MapPin, medal: Medal, 'mic-vocal': MicVocal, microscope: Microscope, milk: Milk,
  'monitor-smartphone': MonitorSmartphone, moon: Moon, motorbike: Motorbike, mountain: Mountain, 'mountain-snow': MountainSnow,
  music: Music, package: Package, paintbrush: Paintbrush, 'paint-roller': PaintRoller, palette: Palette, 'party-popper': PartyPopper,
  'paw-print': PawPrint, paperclip: Paperclip, pencil: Pencil, percent: Percent, phone: Phone, 'piggy-bank': PiggyBank, pill: Pill,
  pizza: Pizza, plane: Plane, plug: Plug, popcorn: Popcorn, 'pound-sterling': PoundSterling, presentation: Presentation,
  printer: Printer, puzzle: Puzzle, receipt: Receipt, 'receipt-text': ReceiptText, route: Route, sailboat: Sailboat, salad: Salad,
  sandwich: Sandwich, scale: Scale, school: School, scissors: Scissors, shield: Shield, 'shield-plus': ShieldPlus, ship: Ship,
  shirt: Shirt, 'shopping-bag': ShoppingBag, 'shopping-basket': ShoppingBasket, 'shopping-cart': ShoppingCart,
  'shower-head': ShowerHead, smartphone: Smartphone, 'smartphone-nfc': SmartphoneNfc, smile: Smile, sofa: Sofa, soup: Soup,
  sparkles: Sparkles, 'spray-can': SprayCan, sprout: Sprout, 'square-parking': SquareParking, star: Star, stethoscope: Stethoscope,
  store: Store, sun: Sun, syringe: Syringe, tag: Tag, tent: Tent, thermometer: Thermometer, ticket: Ticket,
  'tickets-plane': TicketsPlane, 'train-front': TrainFront, 'tram-front': TramFront, 'trash-2': Trash2, 'tree-palm': TreePalm,
  'tree-pine': TreePine, 'trending-down': TrendingDown, 'trending-up': TrendingUp, trophy: Trophy, truck: Truck, tv: Tv,
  umbrella: Umbrella, 'undo-2': Undo2, user: User, utensils: Utensils, 'utensils-crossed': UtensilsCrossed, vault: Vault,
  volleyball: Volleyball, wallet: Wallet, 'wallet-cards': WalletCards, 'washing-machine': WashingMachine, watch: Watch,
  waves: Waves, wifi: Wifi, wine: Wine, wrench: Wrench, zap: Zap,
};


export function iconFor(id: string): LucideIcon {
  return ICONS[id] ?? CircleEllipsis;
}

export const ICON_GROUPS: { key: MessageKey; icons: string[] }[] = [
  { key: 'icons.food', icons: ['utensils', 'utensils-crossed', 'chef-hat', 'hand-platter', 'pizza', 'sandwich', 'soup', 'salad', 'beef', 'drumstick', 'fish', 'egg-fried', 'egg', 'croissant', 'cookie', 'cake', 'candy', 'ice-cream-cone', 'apple', 'carrot', 'milk', 'coffee', 'cup-soda', 'beer', 'wine', 'shopping-basket'] },
  { key: 'icons.shopping', icons: ['shopping-bag', 'shopping-cart', 'store', 'tag', 'package', 'shirt', 'gem', 'watch', 'glasses', 'monitor-smartphone', 'laptop', 'smartphone', 'headphones', 'camera', 'truck'] },
  { key: 'icons.transport', icons: ['bus', 'bus-front', 'train-front', 'tram-front', 'car', 'car-taxi-front', 'motorbike', 'bike', 'fuel', 'square-parking', 'route', 'map-pin', 'plane', 'ship', 'wrench'] },
  { key: 'icons.home', icons: ['house', 'building-2', 'key', 'lightbulb', 'zap', 'droplets', 'flame', 'wifi', 'plug', 'tv', 'sofa', 'armchair', 'bed', 'lamp', 'bath', 'shower-head', 'washing-machine', 'hammer', 'paint-roller', 'trash-2', 'sprout', 'flower-2'] },
  { key: 'icons.health', icons: ['heart-pulse', 'stethoscope', 'pill', 'syringe', 'hospital', 'thermometer', 'shield-plus', 'activity', 'brain', 'eye', 'baby'] },
  { key: 'icons.education', icons: ['graduation-cap', 'school', 'book-open', 'book', 'library', 'presentation', 'pencil', 'backpack', 'calculator', 'microscope', 'languages'] },
  { key: 'icons.leisure', icons: ['ticket', 'clapperboard', 'film', 'popcorn', 'tv', 'gamepad-2', 'joystick', 'music', 'headphones', 'mic-vocal', 'guitar', 'drama', 'dice-5', 'puzzle', 'palette', 'paintbrush', 'party-popper'] },
  { key: 'icons.sports', icons: ['dumbbell', 'bike', 'volleyball', 'goal', 'trophy', 'medal', 'waves', 'footprints', 'mountain', 'tent'] },
  { key: 'icons.travel', icons: ['plane', 'tickets-plane', 'luggage', 'hotel', 'map', 'compass', 'globe', 'tree-palm', 'sailboat', 'mountain-snow', 'camera', 'id-card', 'sun', 'umbrella'] },
  { key: 'icons.finance', icons: ['wallet', 'wallet-cards', 'credit-card', 'landmark', 'piggy-bank', 'vault', 'coins', 'banknote', 'hand-coins', 'badge-dollar-sign', 'circle-dollar-sign', 'dollar-sign', 'euro', 'pound-sterling', 'japanese-yen', 'bitcoin', 'receipt', 'receipt-text', 'chart-line', 'trending-up', 'trending-down', 'percent', 'scale', 'smartphone-nfc'] },
  { key: 'icons.personal', icons: ['scissors', 'sparkles', 'spray-can', 'smile', 'user', 'heart', 'paw-print', 'dog', 'cat', 'bone', 'baby'] },
  { key: 'icons.work', icons: ['briefcase', 'briefcase-business', 'laptop', 'printer', 'paperclip', 'folder', 'file-text', 'clipboard', 'mail', 'phone', 'building', 'presentation'] },
  { key: 'icons.celebration', icons: ['gift', 'party-popper', 'cake', 'heart-handshake', 'hand-heart', 'church', 'star', 'sparkles', 'tree-pine', 'award'] },
  { key: 'icons.other', icons: ['circle-ellipsis', 'circle-help', 'star', 'flag', 'bookmark', 'bell', 'calendar', 'clock', 'infinity', 'shield', 'lock', 'cloud', 'moon', 'sun', 'undo-2'] },
];
