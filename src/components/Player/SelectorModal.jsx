import React, { useEffect, useRef } from 'react';
import { IconCheck } from '@tabler/icons-react';
import { LANGUAGE_NAMES } from '../../constants';
import { useTranslation } from '../../i18n';

export const SelectorModal = React.memo(function SelectorModal({
  title,
  options,
  selectedIndex,
  currentValue,
  onSelect,
  onClose,
  getLabel,
}) {
  const t = useTranslation();
  const defaultGetLabel = (opt) => {
    if (opt === 'none') return t('None');
    return t(LANGUAGE_NAMES[opt] || opt);
  };

  const labelFn = getLabel || defaultGetLabel;
  const selectedRef = useRef(null);

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

export default SelectorModal;
