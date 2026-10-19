import { useEffect, useRef } from 'react';
import { onPlayerCommand } from '../../remote';

export function useRemoteControl(handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => onPlayerCommand((command) => handlerRef.current(command)), []);
}
