import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ListView } from './ListView';
import { Spinner, LoadingScreen } from './Spinner';
import { OfflineBanner } from './OfflineBanner';
import { ErrorBoundary } from './ErrorBoundary';
import { NavIcon, isFilled } from './NavIcon';
import { AppleGlyph, CatIcon } from './CatIcon';
import { setSetting } from '@/shared/config';
import { pointerMoved } from '@/shared/lib';
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
  expect(isFilled('pixelated', true)).toBe(false);
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

test('a jump from the first row to the last and back scrolls to the selected row once the window has moved', () => {
  const items = Array.from({ length: 400 }, (_, i) => ({ guid: String(i), title: `Item ${i}` }));
  const place = (row: HTMLElement) => (row.textContent === 'Item 399' ? 40000 : row.textContent === 'Item 0' && lastSeenScroll > 0 ? -30000 : 0);
  let lastSeenScroll = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains('listItem--selected') ? place(this) : 0;
    return { top, bottom: top + (this.classList.contains('listItem') ? 100 : 900), height: 100, width: 100, left: 0, right: 100, x: 0, y: top, toJSON() {} };
  });
  function List({ index }: { index: number }) {
    return <ListView title="Items" items={items} selectedIndex={index} setSelectedIndex={vi.fn()} onClose={() => {}} onSelect={() => {}}
      onFocusSidebar={() => {}} sidebarFocused={false} renderItem={item => item.title} className="testList" />;
  }
  const view = render(<List index={0} />);
  const list = view.container.querySelector('.testList__list') as HTMLElement;
  const atTop = list.scrollTop;
  view.rerender(<List index={399} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 399');
  expect(list.scrollTop - atTop).toBeGreaterThanOrEqual(39000);
  lastSeenScroll = list.scrollTop;
  view.rerender(<List index={0} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 0');
  expect(lastSeenScroll - list.scrollTop).toBeGreaterThanOrEqual(30000);
});

const longList = (selected: number) => {
  const items = Array.from({ length: 400 }, (_, i) => ({ guid: String(i), title: `Item ${i}` }));
  const props = { title: 'Items', items, selectedIndex: selected, setSelectedIndex: vi.fn(), onClose: () => {}, onSelect: () => {}, onFocusSidebar: () => {}, sidebarFocused: false, renderItem: (item: { title: string }) => item.title, className: 'testList' };
  return render(<ListView {...props} />);
};
const listOf = (view: ReturnType<typeof render>) => view.container.querySelector('.testList__list') as HTMLElement;
const firstRow = (view: ReturnType<typeof render>) => view.container.querySelector('.listItem')!.textContent;

test('scrolling by touch, scrollbar or wheel moves the row window to what is on screen, the selection stays where it is', () => {
  const view = longList(0);
  const list = listOf(view);
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: 900 });
  const scrollTo = (top: number) => { list.scrollTop = top; fireEvent.scroll(list); };
  expect(firstRow(view)).toBe('Item 0');
  scrollTo(120 * 140 - 450);
  expect(firstRow(view)).toBe('Item 65');
  expect(list.scrollTop).toBe(120 * 140 - 450);
  scrollTo(120 * 300);
  expect(firstRow(view)).toBe('Item 228');
  expect(view.container.querySelector('.listItem--selected')).not.toBeInTheDocument();
  scrollTo(0);
  expect(firstRow(view)).toBe('Item 0');
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 0');
});

test('a jump of the selection under a moving pointer does not drag the list back to the selected row, and a list that is loading again has nothing to measure', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const top = this.classList.contains('listItem--selected') ? 40000 : 0;
    return { top, bottom: top + 100, height: 100, width: 100, left: 0, right: 100, x: 0, y: top, toJSON() {} };
  });
  const items = Array.from({ length: 400 }, (_, i) => ({ guid: String(i), title: `Item ${i}` }));
  const List = ({ index, loading = false }: { index: number; loading?: boolean }) => <ListView title="Items" items={items} selectedIndex={index} setSelectedIndex={vi.fn()} onClose={() => {}} onSelect={() => {}}
    onFocusSidebar={() => {}} sidebarFocused={false} loading={loading} renderItem={item => item.title} className="testList" />;
  const view = render(<List index={0} />);
  const list = view.container.querySelector('.testList__list') as HTMLElement;
  const before = list.scrollTop;
  pointerMoved({ nativeEvent: new Event('mousemove'), clientX: 811, clientY: 812 });
  view.rerender(<List index={399} />);
  expect(view.container.querySelector('.listItem--selected')).toHaveTextContent('Item 399');
  expect(list.scrollTop).toBe(before);
  view.rerender(<List index={399} loading />);
  expect(view.container.querySelector('.testList__list')).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'a' });
});

test('the spacers stand for rows of the measured height, and the selected row is put back in view once the height is known', () => {
  const place = (row: HTMLElement) => [...row.parentElement!.querySelectorAll('.listItem')].indexOf(row) * 163;
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('listItem') ? place(this) : 0; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const list = this.closest('.testList__list') as HTMLElement | null;
    const row = this.classList.contains('listItem') && list;
    const spacer = list && (list.querySelector('div[aria-hidden]') as HTMLElement | null);
    const top = row ? (spacer ? parseFloat(spacer.style.height) : 0) + place(this) - list.scrollTop : 0;
    return { top, bottom: top + (row ? 163 : 900), height: row ? 163 : 900, width: 100, left: 0, right: 100, x: 0, y: top, toJSON() {} };
  });
  const view = longList(300);
  const list = listOf(view);
  expect((list.querySelector('div[aria-hidden]') as HTMLElement).style.height).toBe(`${225 * 163}px`);
  const selected = view.container.querySelector('.listItem--selected')!.getBoundingClientRect();
  expect(selected.top).toBeGreaterThanOrEqual(0);
  expect(selected.bottom).toBeLessThanOrEqual(900);
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

function watchedRows() {
  const observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; observed: Set<Element>; disconnect: () => void }[] = [];
  vi.stubGlobal('IntersectionObserver', class {
    observed = new Set<Element>();
    disconnect = vi.fn();
    constructor(public callback: IntersectionObserverCallback, public options?: IntersectionObserverInit) { observers.push(this); }
    observe(element: Element) { this.observed.add(element); }
    unobserve(element: Element) { this.observed.delete(element); }
  });
  const reach = (observer: (typeof observers)[number], ...targets: Element[]) => act(() => observer.callback(
    targets.map((target) => ({ target, isIntersecting: true })) as unknown as IntersectionObserverEntry[], observer as unknown as IntersectionObserver));
  return { observers, reach };
}

test('a list row is near once it comes within reach of the scroll area, and only that row renders again', () => {
  setSetting('uiLanguage', 'en');
  const { observers, reach } = watchedRows();
  const near = new Map<number, boolean>();
  const renderItem = vi.fn((item: { title: string }, index: number, isNear: boolean) => { near.set(index, isNear); return <span>{item.title}</span>; });
  const items = Array.from({ length: 6 }, (_, index) => ({ guid: `row-${index}`, title: `Row ${index}` }));
  const view = render(<ListView title="Items" items={items} selectedIndex={0} setSelectedIndex={vi.fn()} onClose={vi.fn()} onSelect={vi.fn()} onFocusSidebar={vi.fn()} sidebarFocused={false} renderItem={renderItem} className="testList" />);
  const rows = [...view.container.querySelectorAll('.listItem')];
  expect(observers).toHaveLength(1);
  expect(observers[0].options).toEqual({ root: view.container.querySelector('.testList__list'), rootMargin: '800px 0px' });
  expect([...observers[0].observed]).toEqual(rows);
  expect([...near.values()]).toEqual(Array(6).fill(false));
  renderItem.mockClear();
  reach(observers[0], rows[2]);
  expect(near.get(2)).toBe(true);
  expect([...near.values()].filter(Boolean)).toHaveLength(1);
  expect(renderItem).toHaveBeenCalledTimes(1);
  expect(observers[0].observed.has(rows[2])).toBe(false);
  view.unmount();
  expect(observers[0].disconnect).toHaveBeenCalled();
});

test('a list row that is left before it is reached is no longer watched, and a browser without observers shows every row at once', () => {
  setSetting('uiLanguage', 'en');
  const { observers } = watchedRows();
  const renderItem = vi.fn((item: { title: string }) => <span>{item.title}</span>);
  const items = Array.from({ length: 3 }, (_, index) => ({ guid: `row-${index}`, title: `Row ${index}` }));
  const props = { title: 'Items', setSelectedIndex: vi.fn(), selectedIndex: 0, onClose: vi.fn(), onSelect: vi.fn(), onFocusSidebar: vi.fn(), sidebarFocused: false, renderItem, className: 'testList' };
  const view = render(<ListView {...props} items={items} />);
  expect(observers[0].observed.size).toBe(3);
  view.rerender(<ListView {...props} items={items.slice(0, 1)} />);
  expect(observers[0].observed.size).toBe(1);
  view.unmount();
  vi.stubGlobal('IntersectionObserver', undefined);
  renderItem.mockClear();
  render(<ListView {...props} items={items} />);
  expect(renderItem.mock.calls.map((call) => (call as unknown[])[2])).toEqual([true, true, true]);
});

test('the Aqua theme paints the cat in the menu as a two tone blue squircle with fat black lines and keeps its accent play button, with its own gradient ids on every copy', () => {
  setSetting('themeMode', 'black');
  const view = render(<><CatIcon /><CatIcon /></>);
  expect(view.container.querySelector('.catIcon--aqua')).toBeNull();
  expect(view.container.querySelector('.catIcon__disc')).toBeInTheDocument();
  act(() => setSetting('themeMode', 'aqua'));
  const icons = view.container.querySelectorAll('.catIcon--aqua');
  expect(icons).toHaveLength(2);
  expect(view.container.querySelector('.catIcon__disc')).toBeNull();
  expect(icons[0].querySelectorAll('linearGradient')).toHaveLength(5);
  expect(icons[0].querySelectorAll('clipPath')).toHaveLength(4);
  expect(icons[0].querySelectorAll('[stroke="#131313"]')).toHaveLength(4);
  expect(icons[0].querySelector('.catIcon__play')).toBeInTheDocument();
  expect(icons[0].querySelector('circle[stroke]')).toBeNull();
  const drawn = [...icons[0].querySelectorAll('path')].map((path) => path.getAttribute('d'));
  const repeats = drawn.map((d) => drawn.filter((other) => other === d).length);
  expect(repeats.filter((count) => count === 3)).toHaveLength(3);
  expect(repeats.filter((count) => count === 4)).toHaveLength(4);
  const divider = icons[0].querySelector('path[fill="none"][stroke="#131313"][stroke-width="1.3"]');
  expect(divider?.getAttribute('d')).toMatch(/^M[\d.]+ -1C.*C.* 27.5$/);
  expect(icons[0].querySelectorAll('clipPath path')[0].getAttribute('d')).toContain(divider!.getAttribute('d')!.slice(divider!.getAttribute('d')!.indexOf('C')));
  const ids = [...view.container.querySelectorAll('.catIcon--aqua [id]')].map((node) => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  const refs = [...view.container.querySelectorAll('.catIcon--aqua *')].flatMap((node) => ['fill', 'clip-path'].map((name) => node.getAttribute(name) || '')).filter((value) => value.startsWith('url(#'));
  expect(refs.length).toBeGreaterThan(10);
  for (const ref of refs) expect(ids).toContain(ref.slice(5, -1));
  act(() => setSetting('iconVariant', 'pixelated'));
  expect(view.container.querySelectorAll('.catIcon--aqua')).toHaveLength(2);
  setSetting('iconVariant', 'dynamic');
  setSetting('themeMode', 'black');
});

test('the Kallisti and Eris themes swap the cat in the menu for the tilted golden apple with an upright play button cut out of it', () => {
  setSetting('themeMode', 'black');
  const view = render(<CatIcon />);
  expect(view.container.querySelector('.catIcon--apple')).toBeNull();
  for (const theme of ['kallisti', 'eris']) {
    act(() => setSetting('themeMode', theme));
    expect(view.container.querySelector('.catIcon--apple path[fill-rule="evenodd"]'), theme).toBeInTheDocument();
    expect(view.container.querySelector('g[transform*="rotate("]'), theme).toBeInTheDocument();
    expect(view.container.querySelector('mask'), theme).toBeNull();
  }
  act(() => setSetting('themeMode', 'terminal'));
  expect(view.container.querySelector('.catIcon--apple')).toBeNull();
  setSetting('themeMode', 'black');
});

test('the Pixelated icon variant draws the golden apple with its play button as crisp pixel art in the Kallisti and Eris themes and leaves the cat alone', () => {
  setSetting('iconVariant', 'pixelated');
  setSetting('themeMode', 'kallisti');
  const view = render(<CatIcon />);
  const svg = () => view.container.querySelector('.catIcon--pixel');
  for (const theme of ['kallisti', 'eris']) {
    act(() => setSetting('themeMode', theme));
    expect(svg(), theme).toHaveAttribute('shape-rendering', 'crispEdges');
    expect(svg(), theme).toHaveAttribute('viewBox', '0 0 16 16');
    expect(svg()?.querySelector('.catIcon__disc'), theme).toBeInTheDocument();
    expect(svg()?.querySelector('.catIcon__play'), theme).toBeInTheDocument();
  }
  act(() => setSetting('iconVariant', 'outlined'));
  expect(svg()).toBeNull();
  expect(view.container.querySelector('.catIcon--apple')).toBeInTheDocument();
  act(() => { setSetting('iconVariant', 'pixelated'); setSetting('themeMode', 'terminal'); });
  expect(view.container.querySelector('.catIcon--apple')).toBeNull();
  setSetting('iconVariant', 'dynamic');
  setSetting('themeMode', 'black');
});

test('the About glyph is a smooth apple, or crisp pixel art with the accent leaf when the icons are pixelated', () => {
  const smooth = render(<AppleGlyph pixelated={false} />);
  expect(smooth.container.querySelector('svg')).not.toHaveAttribute('shape-rendering');
  expect(smooth.container.querySelector('mask')).toBeInTheDocument();
  const pixel = render(<AppleGlyph pixelated />);
  const svg = pixel.container.querySelector('svg');
  expect(svg).toHaveAttribute('shape-rendering', 'crispEdges');
  expect(svg).toHaveAttribute('viewBox', '0 0 14 14');
  expect(pixel.container.querySelector('.appleGlyph__body')?.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  expect(pixel.container.querySelector('.appleGlyph__leaf')?.getAttribute('d')).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
});
