import { useLiveQuery } from 'dexie-react-hooks';
import { Info, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { addMember, createBook, deleteBook, removeMember, renameMember, setCurrentBook, updateBook } from '@/data/books';
import { db } from '@/data/db';
import { BOOK_COLORS } from '@/domain/defaults';
import type { Book, BookType } from '@/domain/types';
import { bookTypeHint, bookTypeLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { BOOK_ICONS } from '../components/BookSwitcher';
import { EntityIcon } from '../components/EntityIcon';
import { InlineNotice, useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { ColorSwatches, CurrencyPickerSheet } from '../components/pickers';
import { Button, Card, cx, IconButton, Row, TextField } from '../components/primitives';
import { currencyName } from '../currencies';

const TYPES: BookType[] = ['personal', 'business', 'project', 'split'];

export default function BookFormScreen() {
  const { id } = useParams();
  const { books } = useBook();
  const existing = id ? books.find((b) => b.id === id) : undefined;
  return <BookForm key={id ?? 'new'} existing={existing ?? null} />;
}

function BookForm({ existing }: { existing: Book | null }) {
  const { settings, t, locale } = useApp();
  const { book: current, books } = useBook();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const goBack = useGoBack('/books');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<BookType>(existing?.type ?? 'personal');
  const [currency, setCurrency] = useState(existing?.currency ?? settings.defaultCurrency);
  const [color, setColor] = useState(existing?.color ?? BOOK_COLORS[books.length % BOOK_COLORS.length]!);
  const [draftMembers, setDraftMembers] = useState<string[]>(['']);
  const [newMember, setNewMember] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pickingCurrency, setPickingCurrency] = useState(false);
  const members = useLiveQuery(async () => (existing ? db.members.where('bookId').equals(existing.id).sortBy('order') : []), [existing?.id]);

  const save = async () => {
    if (!name.trim()) {
      setError(t('books.nameRequired'));
      return;
    }
    if (existing) {
      await updateBook(existing.id, { name: name.trim(), currency, color });
      toast(t('common.saved'), { tone: 'success' });
      goBack();
      return;
    }
    const others = draftMembers.map((m) => m.trim()).filter(Boolean);
    if (type === 'split' && others.length < 1) {
      toast(t('books.minMembers'), { tone: 'error' });
      return;
    }
    const book = await createBook({
      name,
      type,
      currency,
      color,
      members: type === 'split' ? [{ name: t('books.me'), isMe: true }, ...others.map((m) => ({ name: m, isMe: false }))] : undefined,
    });
    await setCurrentBook(book.id);
    toast(t('books.switched', { name: book.name }), { tone: 'success' });
    navigate('/', { replace: true });
  };

  const remove = async () => {
    if (!existing) return;
    if (books.length <= 1) {
      toast(t('books.lastBook'), { tone: 'error' });
      return;
    }
    if (await confirm({ title: t('books.deleteConfirm', { name: existing.name }), message: t('books.deleteWarning'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteBook(existing.id);
      navigate('/books', { replace: true });
    }
  };

  const typeSelector = (
    <div className="space-y-2">
      {TYPES.map((value) => (
        <button
          key={value}
          type="button"
          disabled={Boolean(existing)}
          aria-pressed={type === value}
          onClick={() => setType(value)}
          className={cx('flex w-full items-center gap-3 rounded-2xl border p-3 text-left', type === value ? 'border-primary bg-primary-soft' : 'border-line bg-surface', existing && type !== value && 'hidden')}
        >
          <EntityIcon icon={BOOK_ICONS[value]} color={color} mono={false} />
          <span className="min-w-0">
            <span className="block font-semibold">{bookTypeLabel(value, t)}</span>
            <span className="block text-xs text-muted">{bookTypeHint(value, t)}</span>
          </span>
        </button>
      ))}
      {existing && <p className="px-1 text-xs text-muted">{t('books.typeLocked')}</p>}
    </div>
  );

  return (
    <Page title={existing ? t('books.edit') : t('books.new')} back="/books" footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4 pt-1">
        <TextField label={t('books.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('books.namePlaceholder')} error={error} maxLength={30} autoFocus={!existing} />
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('books.type')}</p>
          {typeSelector}
        </div>
        <Card className="overflow-hidden">
          <Row title={t('common.currency')} trailing={`${currency} · ${currencyName(currency, locale)}`} onClick={() => setPickingCurrency(true)} chevron />
        </Card>
        {existing && currency !== existing.currency && <InlineNotice icon={Info} tone="warning">{t('books.currencyChanged')}</InlineNotice>}
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('books.color')}</p>
          <ColorSwatches colors={BOOK_COLORS} value={color} onChange={setColor} label={t('books.color')} />
        </div>

        {type === 'split' && (
          <section>
            <p className="mb-2 text-sm font-medium text-muted">{t('books.members')}</p>
            <Card className="space-y-2 p-3">
              {existing ? (
                (members ?? []).map((member) => (
                  <div key={member.id} className="flex items-center gap-2">
                    <input
                      defaultValue={member.name}
                      onBlur={(e) => e.target.value.trim() && e.target.value !== member.name && void renameMember(member.id, e.target.value)}
                      aria-label={t('books.memberName')}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-primary"
                    />
                    {member.isMe ? (
                      <span className="px-2 text-xs text-muted">{t('books.meSuffix')}</span>
                    ) : (
                      <IconButton
                        icon={Trash2}
                        label={t('common.delete')}
                        onClick={async () => {
                          if ((members ?? []).length <= 2) return toast(t('books.minMembers'), { tone: 'error' });
                          if ((await removeMember(existing.id, member.id)) === 'in_use') toast(t('books.memberInUse'), { tone: 'error' });
                        }}
                      />
                    )}
                  </div>
                ))
              ) : (
                <>
                  <div className="flex h-11 items-center rounded-xl bg-surface-2 px-3 text-muted">
                    {t('books.me')} {t('books.meSuffix')}
                  </div>
                  {draftMembers.map((value, index) => (
                    <input
                      key={index}
                      value={value}
                      onChange={(e) => setDraftMembers((list) => list.map((m, i) => (i === index ? e.target.value : m)))}
                      placeholder={t('books.memberName')}
                      aria-label={t('books.memberName')}
                      className="h-11 w-full rounded-xl border border-line bg-surface px-3 outline-none focus:border-primary"
                    />
                  ))}
                </>
              )}
              <div className="flex gap-2">
                {existing ? (
                  <>
                    <input value={newMember} onChange={(e) => setNewMember(e.target.value)} placeholder={t('books.memberName')} aria-label={t('books.addMember')} className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-primary" />
                    <Button
                      variant="secondary"
                      icon={UserPlus}
                      disabled={!newMember.trim()}
                      onClick={async () => {
                        await addMember(existing.id, newMember);
                        setNewMember('');
                      }}
                    >
                      {t('common.add')}
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" icon={UserPlus} block onClick={() => setDraftMembers((list) => [...list, ''])}>
                    {t('books.addMember')}
                  </Button>
                )}
              </div>
            </Card>
          </section>
        )}

        {existing && existing.id !== current.id && (
          <Button
            variant="secondary"
            block
            onClick={async () => {
              await setCurrentBook(existing.id);
              toast(t('books.switched', { name: existing.name }));
              navigate('/');
            }}
          >
            {t('books.use')}
          </Button>
        )}
        {existing && (
          <Button variant="ghost" block className="text-danger" onClick={() => void remove()}>
            {t('common.delete')}
          </Button>
        )}
      </div>
      <CurrencyPickerSheet open={pickingCurrency} onClose={() => setPickingCurrency(false)} value={currency} onSelect={setCurrency} />
    </Page>
  );
}
