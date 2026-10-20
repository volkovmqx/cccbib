import type { RemoteCommand } from '@/features/remote-control';
import { useEffect, useRef } from 'react';
import { onPlayerCommand } from '@/features/remote-control';

export function useRemoteControl(handler: (command: RemoteCommand) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => onPlayerCommand((command) => handlerRef.current(command)), []);
}
