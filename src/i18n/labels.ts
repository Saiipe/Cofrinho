import type { AccountType, BookType, Category, Frequency, Member, TxKind } from '@/domain/types';
import type { MessageKey, Translate } from './index';

export function categoryLabel(category: Pick<Category, 'name' | 'builtinKey'> | undefined, t: Translate): string {
  if (!category) return t('common.uncategorized');
  if (category.name) return category.name;
  return category.builtinKey ? t(`cat.${category.builtinKey}` as MessageKey) : t('common.uncategorized');
}

export function kindLabel(kind: TxKind, t: Translate): string {
  return t(`kind.${kind}` as MessageKey);
}

export function accountTypeLabel(type: AccountType, t: Translate): string {
  return t(`accounts.type.${type}` as MessageKey);
}

export function bookTypeLabel(type: BookType, t: Translate): string {
  return t(`books.type.${type}` as MessageKey);
}

export function bookTypeHint(type: BookType, t: Translate): string {
  return t(`books.type.${type}.hint` as MessageKey);
}

export function frequencyLabel(frequency: Frequency, t: Translate): string {
  return t(`freq.${frequency}` as MessageKey);
}

/** Member name, marked "(you)" unless the member is literally called "Me". */
export function memberLabel(member: Pick<Member, 'name' | 'isMe'> | undefined, t: Translate): string {
  if (!member) return '?';
  const plainMe = member.name.trim().toLocaleLowerCase() === t('books.me').toLocaleLowerCase();
  return member.isMe && !plainMe ? `${member.name} ${t('books.meSuffix')}` : member.name;
}
