import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons/faCheck';
import { LANGUAGE_NAMES } from '../../constants';

export const SelectorModal = React.memo(function SelectorModal({
  title,
  options,
  selectedIndex,
  currentValue,
  onSelect,
  onClose,
  getLabel,
}) {
  const defaultGetLabel = (opt) => {
    if (opt === 'none') return 'None';
    return LANGUAGE_NAMES[opt] || opt;
  };

  const labelFn = getLabel || defaultGetLabel;

  return (
    <div className="languageSelector">
      <div className="languageSelector__overlay" onClick={onClose} />
      <div className="languageSelector__content">
        <h3 className="languageSelector__title">{title}</h3>
        <div className="languageSelector__list">
          {options.map((option, index) => (
            <div
              key={option}
              className={`languageSelector__item ${index === selectedIndex ? 'languageSelector__item--selected' : ''} ${option === currentValue ? 'languageSelector__item--current' : ''}`}
              onClick={() => onSelect(option)}
            >
              {labelFn(option)}
              {option === currentValue && <span className="languageSelector__current"><FontAwesomeIcon icon={faCheck} /></span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default SelectorModal;
