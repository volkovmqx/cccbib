import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { IconPlayerPause, IconPlayerPauseFilled, IconVolume } from '@tabler/icons-react';
import { ButtonIcon, osdIcon } from './osdIcon';

const classes = (node: React.ReactNode) => [...render(<div>{node}</div>).container.querySelectorAll('svg')].map((svg) => svg.getAttribute('class'));

test('Outlined shows the outline icon only, Filled the filled one, and Dynamic keeps both for the stylesheet to swap', () => {
  const outlined = osdIcon('outlined', IconPlayerPause, IconPlayerPauseFilled);
  expect(classes(outlined.icon)).toEqual(['tabler-icon tabler-icon-player-pause']);
  expect(outlined.activeIcon).toBeUndefined();
  const filled = osdIcon('filled', IconPlayerPause, IconPlayerPauseFilled);
  expect(classes(filled.icon)).toEqual(['tabler-icon tabler-icon-player-pause-filled']);
  expect(filled.activeIcon).toBeUndefined();
  const dynamic = osdIcon('dynamic', IconPlayerPause, IconPlayerPauseFilled);
  expect(classes(dynamic.icon)).toEqual(['tabler-icon tabler-icon-player-pause']);
  expect(classes(dynamic.activeIcon)).toEqual(['tabler-icon tabler-icon-player-pause-filled']);
  expect(osdIcon('anything else', IconPlayerPause, IconPlayerPauseFilled).activeIcon).toBeUndefined();
});

test('an icon without a filled version gets a heavier line instead', () => {
  const weight = (node: React.ReactNode) => (render(<div>{node}</div>).container.querySelector('svg') as SVGElement).style.strokeWidth;
  expect(weight(osdIcon('outlined', IconVolume).icon)).toBe('');
  expect(weight(osdIcon('filled', IconVolume).icon)).toBe('2.8');
  const dynamic = osdIcon('dynamic', IconVolume);
  expect(weight(dynamic.icon)).toBe('');
  expect(weight(dynamic.activeIcon)).toBe('2.8');
});

test('a button icon without a second icon is rendered as it is and with one it is wrapped for the swap', () => {
  const single = render(<ButtonIcon icon={<i data-icon="one" />} />);
  expect(single.container.querySelector('.playerUI__icon')).not.toBeInTheDocument();
  expect(single.container.querySelector('[data-icon="one"]')).toBeInTheDocument();
  const pair = render(<ButtonIcon icon={<i data-icon="one" />} activeIcon={<i data-icon="two" />} />);
  expect(pair.container.querySelector('.playerUI__icon--idle [data-icon="one"]')).toBeInTheDocument();
  expect(pair.container.querySelector('.playerUI__icon--active [data-icon="two"]')).toBeInTheDocument();
});
