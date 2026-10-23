import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { Sidebar } from './Sidebar';
import { setSetting } from '@/shared/config';

test('sidebar selects screens with keyboard and mouse and supports the logo setting', () => {
  vi.useFakeTimers();
  setSetting('uiLanguage', 'en'); setSetting('logoButton', 'off');
  const onSelectItem = vi.fn();
  const view = render(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused={false} />);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(onSelectItem).not.toHaveBeenCalled();
  view.rerender(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused />);
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowUp', 'Enter']) fireEvent.keyDown(window, { key });
  act(() => { vi.runOnlyPendingTimers(); });
  expect(onSelectItem).toHaveBeenLastCalledWith('settings');
  fireEvent.keyDown(window, { key: 'ArrowRight' });
  act(() => { vi.runOnlyPendingTimers(); });
  expect(onSelectItem).toHaveBeenLastCalledWith('recent');
  fireEvent.click(screen.getByText('Search'));
  expect(onSelectItem).toHaveBeenLastCalledWith('search');
  view.rerender(<Sidebar selectedItem="conference-id" onSelectItem={onSelectItem} focused />);
  expect(screen.getByText('Events').closest('.sidebarItem')).toHaveClass('sidebarItem--selected');
  act(() => { setSetting('logoButton', 'settings'); });
  expect(view.container.querySelector('.sidebarItem--brand')).toBeInTheDocument();
  view.rerender(<Sidebar selectedItem="settings" onSelectItem={onSelectItem} focused />);
  fireEvent.keyDown(window, { key: 'Enter' });
  act(() => { vi.runOnlyPendingTimers(); });
  expect(onSelectItem).toHaveBeenLastCalledWith('settings');
});

test('sidebar highlights the item under the pointer and returns to the current screen when it closes', () => {
  setSetting('uiLanguage', 'en'); setSetting('logoButton', 'off');
  const onSelectItem = vi.fn();
  const view = render(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused />);
  const item = (label: string) => screen.getByText(label).closest('.sidebarItem')!;
  expect(item('Home')).toHaveClass('sidebarItem--highlighted');
  fireEvent.mouseMove(item('Popular'), { clientX: 31, clientY: 201 });
  expect(item('Popular')).toHaveClass('sidebarItem--highlighted');
  expect(item('Home')).not.toHaveClass('sidebarItem--highlighted');
  fireEvent.mouseMove(item('Home'), { clientX: 31, clientY: 201 });
  expect(item('Popular')).toHaveClass('sidebarItem--highlighted');
  view.rerender(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused={false} />);
  view.rerender(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused />);
  expect(item('Home')).toHaveClass('sidebarItem--highlighted');
});

test('the menu only ever scrolls in height to keep the highlighted item in view, never sideways, and never scrolls into view by itself', () => {
  const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
  scrollIntoView.mockClear();
  const view = render(<Sidebar selectedItem="recent" onSelectItem={vi.fn()} focused={false} />);
  const bar = view.container.querySelector('.sidebar') as HTMLElement;
  bar.getBoundingClientRect = () => ({ top: 100, bottom: 300 } as DOMRect);
  const items = [...bar.querySelectorAll('.sidebarItem')] as HTMLElement[];
  const place = (top: number, bottom: number) => items.forEach((item) => { item.getBoundingClientRect = () => ({ top, bottom } as DOMRect); });
  bar.scrollTop = 50; bar.scrollLeft = 0;
  place(80, 160);
  view.rerender(<Sidebar selectedItem="recent" onSelectItem={vi.fn()} focused />);
  expect(bar.scrollTop).toBe(30);
  place(250, 340);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(bar.scrollTop).toBe(70);
  place(120, 200);
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(bar.scrollTop).toBe(70);
  expect(bar.scrollLeft).toBe(0);
  expect(scrollIntoView).not.toHaveBeenCalled();
});

test('the logo is the button for Settings or for Home and takes the place of that icon, never of both', () => {
  setSetting('uiLanguage', 'en');
  const onSelectItem = vi.fn();
  setSetting('logoButton', 'home');
  const view = render(<Sidebar selectedItem="search" onSelectItem={onSelectItem} focused={false} />);
  expect(view.container.querySelectorAll('.sidebarItem--brand')).toHaveLength(1);
  expect(screen.queryByText('Home')).not.toBeInTheDocument();
  expect(view.container.querySelector('.sidebar__brand')).not.toBeInTheDocument();
  fireEvent.click(view.container.querySelector('.sidebarItem--brand')!);
  expect(onSelectItem).toHaveBeenLastCalledWith('recent');
  fireEvent.click(view.container.querySelector('.sidebarItem--bottom')!);
  expect(onSelectItem).toHaveBeenLastCalledWith('settings');
  act(() => { setSetting('logoButton', 'settings'); });
  expect(screen.getByText('Home')).toBeInTheDocument();
  expect(view.container.querySelector('.sidebarItem--bottom')).not.toBeInTheDocument();
  fireEvent.click(view.container.querySelector('.sidebarItem--brand')!);
  expect(onSelectItem).toHaveBeenLastCalledWith('settings');
  act(() => { setSetting('logoButton', 'off'); });
  expect(view.container.querySelector('.sidebarItem--brand')).not.toBeInTheDocument();
  expect(view.container.querySelector('.sidebar__brand')).toBeInTheDocument();
  expect(screen.getByText('Home')).toBeInTheDocument();
  expect(view.container.querySelector('.sidebarItem--bottom')).toBeInTheDocument();
});

test.each([['off', 'recent', 'Home'], ['settings', 'settings', 'Settings'], ['home', 'recent', 'Home']])('on a phone or tablet the logo is the Home button unless Settings was chosen: %s', (chosen, target, label) => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addListener: vi.fn(), removeListener: vi.fn() }));
  setSetting('uiLanguage', 'en'); setSetting('logoButton', chosen);
  const onSelectItem = vi.fn();
  const view = render(<Sidebar selectedItem="search" onSelectItem={onSelectItem} focused={false} />);
  const brand = view.container.querySelector('.sidebarItem--brand') as HTMLElement;
  expect(brand.querySelector('.sidebarItem__label')).toHaveAttribute('aria-label', label);
  fireEvent.click(brand);
  expect(onSelectItem).toHaveBeenLastCalledWith(target);
  expect(view.container.querySelector('.sidebar__brand')).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});

test.each([[false, true], [true, false]])('the menu only grows and brightens when it is focused on a large screen: small %s', (small, grows) => {
  vi.stubGlobal('matchMedia', () => ({ matches: small, addListener: vi.fn(), removeListener: vi.fn() }));
  setSetting('uiLanguage', 'en'); setSetting('logoButton', 'off');
  const view = render(<Sidebar selectedItem="recent" onSelectItem={vi.fn()} focused />);
  expect(Boolean(view.container.querySelector('.sidebar--focused'))).toBe(grows);
  expect(view.container.querySelector('.sidebarItem--highlighted')).toBeInTheDocument();
  vi.unstubAllGlobals();
});

test('keys the menu does not use leave it alone', () => {
  setSetting('uiLanguage', 'en'); setSetting('logoButton', 'off');
  const onSelectItem = vi.fn();
  render(<Sidebar selectedItem="recent" onSelectItem={onSelectItem} focused />);
  fireEvent.keyDown(window, { key: 'x' });
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(onSelectItem).not.toHaveBeenCalled();
});
