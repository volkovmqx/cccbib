import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { usePageTitle } from './pageTitle';

const Screen = ({ subject }: { subject?: string | null }) => { usePageTitle(subject); return null; };

test('the title of a screen follows the app name and leaving the screen brings the earlier title back', () => {
  document.title = 'CCCBib';
  const outer = render(<Screen subject="Chaostreff Heidelberg" />);
  expect(document.title).toBe('CCCBib - Chaostreff Heidelberg');
  const inner = render(<Screen subject="A talk" />);
  expect(document.title).toBe('CCCBib - A talk');
  inner.rerender(<Screen subject="Another talk" />);
  expect(document.title).toBe('CCCBib - Another talk');
  inner.unmount();
  expect(document.title).toBe('CCCBib - Chaostreff Heidelberg');
  outer.unmount();
  expect(document.title).toBe('CCCBib');
});

test('a screen without a subject leaves the title alone', () => {
  document.title = 'CCCBib';
  const view = render(<Screen subject={undefined} />);
  expect(document.title).toBe('CCCBib');
  view.rerender(<Screen subject="" />);
  expect(document.title).toBe('CCCBib');
  view.unmount();
  expect(document.title).toBe('CCCBib');
});
