import React, { useEffect, useRef } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { LANGUAGE_NAMES } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';

export const SelectorModal = React.memo(function SelectorModal({
  title,
  options,
  selectedIndex,
  currentValue,
  onSelect,
  onClose,
  getLabel,
}: { title: string; options: string[]; selectedIndex: number; currentValue: string; onSelect: (value: string) => void; onClose: () => void; getLabel?: (value: string) => string }) {
  const t = useTranslation();
  const defaultGetLabel = (opt: string) => {
    if (opt === 'none') return t('None');
    return t(LANGUAGE_NAMES[opt] || opt);
  };

  const labelFn = getLabel || defaultGetLabel;
  const selectedRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (selectedRef.current) selectedRef.current.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return (
    <div className="picker">
      <div className="picker__overlay" onClick={onClose} />
      <div className="picker__panel">
        <h3 className="picker__title">{title}</h3>
        <div className="picker__list">
          {options.map((option, index) => (
            <div
              key={option}
              ref={index === selectedIndex ? selectedRef : null}
              className={`picker__item ${index === selectedIndex ? 'picker__item--selected' : ''} ${option === currentValue ? 'picker__item--current' : ''}`}
              onClick={() => onSelect(option)}
            >
              {labelFn(option)}
              {option === currentValue && <IconCheck />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

