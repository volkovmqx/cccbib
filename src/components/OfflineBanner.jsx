import React from 'react';
import { IconWifiOff } from '@tabler/icons-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner = React.memo(function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner">
      <IconWifiOff size={20} stroke={2} />
      <span>No internet connection</span>
    </div>
  );
});
