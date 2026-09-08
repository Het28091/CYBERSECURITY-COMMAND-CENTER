// WebSocket client hook for real-time process events.
// Connects to io("/?XTransformPort=3003") per the platform skill.

import { useEffect, useRef, useState } from 'react';
import { io as ioClient, Socket } from 'socket.io-client';

export interface ProcEventClient {
  type: 'log' | 'status' | 'health' | 'done' | 'error';
  projectId: string;
  executionId: string;
  stream?: 'stdout' | 'stderr' | 'event';
  line?: string;
  status?: string;
  pid?: number;
  exitCode?: number;
  reason?: string;
  ts: string;
}

export function useProcWs(projectId?: string) {
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<ProcEventClient[]>([]);
  const [latest, setLatest] = useState<ProcEventClient | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = ioClient('/', { transports: ['websocket', 'polling'], query: { XTransformPort: '3003' } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('hello', () => setConnected(true));

    if (projectId) {
      const sub = () => socket.emit('subscribe', { projectId });
      socket.on('subscribed', sub);
      if (socket.connected) sub();
    }

    socket.on('event', (ev: ProcEventClient) => {
      // Filter by projectId on the client so global listeners can still
      // subscribe to everything.
      if (projectId && ev.projectId !== projectId) return;
      setLatest(ev);
      setEvents((prev) => {
        const next = [...prev, ev];
        // Cap to 1000 to avoid unbounded memory growth.
        return next.length > 1000 ? next.slice(-1000) : next;
      });
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [projectId]);

  return { connected, events, latest, clearEvents: () => setEvents([]) };
}
