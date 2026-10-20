import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { media } from '../../../../tests/fixtures';
import { Controls } from './Controls';
import { ProgressBar, formatClock } from './ProgressBar';
import { SelectorModal } from './SelectorModal';
import { setSetting } from '@/shared/config';

test.each([[NaN, '0:00'], [-1, '0:00'], [0, '0:00'], [65, '1:05'], [3601, '1:00:01']])('player clock formats %s', (seconds, expected) => {
  expect(formatClock(seconds)).toBe(expected);
});

test('progress reflects media events, remaining time, and pointer seeking', () => {
  const onSeek = vi.fn();
  const video = media(document.createElement('video'), { currentTime: 120 });
  const view = render(<ProgressBar video={null} focused={false} onSeek={onSeek} />);
  fireEvent.click(view.container.querySelector('.playerProgress__barWrapper')!, { clientX: 20 });
  expect(onSeek).not.toHaveBeenCalled();
  view.rerender(<ProgressBar video={video} focused onSeek={onSeek} />);
  expect(screen.getByText('2:00')).toBeInTheDocument();
  expect(screen.getByText('10:00')).toBeInTheDocument();
  const wrapper = view.container.querySelector('.playerProgress__barWrapper')!;
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 10, width: 100 } as DOMRect);
  fireEvent.click(wrapper, { clientX: 60 }); expect(onSeek).toHaveBeenCalledWith(300);
  act(() => { setSetting('osdTimeMode', 'remaining'); }); expect(screen.getByText('-8:00')).toBeInTheDocument();
  for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked']) fireEvent(video, new Event(event));
  media(video, { duration: Infinity }); fireEvent(video, new Event('durationchange'));
  expect(view.container.querySelector('.playerProgress')).toHaveClass('playerProgress--hidden');
  view.unmount();
});

test('controls group buttons, indicate focus, and execute actions', () => {
  const onPress = vi.fn();
  render(<Controls title="Title" subTitle="Description" buttons={[{ id: 'play', align: 'center', label: 'Play', icon: <i />, onPress }, { id: 'disabled', align: 'left', label: 'Disabled', icon: null, onPress, disabled: true }]}
    focus={{ area: 'buttons', id: 'play' }} video={null} onSeek={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Play' })); expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('playerUI__button--focused');
  expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
});

test('selector labels, current values, focus, and close actions are accessible', () => {
  const onSelect = vi.fn(); const onClose = vi.fn();
  const props = { title: 'Subtitles', options: ['none', 'eng', 'unknown'], selectedIndex: 0, currentValue: 'eng', onSelect, onClose };
  const view = render(<SelectorModal {...props} />);
  expect(screen.getByText('None')).toBeInTheDocument();
  fireEvent.click(screen.getByText('English')); expect(onSelect).toHaveBeenCalledWith('eng');
  fireEvent.click(view.container.querySelector('.picker__overlay')!); expect(onClose).toHaveBeenCalled();
  view.rerender(<SelectorModal {...props} selectedIndex={-1} getLabel={value => `Label ${value}`} />);
  expect(screen.getByText('Label unknown')).toBeInTheDocument();
});
