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

const press = (target: Element, clientX: number) => {
  fireEvent.mouseDown(target, { clientX });
  fireEvent.mouseUp(window, { clientX });
};

test('progress reflects media events, remaining time, and pointer seeking', () => {
  const onSeek = vi.fn();
  const video = media(document.createElement('video'), { currentTime: 120 });
  const view = render(<ProgressBar video={null} focused={false} onSeek={onSeek} />);
  press(view.container.querySelector('.playerProgress__barWrapper')!, 20);
  expect(onSeek).not.toHaveBeenCalled();
  view.rerender(<ProgressBar video={video} focused onSeek={onSeek} />);
  expect(screen.getByText('2:00')).toBeInTheDocument();
  expect(screen.getByText('10:00')).toBeInTheDocument();
  const thumb = view.container.querySelector('.playerProgress__thumb') as HTMLElement;
  expect(thumb.style.transform).toBe('translateX(20%)');
  expect(thumb.style.left).toBe('');
  expect(thumb).toHaveClass('playerProgress__thumb--focused');
  const wrapper = view.container.querySelector('.playerProgress__barWrapper')!;
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 10, width: 100 } as DOMRect);
  press(wrapper, 60); expect(onSeek).toHaveBeenCalledWith(300);
  act(() => { setSetting('osdTimeMode', 'remaining'); }); expect(screen.getByText('-5:00')).toBeInTheDocument();
  for (const event of ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked']) fireEvent(video, new Event(event));
  media(video, { duration: Infinity }); fireEvent(video, new Event('durationchange'));
  expect(view.container.querySelector('.playerProgress')).toHaveClass('playerProgress--hidden');
  view.unmount();
});

test('the progress handle can be dragged: it follows the pointer within the bar and seeks once when it is dropped', () => {
  const onSeek = vi.fn();
  const video = media(document.createElement('video'), { currentTime: 120 });
  const view = render(<ProgressBar video={video} focused={false} onSeek={onSeek} />);
  const wrapper = view.container.querySelector('.playerProgress__barWrapper')!;
  const thumb = view.container.querySelector('.playerProgress__thumb') as HTMLElement;
  vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({ left: 10, width: 100 } as DOMRect);
  fireEvent.mouseDown(wrapper, { clientX: 20, button: 2 });
  expect(thumb).not.toHaveClass('playerProgress__thumb--focused');
  fireEvent.mouseDown(wrapper, { clientX: 20 });
  expect(thumb).toHaveClass('playerProgress__thumb--focused');
  expect(thumb.style.transform).toBe('translateX(10%)');
  expect(screen.getByText('1:00')).toBeInTheDocument();
  fireEvent.mouseMove(window, { clientX: 60 });
  expect(thumb.style.transform).toBe('translateX(50%)');
  expect(screen.getByText('5:00')).toBeInTheDocument();
  fireEvent.mouseMove(window, { clientX: 900 });
  expect(thumb.style.transform).toBe('translateX(100%)');
  fireEvent.mouseMove(window, { clientX: -40 });
  expect(thumb.style.transform).toBe('translateX(0%)');
  expect(onSeek).not.toHaveBeenCalled();
  fireEvent.mouseUp(window, { clientX: 85 });
  expect(onSeek).toHaveBeenCalledTimes(1);
  expect(onSeek).toHaveBeenCalledWith(450);
  expect(thumb).not.toHaveClass('playerProgress__thumb--focused');
  expect(thumb.style.transform).toBe('translateX(75%)');
  expect(screen.getByText('7:30')).toBeInTheDocument();
  fireEvent.mouseMove(window, { clientX: 20 });
  fireEvent.mouseUp(window, { clientX: 20 });
  expect(onSeek).toHaveBeenCalledTimes(1);
  expect(thumb.style.transform).toBe('translateX(75%)');
  fireEvent.mouseDown(wrapper, { clientX: 30 });
  view.unmount();
  fireEvent.mouseUp(window, { clientX: 30 });
  expect(onSeek).toHaveBeenCalledTimes(1);
});

test('controls group buttons, indicate focus, and execute actions', () => {
  const onPress = vi.fn();
  render(<Controls title="Title" buttons={[{ id: 'play', align: 'center', label: 'Play', icon: <i />, onPress }, { id: 'disabled', align: 'left', label: 'Disabled', icon: null, onPress, disabled: true }]}
    focus={{ area: 'buttons', id: 'play' }} video={null} onSeek={vi.fn()} />);
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.queryByText('Description')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Play' })); expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Play' })).toHaveClass('playerUI__button--focused');
  expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
});

test('controls show a focusable back button only when one is provided', () => {
  const onPress = vi.fn();
  const props = { title: 'Title', buttons: [], video: null, onSeek: vi.fn() };
  const view = render(<Controls {...props} focus={{ area: 'none', id: null }} />);
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  view.rerender(<Controls {...props} back={{ label: 'Back', onPress }} focus={{ area: 'none', id: null }} />);
  const back = screen.getByRole('button', { name: 'Back' });
  expect(back).toHaveClass('playerUI__back');
  expect(back.parentElement).toHaveClass('playerUI__top');
  expect(back.nextElementSibling).toContainElement(screen.getByText('Title'));
  expect(back).not.toHaveClass('playerUI__button--focused');
  fireEvent.click(back); expect(onPress).toHaveBeenCalledTimes(1);
  view.rerender(<Controls {...props} back={{ label: 'Back', onPress }} focus={{ area: 'back', id: null }} />);
  expect(screen.getByRole('button', { name: 'Back' })).toHaveClass('playerUI__button--focused');
});

test('selector labels, current values, focus, and close actions are accessible', () => {
  const onSelect = vi.fn(); const onClose = vi.fn();
  const props = { title: 'Subtitles', options: ['none', 'eng', 'unknown'], selectedIndex: 0, currentValue: 'eng', onSelect, onClose };
  const view = render(<SelectorModal {...props} />);
  expect(screen.getByText('None')).toBeInTheDocument();
  expect(view.container.querySelector('.picker__list')).toHaveAttribute('data-wheel', 'scroll');
  fireEvent.click(screen.getByText('English')); expect(onSelect).toHaveBeenCalledWith('eng');
  fireEvent.click(view.container.querySelector('.picker__overlay')!); expect(onClose).toHaveBeenCalled();
  view.rerender(<SelectorModal {...props} selectedIndex={-1} getLabel={value => `Label ${value}`} />);
  expect(screen.getByText('Label unknown')).toBeInTheDocument();
});

test('selector options follow a moving pointer when the player listens for it', () => {
  const onHover = vi.fn();
  const props = { title: 'Subtitles', options: ['none', 'eng'], selectedIndex: 0, currentValue: 'none', onSelect: vi.fn(), onClose: vi.fn() };
  const view = render(<SelectorModal {...props} />);
  fireEvent.mouseMove(screen.getByText('English'), { clientX: 12, clientY: 34 });
  view.rerender(<SelectorModal {...props} onHover={onHover} />);
  fireEvent.mouseMove(screen.getByText('English'), { clientX: 13, clientY: 35 });
  expect(onHover).toHaveBeenCalledTimes(1);
  expect(onHover).toHaveBeenCalledWith(1);
});

test('a hidden progress bar leaves the media events alone and catches up when it shows again', () => {
  const video = media(document.createElement('video'), { currentTime: 120 });
  const view = render(<ProgressBar video={video} focused={false} visible={false} onSeek={vi.fn()} />);
  expect(screen.getByText('2:00')).toBeInTheDocument();
  media(video, { currentTime: 300 });
  fireEvent(video, new Event('timeupdate'));
  expect(screen.queryByText('5:00')).not.toBeInTheDocument();
  view.rerender(<ProgressBar video={video} focused={false} visible onSeek={vi.fn()} />);
  expect(screen.getByText('5:00')).toBeInTheDocument();
  media(video, { currentTime: 360 });
  fireEvent(video, new Event('timeupdate'));
  expect(screen.getByText('6:00')).toBeInTheDocument();
});

test('a button with a filled icon renders it next to the outline icon so the stylesheet can swap them on hover and focus', () => {
  const buttons = [
    { id: 'skipback', align: 'center', label: 'Skip Back', icon: <svg data-icon="outline" />, activeIcon: <svg data-icon="filled" />, onPress: vi.fn() },
    { id: 'mute', align: 'right', label: 'Mute', icon: <svg data-icon="plain" />, onPress: vi.fn() },
  ];
  const view = render(<Controls title="Talk" buttons={buttons} focus={{ area: 'buttons', id: 'skipback' }} video={null} onSeek={vi.fn()} />);
  const skip = screen.getByRole('button', { name: 'Skip Back' });
  expect(skip.querySelector('.playerUI__icon--idle [data-icon="outline"]')).toBeInTheDocument();
  expect(skip.querySelector('.playerUI__icon--active [data-icon="filled"]')).toBeInTheDocument();
  const mute = screen.getByRole('button', { name: 'Mute' });
  expect(mute.querySelector('[data-icon="plain"]')).toBeInTheDocument();
  expect(mute.querySelector('.playerUI__icon')).not.toBeInTheDocument();
  view.unmount();
});

test('the back arrow follows the icon style: plain, heavier when filled, and heavier only while hovered or focused when dynamic', () => {
  const back = { label: 'Back', onPress: vi.fn() };
  const render3 = (variant: string) => {
    act(() => { setSetting('iconVariant', variant); });
    return render(<Controls title="Talk" buttons={[]} back={back} focus={{ area: 'none', id: null }} video={null} onSeek={vi.fn()} />);
  };
  const weights = (view: { container: HTMLElement }) => [...view.container.querySelectorAll('.playerUI__back svg')].map((svg) => (svg as SVGElement).style.strokeWidth);
  const outlined = render3('outlined'); expect(weights(outlined)).toEqual(['']); outlined.unmount();
  const filled = render3('filled'); expect(weights(filled)).toEqual(['2.8']); filled.unmount();
  const dynamic = render3('dynamic'); expect(weights(dynamic)).toEqual(['', '2.8']);
  expect(dynamic.container.querySelector('.playerUI__back .playerUI__icon--active')).toBeInTheDocument();
  dynamic.unmount();
  act(() => { setSetting('iconVariant', 'outlined'); });
});

