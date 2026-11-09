import type { Talk } from './types';
import { useEffect } from 'react';

let focused: Talk | null = null;

export function readFocusedTalk() {
  return focused;
}

export function useFocusedTalk(talk: Talk | null | undefined, enabled: boolean) {
  useEffect(() => {
    if (!talk || !enabled) return undefined;
    focused = talk;
    return () => {
      if (focused === talk) focused = null;
    };
  }, [talk, enabled]);
}
