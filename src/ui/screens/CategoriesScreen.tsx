import { ChevronRight, Info, Plus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { deleteCategory, reorderCategories } from '@/data/categories';
import type { Category, CategoryKind } from '@/domain/types';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { CategoryIcon } from '../components/EntityIcon';
import { InlineNotice, useFeedback } from '../components/feedback';
import { SortableList, SwipeRow } from '../components/gestures';
import { Page } from '../components/Page';
import { Card, IconButton, Segmented } from '../components/primitives';

export default function CategoriesScreen() {
  const { settings, t } = useApp();
  const { isSplit, topCategories, childrenOf, categoryName } = useBook();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kind: CategoryKind = params.get('kind') === 'income' && !isSplit ? 'income' : 'expense';
  const categories = topCategories(kind);

  const remove = async (category: Category) => {
    const hasChildren = childrenOf(category.id).length > 0;
    const message = [t('categories.deleteHint'), hasChildren ? t('categories.deleteChildren') : null].filter(Boolean).join(' ');
    if (await confirm({ title: t('categories.deleteConfirm', { name: categoryName(category) }), message, confirmLabel: t('common.delete'), destructive: true })) {
      await deleteCategory(category.id);
      toast(t('common.deleted'));
    }
  };

  return (
    <Page title={t('categories.title')} back="/me" actions={<IconButton icon={Plus} label={t('categories.new')} onClick={() => navigate(`/categories/new?kind=${kind}`)} />}>
      <div className="space-y-4 px-4">
        {!isSplit && (
          <Segmented
            label={t('categories.title')}
            value={kind}
            onChange={(k) => setParams(k === 'expense' ? {} : { kind: k }, { replace: true })}
            options={[
              { value: 'expense', label: t('common.expenses') },
              { value: 'income', label: t('common.income') },
            ]}
          />
        )}
        {!settings.showSubcategories && <InlineNotice icon={Info}>{t('categories.subcategoriesOff')}</InlineNotice>}
        <Card className="overflow-hidden">
          <SortableList
            items={categories}
            onReorder={(ids) => void reorderCategories(ids)}
            renderItem={(category, handle) => {
              const count = childrenOf(category.id).length;
              return (
                <SwipeRow label={t('common.delete')} onDelete={() => void remove(category)}>
                  <div className="flex items-center border-b border-line pr-1">
                    <Link to={`/categories/${category.id}/edit`} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 active:bg-surface-2">
                      <CategoryIcon category={category} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{categoryName(category)}</span>
                        {settings.showSubcategories && count > 0 && <span className="block text-xs text-muted">{t('categories.subcount', { count })}</span>}
                      </span>
                      <ChevronRight className="size-4 text-faint" aria-hidden />
                    </Link>
                    {handle}
                  </div>
                </SwipeRow>
              );
            }}
          />
        </Card>
        <p className="px-1 text-xs text-muted">{t('common.dragToSort')}</p>
      </div>
    </Page>
  );
}
