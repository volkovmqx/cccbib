import type { KeyboardContext, Selector } from './types';
import { useEffect, useRef } from 'react';

const isBack = (e: KeyboardEvent) => e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461;
const isStop = (e: KeyboardEvent) => e.keyCode === 413 || e.keyCode === 178;
const isPlay = (e: KeyboardEvent) => e.keyCode === 415;
const isPause = (e: KeyboardEvent) => e.keyCode === 19;
const isTogglePlay = (e: KeyboardEvent) => e.key === ' ' || e.key === 'Spacebar' || e.key === 'MediaPlayPause' || e.keyCode === 179;

function handleSelectorKey(e: KeyboardEvent, ctx: KeyboardContext) {
  const consume = () => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  const name = ctx.selector;

  if (e.key === 'ArrowDown') {
    consume();
    ctx.setSelectorIndex((prev) => (prev + 1) % ctx.selectorLength);
  } else if (e.key === 'ArrowUp') {
    consume();
    ctx.setSelectorIndex((prev) => (prev - 1 + ctx.selectorLength) % ctx.selectorLength);
  } else if (e.key === 'Enter') {
    consume();
    ctx.confirmSelector(ctx.selectorIndex);
    ctx.controls.focusButton(name!);
  } else if (isBack(e)) {
    consume();
    ctx.closeSelector();
    ctx.controls.focusButton(name!);
  }
}

function handleKey(e: KeyboardEvent, ref: React.RefObject<KeyboardContext>) {
  const ctx = ref.current;
  const { controls } = ctx;

  if (ctx.selector) {
    if (!isStop(e)) controls.show();
    handleSelectorKey(e, ctx);
    return;
  }

  const consume = () => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };

  if (isStop(e)) {
    consume();
    ctx.onClose();
    return;
  }

  if (isBack(e)) {
    consume();
    if (controls.focus.area !== 'none') controls.hide();
    else ctx.onClose();
    return;
  }

  if (!isPlay(e)) controls.show();

  const open = (name: Selector) => {
    ref.current = { ...ctx, selector: name };
    ctx.openSelector(name);
  };

  if (isPause(e)) {
    e.preventDefault();
    ctx.setPlaying(false);
    controls.focusButton('playpause');
  } else if (isPlay(e)) {
    e.preventDefault();
    controls.hide();
    requestAnimationFrame(() => ctx.setPlaying(true));
  } else if (isTogglePlay(e)) {
    e.preventDefault();
    ctx.setPlaying((prev) => !prev);
  } else if (e.key === 'ArrowDown') {
    consume();
    controls.focusProgress();
  } else if (e.key === 'ArrowUp') {
    consume();
    controls.focusButton('playpause');
  } else if (e.key === 'Enter' && controls.focus.area === 'buttons') {
    consume();
    const button = ctx.buttons.find((b) => b.id === controls.focus.id);
    if (button && !button.disabled) button.onPress();
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.key === 'ArrowRight' ? 1 : -1;
    if (controls.focus.area !== 'buttons') {
      ctx.seek(direction * 10);
    } else {
      const index = ctx.buttons.findIndex((b) => b.id === controls.focus.id);
      const next = (index + direction + ctx.buttons.length) % ctx.buttons.length;
      controls.focusButton(ctx.buttons[next].id);
    }
  } else if (e.keyCode === 113) {
    e.preventDefault();
    ctx.toggleMute();
  } else if ((e.keyCode === 799 || e.keyCode === 460) && ctx.hasSubtitles) {
    e.preventDefault();
    open('subtitle');
  } else if ((e.keyCode === 403 || e.keyCode === 457) && ctx.hasMultipleLanguages) {
    e.preventDefault();
    open('language');
  } else if (e.keyCode === 405) {
    e.preventDefault();
    open('aspect');
  }
}

export function usePlayerKeyboard(ctx: KeyboardContext) {
  const ref = useRef(ctx);
  ref.current = ctx;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => handleKey(e, ref);
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, []);
}

