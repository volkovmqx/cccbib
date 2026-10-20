import React from 'react';
import { IconWifiOff } from '@tabler/icons-react';
import { useOnlineStatus } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';

export const OfflineBanner = React.memo(function OfflineBanner() {
  const t = useTranslation();
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner">
      <IconWifiOff size={20} stroke={2} />
      <span>{t('No internet connection')}</span>
    </div>
  );
});
