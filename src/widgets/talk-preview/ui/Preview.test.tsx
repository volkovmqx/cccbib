import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { Preview } from './Preview';
import { talk } from '../../../../tests/fixtures';
import { setSetting } from '@/shared/config';

beforeEach(() => {
  vi.useFakeTimers();
  setSetting('language', 'deu'); setSetting('previewImage', 'on');
});

test('the preview shows the title and the picture, first small and then sharp, and never a video', () => {
  const view = render(<Preview event={talk()} />);
  expect(screen.getByText('Test talk')).toBeVisible();
  expect(view.container.querySelector('video')).not.toBeInTheDocument();
  const pictures = () => view.container.querySelectorAll('.previewBackdrop__img');
  expect(pictures()).toHaveLength(1);
  act(() => { vi.advanceTimersByTime(250); });
  expect(pictures()).toHaveLength(2);
  expect(pictures()[1]).toHaveStyle({ opacity: 0 });
  fireEvent.load(pictures()[1]);
  expect(pictures()[1]).toHaveStyle({ opacity: 1 });
  expect(view.container.querySelector('video')).not.toBeInTheDocument();
});

test('a talk without a recording says so, and Off hides the picture and that note', () => {
  const view = render(<Preview event={talk({ guid: 'other', images: {}, videos: [], subtitles: undefined })} />);
  expect(screen.getByText('No recording available')).toBeVisible();
  expect(view.container.querySelector('.previewBackdrop')).toBeInTheDocument();
  act(() => { setSetting('previewImage', 'none'); });
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
  expect(screen.queryByText('No recording available')).not.toBeInTheDocument();
  view.rerender(<Preview event={talk()} />);
  expect(view.container.querySelector('.previewBackdrop')).not.toBeInTheDocument();
});

test('the language, subtitle and aspect marks show when the talk has them', () => {
  const value = talk({ subtitles: [{ url: 'eng.vtt', language: 'eng', mimeType: 'text/vtt' }], videos: [talk().videos[0], { ...talk().videos[0], language: 'eng' }] });
  const view = render(<Preview event={value} />);
  expect(view.container.querySelectorAll('.previewMeta__item').length).toBeGreaterThanOrEqual(5);
});
