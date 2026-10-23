import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ListView } from './ListView';
import { Spinner, LoadingScreen } from './Spinner';
import { OfflineBanner } from './OfflineBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { NavIcon, isFilled } from './NavIcon';
import { setSetting } from '@/shared/config';
import { LOADER_STYLES, SPINNER_STYLES } from '@/shared/config/constants';
import { loaderMarkup } from '@/shared/branding';

test('spinners render accessible status and the configured animation', () => {
  const view = render(<Spinner />);
  expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  for (const variant of ['bars', 'ring', 'voctocat']) {
    view.rerender(<Spinner variant={variant} size="28px" />);
    expect(screen.getByRole('status')).toHaveClass(`loader-${variant}`);
    expect(screen.getByRole('status').style.getPropertyValue('--s')).toBe('28px');
  }
  view.rerender(<LoadingScreen height="100px" />);
  expect(view.container.firstChild).toHaveStyle({ height: '100px' });
});

test('every loading animation renders its own markup and the startup list adds the voctocat', () => {
  const view = render(<Spinner />);
  for (const { code } of SPINNER_STYLES) {
    view.rerender(<Spinner variant={String(code)} />);
    const status = screen.getByRole('status');
    expect(status).toHaveClass(`loader-${code}`);
    const expected = document.createElement('div');
    expected.innerHTML = (loaderMarkup as Record<string, string>)[String(code)] || '';
    expect(status.innerHTML, String(code)).toBe(expected.innerHTML);
  }
  view.rerender(<Spinner variant="defrag" />);
  expect(screen.getByRole('status').querySelectorAll('i')).toHaveLength(15);
  view.rerender(<Spinner variant="wave" />);
  expect(screen.getByRole('status').querySelectorAll('svg')).toHaveLength(2);
  expect(LOADER_STYLES.map(style => style.code)).toEqual(['voctocat', ...SPINNER_STYLES.map(style => style.code)]);
});

test('navigation icons support filled, outlined, and dynamic states', () => {
  expect(isFilled('filled', false)).toBe(true);
  expect(isFilled('dynamic', true)).toBe(true);
  expect(isFilled('dynamic', false)).toBe(false);
  expect(isFilled('outlined', true)).toBe(false);
  const view = render(<NavIcon name="search" filled={false} />);
  for (const name of ['search', 'popular']) {
    for (const filled of [true, false]) {
      view.rerender(<NavIcon name={name} filled={filled} size={20} />);
      expect(view.container.querySelector('svg')).toBeInTheDocument();
    }
  }
});

test('offline banner appears only while the browser is offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  const view = render(<OfflineBanner />);
  expect(view.container).toBeEmptyDOMElement();
  act(() => { window.dispatchEvent(new Event('offline')); });
  expect(view.container.textContent).toContain('No internet connection');
  act(() => { window.dispatchEvent(new Event('online')); });
  expect(view.container).toBeEmptyDOMElement();
});

test('error boundary reports rendering errors and displays recovery controls', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken(): never { throw Error('Render failed'); }
  const view = render(<ErrorBoundary><span>Good</span></ErrorBoundary>);
  expect(screen.getByText('Good')).toBeVisible();
  view.rerender(<ErrorBoundary><Broken /></ErrorBoundary>);
  expect(screen.getByText('Error: Render failed')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Reload Application' })).toBeVisible();
});

test('list view handles loading, errors, empty lists, and mouse selection', () => {
  setSetting('uiLanguage', 'en');
  const onSelect = vi.fn();
  const props = { title: 'Items', items: [{ guid: 'a', title: 'First' }, { slug: 'b', title: 'Second' }, { acronym: 'c', title: 'Third' }, { title: 'Fourth' }],
    selectedIndex: 0, setSelectedIndex: vi.fn(), onClose: vi.fn(), onSelect, onFocusSidebar: vi.fn(), sidebarFocused: false,
    renderItem: (item: { title: string }) => <span>{item.title}</span>, className: 'testList' };
  const view = render(<ListView {...props} loading />);
  expect(screen.getByRole('status')).toBeVisible();
  view.rerender(<ListView {...props} error="Offline" />);
  expect(screen.getByText('Error: Offline')).toBeVisible();
  view.rerender(<ListView {...props} items={[]} emptyMessage="Empty" emptyIcon={<i>Icon</i>} />);
  expect(screen.getByText('Empty')).toBeVisible();
  view.rerender(<ListView {...props} countLabel="4 items" />);
  fireEvent.click(screen.getByText('Second'));
  expect(onSelect).toHaveBeenCalledWith(props.items[1], 1);
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(props.items[0], 0);
});

test('list virtualization follows selection at both ends without rendering all items', () => {
  const items = Array.from({ length: 300 }, (_, i) => ({ guid: String(i), title: `Item ${i}` }));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { top: this.classList.contains('listItem') ? -20 : 0, bottom: 100, height: 120, width: 100, left: 0, right: 100, x: 0, y: 0, toJSON() {} };
  });
  const onSelect = vi.fn();
  function List({ initial }: { initial: number }) {
    const index = initial; const setIndex = vi.fn();
    return <ListView title="Items" items={items} selectedIndex={index} setSelectedIndex={setIndex} onClose={() => {}} onSelect={onSelect}
      onFocusSidebar={() => {}} sidebarFocused={false} renderItem={item => item.title} className="testList" />;
  }
  const view = render(<List initial={290} />);
  expect(view.container.querySelectorAll('.listItem').length).toBeLessThan(300);
  view.rerender(<List initial={130} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 130');
  view.rerender(<List initial={280} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 280');
  view.rerender(<List initial={0} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 0');
  fireEvent.keyDown(window, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith(items[0], 0);
});

test('error boundary reloads the application from its recovery button', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const reload = vi.fn();
  vi.stubGlobal('location', { ...window.location, reload });
  function Broken(): never { throw Error('Render failed'); }
  render(<ErrorBoundary><Broken /></ErrorBoundary>);
  fireEvent.click(screen.getByRole('button', { name: 'Reload Application' }));
  expect(reload).toHaveBeenCalledTimes(1);
});

test('list view scrolls a selected item below the visible area into view with padding', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const item = this.classList.contains('listItem');
    return { top: item ? 50 : 0, bottom: item ? 200 : 100, height: 150, width: 100, left: 0, right: 100, x: 0, y: 0, toJSON() {} };
  });
  const items = [{ guid: 'a', title: 'First' }, { guid: 'b', title: 'Second' }];
  const view = render(<ListView title="Items" items={items} selectedIndex={1} setSelectedIndex={vi.fn()} onClose={() => {}} onSelect={() => {}}
    onFocusSidebar={() => {}} sidebarFocused={false} renderItem={item => item.title} className="testList" />);
  expect((view.container.querySelector('.testList__list') as HTMLElement).scrollTop).toBeGreaterThanOrEqual(115);
});

test('list view selects the item under a moving pointer but not under a resting one', () => {
  const setSelectedIndex = vi.fn();
  render(<ListView title="Items" items={[{ guid: 'a', title: 'First' }, { guid: 'b', title: 'Second' }]} selectedIndex={0} setSelectedIndex={setSelectedIndex} onClose={() => {}}
    onSelect={() => {}} onFocusSidebar={() => {}} sidebarFocused={false} renderItem={item => <span>{item.title}</span>} className="testList" />);
  fireEvent.mouseMove(screen.getByText('Second'), { clientX: 71, clientY: 91 });
  expect(setSelectedIndex).toHaveBeenCalledWith(1);
  setSelectedIndex.mockClear();
  fireEvent.mouseMove(screen.getByText('Second'), { clientX: 71, clientY: 91 });
  expect(setSelectedIndex).not.toHaveBeenCalled();
});

test('a key press only renders the two list rows whose selection changed', () => {
  setSetting('uiLanguage', 'en');
  const renderItem = vi.fn((item: { title: string }) => <span>{item.title}</span>);
  const items = Array.from({ length: 8 }, (_, index) => ({ guid: `row-${index}`, title: `Row ${index}` }));
  const Harness = () => {
    const [selected, setSelected] = useState(0);
    return <ListView title="Items" items={items} selectedIndex={selected} setSelectedIndex={setSelected} onClose={vi.fn()} onSelect={vi.fn()} onFocusSidebar={vi.fn()} sidebarFocused={false} renderItem={renderItem} className="testList" />;
  };
  render(<Harness />);
  renderItem.mockClear();
  fireEvent.keyDown(window, { key: 'ArrowDown' });
  expect(renderItem).toHaveBeenCalledTimes(2);
  expect(document.querySelectorAll('.listItem--selected')).toHaveLength(1);
});
