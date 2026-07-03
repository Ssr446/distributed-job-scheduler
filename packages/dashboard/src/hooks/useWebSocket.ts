import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';

export function useWebSocket<T = unknown>(
  event: string,
  handler: (data: T) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const wrappedHandler = (data: T) => handlerRef.current(data);
    socket.on(event, wrappedHandler);

    return () => {
      socket.off(event, wrappedHandler);
    };
  }, [event]);
}

export function useWebSocketEmit() {
  const emit = useCallback((event: string, data?: unknown) => {
    const socket = getSocket();
    socket.emit(event, data);
  }, []);

  return emit;
}
