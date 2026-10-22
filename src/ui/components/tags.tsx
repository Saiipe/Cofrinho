import { Check, Hash, Plus, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { createTag, normalizeTagName } from '@/data/tags';
import { normalizeText } from '@/domain/quickEntry';
import type { ID, Tag } from '@/domain/types';
import { haptic, playSound } from '@/services/feedback';
import { useT } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { Sheet } from './Sheet';
import { Button, cx } from './primitives';

/** Small colored pill: `#name`. */
export function TagPill({ tag, active, onClick, className }: { tag: Tag; active?: boolean; onClick?: () => void; className?: string }) {
  const content = (
    <>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} aria-hidden />
      <span className="truncate">{tag.name}</span>
      {active && <Check className="size-3.5 shrink-0" aria-hidden />}
    </>
  );
  const classes = cx(
    'inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 font-medium',
    onClick ? 'h-9 text-sm' : 'h-7 text-[0.78rem]',
    active ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-fg',
    className,
  );
  if (!onClick) return <span className={classes}>{content}</span>;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        haptic('light');
        onClick();
      }}
      className={classes}
    >
      {content}
    </button>
  );
}

/** Tags of a record, in the book's tag order. */
export function TagList({ ids, className }: { ids: ID[] | undefined; className?: string }) {
  const { tags } = useBook();
  const selected = tags.filter((tag) => ids?.includes(tag.id));
  if (!selected.length) return null;
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {selected.map((tag) => (
        <TagPill key={tag.id} tag={tag} />
      ))}
    </div>
  );
}

/** "#viagem #trabalho" for one-line subtitles. */
export function useTagNames(ids: ID[] | undefined): string {
  const { tagMap } = useBook();
  return (ids ?? [])
    .map((id) => tagMap.get(id)?.name)
    .filter(Boolean)
    .map((name) => `#${name}`)
    .join(' ');
}

/** Multi-select tag picker; typing a new name offers to create it on the spot. */
export function TagPickerSheet({ open, onClose, value, onChange }: { open: boolean; onClose: () => void; value: ID[]; onChange: (ids: ID[]) => void }) {
  const t = useT();
  const { book, tags } = useBook();
  const [query, setQuery] = useState('');
  const name = normalizeTagName(query);
  const filtered = useMemo(() => {
    const q = normalizeText(name);
    return q ? tags.filter((tag) => normalizeText(tag.name).includes(q)) : tags;
  }, [tags, name]);
  const exact = tags.some((tag) => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase());

  const toggle = (id: ID) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const create = async () => {
    if (!name) return;
    const tag = await createTag(book.id, name);
    haptic('success');
    playSound('success');
    if (!value.includes(tag.id)) onChange([...value, tag.id]);
    setQuery('');
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('tags.title')}
      footer={
        <div className="flex items-center gap-2">
          <Link to="/tags" onClick={onClose} className="flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary active:bg-primary-soft">
            <Settings2 className="size-4" aria-hidden />
            {t('tags.manage')}
          </Link>
          <Button className="ml-auto" onClick={onClose}>
            {t('common.done')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 px-4 pb-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (name && !exact) void create();
            else if (filtered.length === 1) toggle(filtered[0]!.id);
          }}
          className="flex h-11 items-center gap-2 rounded-xl bg-surface-2 px-3"
        >
          <Hash className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tags.searchOrCreate')}
            enterKeyHint="done"
            maxLength={40}
            className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            aria-label={t('tags.searchOrCreate')}
          />
        </form>
        {name && !exact && (
          <button type="button" onClick={() => void create()} className="flex h-11 w-full items-center gap-2 rounded-xl bg-primary-soft px-3 text-left text-sm font-semibold text-primary">
            <Plus className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{t('tags.create', { name })}</span>
          </button>
        )}
        {tags.length === 0 && !name ? (
          <p className="py-4 text-center text-sm text-muted">{t('tags.emptyHint')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map((tag) => (
              <TagPill key={tag.id} tag={tag} active={value.includes(tag.id)} onClick={() => toggle(tag.id)} />
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
