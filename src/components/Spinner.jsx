import React from 'react';
import { useSetting } from '../settings';
import { useTranslation } from '../i18n';
import voctocat from '../assets/voctocat.html';

const MARKUP = { bars: '<i></i><i></i><i></i><i></i><i></i>' };

export const Spinner = ({ variant, size }) => {
  const t = useTranslation();
  const [spinnerStyle] = useSetting('spinnerStyle');
  const style = variant || spinnerStyle;
  return (
    <div
      className={`loading-spinner loading-spinner--inline loader-${style}`}
      style={size ? { '--s': size } : undefined}
      role="status"
      aria-label={t('Loading')}
      dangerouslySetInnerHTML={style === 'voctocat' ? { __html: voctocat } : MARKUP[style] ? { __html: MARKUP[style] } : undefined}
    />
  );
};

export const LoadingScreen = ({ height = '100vh' }) => (
  <div className="loadingScreen" style={{ height }}>
    <Spinner />
  </div>
);
