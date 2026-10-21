import { useLiveQuery } from 'dexie-react-hooks';
import { Hash, Plus } from 'lucide-react';
import { useState } from 'react';
import { createTag, deleteTag, reorderTags, tagUsage, updateTag } from '@/data/tags';
import { CATEGORY_COLORS, TAG_NAME_MAX } from '@/domain/defaults';
import type { Tag } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { useFeedback } from '../components/feedback';
import { SortableList, SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { ColorSwatches } from '../components/pickers';
import { Button, Card, EmptyState, IconButton, TextField } from '../components/primitives';
import { Sheet } from '../components/Sheet';

export default function TagsScreen() {
  const { t } = useApp();
  const { book, tags } = useBook();
  const { confirm, toast } = useFeedback();
  const usage = useLiveQuery(() => tagUsage(book.id), [book.id]);
  const [editing, setEditing] = useState<Tag | 'new' | null>(null);

  const remove = async (tag: Tag) => {
    if (await confirm({ title: t('tags.deleteConfirm', { name: tag.name }), message: t('tags.deleteHint'), confirmLabel: t('common.delete'), destructive: true })) {
      await deleteTag(tag.id);
      toast(t('common.deleted'));
    }
  };

  return (
    <Page title={t('tags.title')} back="/me" actions={<IconButton icon={Plus} label={t('tags.new')} onClick={() => setEditing('new')} />}>
      {tags.length === 0 ? (
        <EmptyState icon={Hash} title={t('tags.empty')} hint={t('tags.emptyHint')} action={<Button onClick={() => setEditing('new')}>{t('tags.new')}</Button>} />
      ) : (
        <div className="space-y-3 px-4">
          <Card className="overflow-hidden">
            <SortableList
              items={tags}
              onReorder={(ids) => void reorderTags(ids)}
              renderItem={(tag, handle) => (
                <SwipeRow label={t('common.delete')} onDelete={() => void remove(tag)}>
                  <div className="flex items-center border-b border-line pr-1 last:border-0">
                    <button type="button" onClick={() => setEditing(tag)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left active:bg-surface-2">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: tag.color }} aria-hidden>
                        <Hash className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{tag.name}</span>
                        <span className="block text-xs text-muted">{t('tags.uses', { count: usage?.get(tag.id) ?? 0 })}</span>
                      </span>
                    </button>
                    {handle}
                  </div>
                </SwipeRow>
              )}
            />
          </Card>
          <p className="px-1 text-xs text-muted">{t('tags.emptyHint')}</p>
        </div>
      )}
      {editing !== null && <TagSheet tag={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDelete={(tag) => void remove(tag)} />}
    </Page>
  );
}

function TagSheet({ tag, onClose, onDelete }: { tag: Tag | null; onClose: () => void; onDelete: (tag: Tag) => void }) {
  const { t } = useApp();
  const { book, tags } = useBook();
  const { toast } = useFeedback();
  const [name, setName] = useState(tag?.name ?? '');
  const [color, setColor] = useState(tag?.color ?? CATEGORY_COLORS[(tags.length * 5) % CATEGORY_COLORS.length]!);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!name.trim()) {
      setError(t('tags.nameRequired'));
      return;
    }
    if (tag) await updateTag(tag.id, { name, color });
    else await createTag(book.id, name, color);
    toast(t('common.saved'), { tone: 'success' });
    onClose();
  };
  return (
    <Sheet
      open
      onClose={onClose}
      title={tag ? t('tags.edit') : t('tags.new')}
      footer={
        <div className="flex gap-2">
          {tag && (
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() => {
                onClose();
                onDelete(tag);
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button className="flex-1" onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-4 pb-4">
        <TextField
          label={t('tags.name')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={TAG_NAME_MAX}
          error={error}
          enterKeyHint="done"
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          data-autofocus={tag ? undefined : true}
        />
        <ColorSwatches colors={CATEGORY_COLORS} value={color} onChange={setColor} label={t('categories.color')} />
      </div>
    </Sheet>
  );
}
