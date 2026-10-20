import { CloudUpload, History, Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { backupSummary, createBackup, InvalidBackupError, markBackupDone, parseBackup, restoreBackup } from '@/data/backup';
import { deliverFile, pickFile, stampedFileName } from '@/services/files';
import { useApp } from '../app/AppContext';
import { InlineNotice, useFeedback } from '../components/feedback';
import { Page } from '../components/Page';
import { Button, Card, Spinner, SwitchRow } from '../components/primitives';
import { useFormat } from '../hooks/useFormat';

export default function BackupScreen() {
  const { settings, t } = useApp();
  const format = useFormat();
  const { confirm, toast } = useFeedback();
  const navigate = useNavigate();
  const [includePhotos, setIncludePhotos] = useState(true);
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null);

  const backup = async () => {
    setBusy('backup');
    try {
      const payload = await createBackup({ includePhotos });
      await deliverFile(JSON.stringify(payload), stampedFileName('cofrinho-backup', 'json'), 'application/json');
      await markBackupDone();
      toast(t('backup.created'), { tone: 'success' });
    } catch {
      toast(t('common.error'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    const file = await pickFile({ accept: '.json,application/json' });
    if (!file) return;
    setBusy('restore');
    try {
      const payload = parseBackup(await file.text());
      const summary = backupSummary(payload);
      const ok = await confirm({
        title: t('backup.restoreConfirm'),
        message: (
          <>
            <p>{t('backup.contents', summary)}</p>
            <p className="mt-2">{t('backup.restoreWarning')}</p>
          </>
        ),
        confirmLabel: t('backup.restore'),
        destructive: true,
      });
      if (!ok) return;
      await restoreBackup(payload);
      toast(t('backup.restored'), { tone: 'success' });
      navigate('/', { replace: true });
    } catch (error) {
      toast(error instanceof InvalidBackupError ? t('backup.invalid') : t('common.error'), { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title={t('backup.title')} back="/me">
      <div className="space-y-4 px-4">
        <Card className="flex flex-col items-center px-6 py-6 text-center">
          <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
            <CloudUpload className="size-7" aria-hidden />
          </span>
          <p className="text-sm text-muted">{settings.lastBackupAt ? t('backup.last', { date: format.dateTime(settings.lastBackupAt) }) : t('backup.never')}</p>
          <Button className="mt-4" block onClick={() => void backup()} disabled={busy !== null}>
            {busy === 'backup' ? <Spinner /> : t('backup.create')}
          </Button>
          <Button className="mt-2" variant="secondary" block icon={History} onClick={() => void restore()} disabled={busy !== null}>
            {busy === 'restore' ? <Spinner /> : t('backup.restore')}
          </Button>
        </Card>
        <Card>
          <SwitchRow title={t('backup.includePhotos')} checked={includePhotos} onChange={setIncludePhotos} />
        </Card>
        <InlineNotice icon={Info}>{t('backup.hint')}</InlineNotice>
      </div>
    </Page>
  );
}
