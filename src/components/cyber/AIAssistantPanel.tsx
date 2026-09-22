// AIAssistantPanel — floating chat panel accessible from any view.
// When AI mode is enabled, a floating button appears in the bottom-right.
// Clicking it opens a chat panel where the user can ask the AI anything
// about their cybersecurity projects.
//
// The AI is server-side only. The panel sends messages to /api/ai/chat
// and displays the response. The AI never executes commands.

'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, X, Send, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/stores/app';
import { cn } from '@/lib/utils';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export function AIAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const view = useAppStore((s) => s.view);
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  // Check if AI is enabled
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const r = await fetch('/api/settings'); if (!r.ok) return null; const j = await r.json(); return j.data; },
    retry: false,
  });

  const aiEnabled = settings.data?.aiAssistanceEnabled ?? false;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Don't render if AI is disabled
  if (!aiEnabled) return null;

  async function send() {
    if (!input.trim() || sending) return;
    const userMsg: ChatMsg = { role: 'user', content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const context: any = { viewContext: view };
      if (activeProjectId) {
        // Could fetch project details here for richer context
        context.projectName = activeProjectId;
      }

      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: userMsg.content }],
          context,
        }),
      });
      const j = await r.json();

      if (j.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: j.data.response,
          timestamp: new Date().toISOString(),
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `⚠ Error: ${j.error?.message ?? 'AI request failed'}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠ Error: ${(e as Error).message}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all cyber-card-hover"
          aria-label="Open AI Assistant"
        >
          <Bot className="h-4 w-4" />
          <span className="text-xs font-mono">AI</span>
          <Sparkles className="h-3 w-3 animate-pulse" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-2rem)] flex flex-col rounded-lg bg-surface-2 border border-primary/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-surface-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary/90">AI Assistant</span>
              <span className="text-[9px] font-mono text-muted-foreground/40">SECURITY ADVISORY</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Close AI Assistant">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto cyber-scroll p-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="h-8 w-8 text-primary/20 mx-auto mb-2" />
                <div className="text-xs text-muted-foreground/60 mb-1">AI Assistant ready</div>
                <div className="text-[10px] text-muted-foreground/40">Ask about projects, CVEs, OWASP, compliance, or security findings.</div>
                <div className="mt-3 space-y-1">
                  <Suggestion text="Analyze my project's security" onClick={() => setInput("Analyze my project's security posture")} />
                  <Suggestion text="Explain OWASP A03 Injection" onClick={() => setInput("Explain OWASP A03 Injection in simple terms")} />
                  <Suggestion text="What is prompt injection?" onClick={() => setInput("What is prompt injection and how do I prevent it?")} />
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'bg-primary/10 border border-primary/20 text-foreground'
                    : 'bg-surface-3 border border-edge-subtle text-foreground/90'
                )}>
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  <div className="text-[8px] text-muted-foreground/30 font-mono mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2 justify-start">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10 border border-primary/20 shrink-0">
                  <Bot className="h-3 w-3 text-primary" />
                </div>
                <div className="rounded-lg px-3 py-2 bg-surface-3 border border-edge-subtle">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-edge-subtle p-2 flex gap-2 bg-surface-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about security, projects, CVEs…"
              className="text-xs bg-surface-2 border-edge-subtle"
              disabled={sending}
            />
            <Button size="icon" onClick={send} disabled={!input.trim() || sending} className="h-8 w-8 shrink-0">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Footer */}
          <div className="px-3 py-1 border-t border-edge-subtle bg-surface-3">
            <p className="text-[8px] text-muted-foreground/40 font-mono">
              AI is advisory only · Never executes commands · Output may be inaccurate
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function Suggestion({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="block w-full text-left text-[10px] px-2 py-1 rounded border border-edge-subtle bg-surface-2 hover:bg-surface-3 text-muted-foreground/70 hover:text-foreground transition-colors"
    >
      {text}
    </button>
  );
}
