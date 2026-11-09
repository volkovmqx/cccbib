import { useSetting } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { loaderMarkup, voctocat } from '@/shared/branding';

const MARKUP: Record<string, string> = loaderMarkup;

export const Spinner = ({ variant, size }: { variant?: string; size?: string }) => {
  const t = useTranslation();
  const [spinnerStyle] = useSetting('spinnerStyle');
  const style = variant || spinnerStyle;
  return (
    <div
      className={`loading-spinner loading-spinner--inline loader-${style}`}
      style={size ? { '--s': size } as React.CSSProperties : undefined}
      role="status"
      aria-label={t('Loading')}
      dangerouslySetInnerHTML={style === 'voctocat' ? { __html: voctocat } : MARKUP[style] ? { __html: MARKUP[style] } : undefined}
    />
  );
};

export const LoadingScreen = ({ height = '100vh' }: { height?: string }) => (
  <div className="loadingScreen" style={{ height }}>
    <Spinner />
  </div>
);
