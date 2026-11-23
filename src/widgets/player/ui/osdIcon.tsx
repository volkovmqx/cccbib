import type { Icon } from '@tabler/icons-react';
import type { CSSProperties, ReactNode } from 'react';

// An icon without a filled version gets a heavier line instead, like in the side menu
const HEAVY: CSSProperties = { strokeWidth: 2.8 };

// Outlined and Filled decide the icon, Dynamic is outlined and fills while the button is hovered or focused
export function osdIcon(variant: string, Outline: Icon, Solid?: Icon): { icon: ReactNode; activeIcon?: ReactNode } {
  const filled = Solid ? <Solid /> : <Outline style={HEAVY} />;
  if (variant === 'filled') return { icon: filled };
  if (variant === 'dynamic') return { icon: <Outline />, activeIcon: filled };
  return { icon: <Outline /> };
}

export function ButtonIcon({ icon, activeIcon }: { icon: ReactNode; activeIcon?: ReactNode }) {
  if (!activeIcon) return <>{icon}</>;
  return (
    <>
      <span className="playerUI__icon playerUI__icon--idle">{icon}</span>
      <span className="playerUI__icon playerUI__icon--active">{activeIcon}</span>
    </>
  );
}
