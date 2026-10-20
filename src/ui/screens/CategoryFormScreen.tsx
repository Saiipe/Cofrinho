import { ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { deleteCategory, reorderCategories, saveCategory } from '@/data/categories';
import { CATEGORY_COLORS } from '@/domain/defaults';
import type { Category, CategoryKind } from '@/domain/types';
import { categoryLabel } from '@/i18n/labels';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { CategoryIcon, EntityIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { SortableList, SwipeRow } from '../components/gestures';
import { Page, useGoBack } from '../components/Page';
import { ColorSwatches, IconPickerSheet } from '../components/pickers';
import { Button, Card, TextField } from '../components/primitives';

export default function CategoryFormScreen() {
  const { id } = useParams();
  const { categoryMap } = useBook();
  const existing = id ? categoryMap.get(id) : undefined;
  return <CategoryForm key={id ?? 'new'} existing={existing ?? null} />;
}

function CategoryForm({ existing }: { existing: Category | null }) {
  const { settings, t } = useApp();
  const { book, categoryMap, childrenOf, categoryName } = useBook();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const goBack = useGoBack('/categories');
  const parentId = existing?.parentId ?? params.get('parent');
  const parent = parentId ? categoryMap.get(parentId) : undefined;
  const kind: CategoryKind = existing?.kind ?? parent?.kind ?? (params.get('kind') === 'income' ? 'income' : 'expense');
  const builtinName = existing?.builtinKey ? categoryLabel({ name: '', builtinKey: existing.builtinKey }, t) : '';
  const [name, setName] = useState(existing ? categoryName(existing) : '');
  const [icon, setIcon] = useState(existing?.icon ?? 'circle-ellipsis');
  const [color, setColor] = useState(existing?.color ?? parent?.color ?? CATEGORY_COLORS[(categoryMap.size * 7) % CATEGORY_COLORS.length]!);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const children = existing && !existing.parentId ? childrenOf(existing.id) : [];

  const save = async () => {
    if (!name.trim()) {
      setError(t('categories.nameRequired'));
      return;
    }
    // Untouched built-in names stay translatable.
    const storedName = existing?.builtinKey && name.trim() === builtinName ? '' : name;
    await saveCategory({ id: existing?.id, bookId: book.id, kind, parentId: parentId ?? null, name: storedName, icon, color });
    toast(t('common.saved'), { tone: 'success' });
    goBack();
  };

  const remove = async (category: Category) => {
    const message = [t('categories.deleteHint'), childrenOf(category.id).length ? t('categories.deleteChildren') : null].filter(Boolean).join(' ');
    if (!(await confirm({ title: t('categories.deleteConfirm', { name: categoryName(category) }), message, confirmLabel: t('common.delete'), destructive: true }))) return false;
    await deleteCategory(category.id);
    return true;
  };

  const title = existing ? t('categories.edit') : parent ? t('categories.newSub') : t('categories.new');

  return (
    <Page title={title} back="/categories" footer={<Button block onClick={() => void save()}>{t('common.save')}</Button>}>
      <div className="space-y-5 px-4">
        <div className="flex items-center gap-3 pt-2">
          <button type="button" onClick={() => setPicking(true)} aria-label={t('categories.chooseIcon')}>
            <EntityIcon icon={icon} color={color} size="xl" mono={false} />
          </button>
          <TextField className="flex-1" label={t('categories.name')} value={name} onChange={(e) => setName(e.target.value)} error={error} maxLength={30} autoFocus={!existing} />
        </div>
        {parent && (
          <p className="text-sm text-muted">
            {t('categories.parent')}: <b className="text-fg">{categoryName(parent)}</b>
          </p>
        )}
        <div>
          <p className="mb-2 text-sm font-medium text-muted">{t('categories.color')}</p>
          <ColorSwatches colors={CATEGORY_COLORS} value={color} onChange={setColor} label={t('categories.color')} />
        </div>
        <Button variant="secondary" block onClick={() => setPicking(true)}>
          {t('categories.chooseIcon')}
        </Button>

        {existing && !existing.parentId && settings.showSubcategories && (
          <section>
            <h2 className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('settings.subcategories')}</h2>
            <Card className="overflow-hidden">
              <SortableList
                items={children}
                onReorder={(ids) => void reorderCategories(ids)}
                renderItem={(child, handle) => (
                  <SwipeRow label={t('common.delete')} onDelete={() => void remove(child)}>
                    <div className="flex items-center border-b border-line pr-1">
                      <Link to={`/categories/${child.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 active:bg-surface-2">
                        <CategoryIcon category={child} size="sm" />
                        <span className="min-w-0 flex-1 truncate">{categoryName(child)}</span>
                        <ChevronRight className="size-4 text-faint" aria-hidden />
                      </Link>
                      {handle}
                    </div>
                  </SwipeRow>
                )}
              />
              <button type="button" onClick={() => navigate(`/categories/new?parent=${existing.id}`)} className="flex h-12 w-full items-center justify-center gap-2 text-sm font-semibold text-primary active:bg-primary-soft">
                <Plus className="size-4" aria-hidden />
                {t('categories.addSub')}
              </button>
            </Card>
          </section>
        )}

        {existing && (
          <Button
            variant="ghost"
            block
            className="text-danger"
            onClick={async () => {
              if (await remove(existing)) navigate('/categories', { replace: true });
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
      <IconPickerSheet open={picking} onClose={() => setPicking(false)} value={icon} color={color} onSelect={setIcon} />
    </Page>
  );
}
