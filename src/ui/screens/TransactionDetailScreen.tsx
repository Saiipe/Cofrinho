import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, Copy, HandCoins, Pencil, Scale, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { db } from '@/data/db';
import { deleteInstallmentGroup, deleteTransaction, duplicateTransaction } from '@/data/transactions';
import { kindLabel } from '@/i18n/labels';
import type { MessageKey } from '@/i18n';
import { useApp } from '../app/AppContext';
import { useBook } from '../app/BookContext';
import { TxAmount } from '../components/Amount';
import { CategoryIcon } from '../components/EntityIcon';
import { useFeedback } from '../components/feedback';
import { Page, useGoBack } from '../components/Page';
import { PhotoThumb, PhotoViewer } from '../components/photos';
import { Button, Card, Divider, EmptyState, IconButton, Row } from '../components/primitives';
import { Sheet } from '../components/Sheet';
import { TagList } from '../components/tags';
import { useFormat } from '../hooks/useFormat';

export default function TransactionDetailScreen() {
  const { id = '' } = useParams();
  const { t } = useApp();
  const { book, categoryMap, accountMap, memberMap, categoryName } = useBook();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const goBack = useGoBack('/');
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const tx = useLiveQuery(() => db.transactions.get(id), [id]);
  const schedule = useLiveQuery(async () => (tx?.scheduleId ? ((await db.schedules.get(tx.scheduleId)) ?? null) : null), [tx?.scheduleId]);

  if (tx === undefined) return <Page title={t('tx.details')} back>{null}</Page>;
  if (!tx) {
    return (
      <Page title={t('tx.details')} back>
        <EmptyState icon={Trash2} title={t('common.notFound')} />
      </Page>
    );
  }

  const category = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
  const parent = category?.parentId ? categoryMap.get(category.parentId) : undefined;
  const account = tx.accountId ? accountMap.get(tx.accountId) : undefined;
  const toAccount = tx.toAccountId ? accountMap.get(tx.toAccountId) : undefined;
  const member = (memberId?: string) => (memberId ? (memberMap.get(memberId)?.name ?? '?') : '?');
  const editable = tx.kind !== 'adjustment';

  const remove = async () => {
    if (tx.installment) {
      setDeleting(true);
      return;
    }
    if (!(await confirm({ title: t('tx.deleteConfirm'), message: t('common.irreversible'), confirmLabel: t('common.delete'), destructive: true }))) return;
    await deleteTransaction(tx.id);
    toast(t('tx.deleted'));
    goBack();
  };

  const removeInstallments = async (fromIndex: number | null) => {
    setDeleting(false);
    if (fromIndex === null || !tx.installment) {
      await deleteTransaction(tx.id);
      toast(t('tx.deleted'));
    } else {
      const count = await deleteInstallmentGroup(tx.bookId, tx.installment.groupId, fromIndex);
      toast(t('tx.installmentsDeleted', { count }));
    }
    goBack();
  };

  const duplicate = async () => {
    const copy = await duplicateTransaction(tx.id);
    if (copy) {
      toast(t('tx.duplicated'), { tone: 'success' });
      navigate(`/tx/${copy.id}`, { replace: true });
    }
  };

  const HeroIcon =
    tx.kind === 'transfer' ? ArrowRightLeft : tx.kind === 'adjustment' ? Scale : tx.kind === 'split_payment' ? HandCoins : null;
  const title =
    tx.kind === 'transfer' || tx.kind === 'adjustment'
      ? kindLabel(tx.kind, t)
      : tx.kind === 'split_payment'
        ? t('split.paidTo', { from: member(tx.split?.payerId), to: member(tx.split?.toMemberId) })
        : parent
          ? `${categoryName(parent)} › ${categoryName(category)}`
          : categoryName(category);

  return (
    <Page
      title={t('tx.details')}
      back
      actions={
        <>
          {tx.kind !== 'adjustment' && <IconButton icon={Copy} label={t('tx.duplicate')} onClick={() => void duplicate()} />}
          {editable && <IconButton icon={Pencil} label={t('common.edit')} onClick={() => navigate(`/tx/${tx.id}/edit`)} />}
          <IconButton icon={Trash2} label={t('common.delete')} onClick={() => void remove()} />
        </>
      }
    >
      <div className="space-y-4 px-4 pt-2">
        <Card className="flex flex-col items-center px-6 py-7 text-center">
          {HeroIcon ? (
            <span className="flex size-16 items-center justify-center rounded-full bg-surface-2 text-muted">
              <HeroIcon className="size-8" aria-hidden />
            </span>
          ) : (
            <CategoryIcon category={category} size="xl" />
          )}
          <p className="mt-3 text-[0.95rem] font-medium text-muted">{title}</p>
          <TxAmount tx={tx} className="mt-1 text-[2rem]" />
          <p className="mt-1 text-xs text-faint">{kindLabel(tx.kind, t)}</p>
        </Card>

        <Card className="overflow-hidden">
          <Row title={t('common.date')} trailing={format.dateTime(tx.date)} />
          {tx.kind === 'transfer' ? (
            <>
              <Divider />
              <Row title={t('tx.from')} trailing={account?.name ?? t('common.unknownAccount')} to={account ? `/accounts/${account.id}` : undefined} />
              <Divider />
              <Row title={t('tx.to')} trailing={toAccount?.name ?? t('common.unknownAccount')} to={toAccount ? `/accounts/${toAccount.id}` : undefined} />
              {account && toAccount && account.currency !== toAccount.currency && (
                <>
                  <Divider />
                  <Row title={t('tx.receivedAmount', { currency: toAccount.currency })} trailing={format.money(tx.toAccountAmount, toAccount.currency)} />
                </>
              )}
            </>
          ) : (
            account && (
              <>
                <Divider />
                <Row title={t('common.account')} trailing={account.name} to={`/accounts/${account.id}`} />
              </>
            )
          )}
          {tx.currency !== book.currency ? (
            <>
              <Divider />
              <Row title={t('tx.originalAmount')} trailing={format.money(Math.abs(tx.originalAmount), tx.currency)} />
              <Divider />
              <Row title={t('tx.bookAmount')} trailing={format.money(Math.abs(tx.amount))} />
            </>
          ) : null}
          {tx.installment && (
            <>
              <Divider />
              <Row title={t('tx.installment')} trailing={t('tx.installmentValue', { index: tx.installment.index, count: tx.installment.count })} />
            </>
          )}
          {tx.note && (
            <>
              <Divider />
              <Row title={t('common.note')} subtitle={tx.note} />
            </>
          )}
          {schedule && (
            <>
              <Divider />
              <Row title={t('tx.generatedBy', { name: schedule.name })} to={`/recurring/${schedule.id}/edit`} />
            </>
          )}
        </Card>

        {tx.split && tx.kind === 'split_expense' && (
          <Card className="overflow-hidden">
            <Row title={t('split.paidBy')} trailing={member(tx.split.payerId)} />
            <Divider />
            <Row title={t('split.method')} trailing={t(`split.method.${tx.split.method}` as MessageKey)} />
            {tx.split.parts.map((part) => (
              <div key={part.memberId}>
                <Divider />
                <Row title={member(part.memberId)} trailing={format.money(part.share)} />
              </div>
            ))}
          </Card>
        )}

        {tx.tagIds && tx.tagIds.length > 0 && (
          <div>
            <p className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('tags.title')}</p>
            <TagList ids={tx.tagIds} />
          </div>
        )}

        {tx.details && (
          <div>
            <p className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('tx.memo')}</p>
            <Card className="px-4 py-3">
              <p className="text-[0.95rem] break-words whitespace-pre-wrap">{tx.details}</p>
            </Card>
          </div>
        )}

        {tx.photoIds.length > 0 && (
          <div>
            <p className="mb-2 px-1 text-[0.8rem] font-semibold tracking-wide text-muted uppercase">{t('tx.photos')}</p>
            <div className="flex flex-wrap gap-2">
              {tx.photoIds.map((photoId, index) => (
                <PhotoThumb key={photoId} id={photoId} size="size-24" onOpen={() => setViewing(index)} />
              ))}
            </div>
          </div>
        )}

        <p className="pb-4 text-center text-xs text-faint">{t('tx.createdAt', { date: format.dateTime(tx.createdAt) })}</p>
      </div>
      {viewing !== null && <PhotoViewer ids={tx.photoIds} index={viewing} onClose={() => setViewing(null)} />}
      {tx.installment && (
        <Sheet open={deleting} onClose={() => setDeleting(false)} title={t('tx.deleteInstallmentTitle', { index: tx.installment.index, count: tx.installment.count })}>
          <div className="space-y-2 px-4 pb-5">
            <Button block variant="secondary" onClick={() => void removeInstallments(null)}>
              {t('tx.deleteThisInstallment')}
            </Button>
            {tx.installment.index < tx.installment.count && (
              <Button block variant="secondary" onClick={() => void removeInstallments(tx.installment!.index)}>
                {t('tx.deleteNextInstallments')}
              </Button>
            )}
            <Button block variant="danger" onClick={() => void removeInstallments(1)}>
              {t('tx.deleteAllInstallments', { count: tx.installment.count })}
            </Button>
            <p className="pt-1 text-center text-xs text-muted">{t('common.irreversible')}</p>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
