import { create } from 'zustand';
import type { CartAction, ChatMessage } from '../types';
import { api } from '../api/client';
import { useCart } from './cart';
import { applyActions } from '../lib/applyActions';

export type UiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: CartAction[];
  pending?: boolean;
  error?: string;
};

type ChatState = {
  messages: UiMessage[];
  pending: boolean;
  append: (msg: UiMessage) => void;
  replace: (id: string, patch: Partial<UiMessage>) => void;
  reset: () => void;
  send: (text: string) => Promise<void>;
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useChat = create<ChatState>((set, get) => ({
  messages: [],
  pending: false,
  append: (msg) => set({ messages: [...get().messages, msg] }),
  replace: (id, patch) =>
    set({
      messages: get().messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }),
  reset: () => set({ messages: [], pending: false }),
  send: async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMsg: UiMessage = { id: uid(), role: 'user', content: trimmed };
    const assistantId = uid();
    const pendingMsg: UiMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      pending: true,
    };

    set({
      messages: [...get().messages, userMsg, pendingMsg],
      pending: true,
    });

    // Build payload: strip ui-only fields, keep prior messages + new user turn.
    const history: ChatMessage[] = get()
      .messages.filter((m) => m.id !== assistantId && !m.pending && !m.error)
      .map((m) => ({ role: m.role, content: m.content }));

    const lines = useCart.getState().lines;

    try {
      const res = await api.chat({
        messages: history,
        cart: { lines },
      });
      // Diagnostic: prints to the Metro terminal so we can verify the phone
      // is receiving the new reply text (and not running a stale bundle).
      console.log('[chat] reply received:', JSON.stringify({
        replyLen: res.reply?.length ?? 0,
        replyPreview: (res.reply ?? '').slice(0, 80),
        actionCount: res.actions?.length ?? 0,
      }));
      get().replace(assistantId, {
        content: res.reply,
        actions: res.actions,
        pending: false,
      });
      // Apply only on success.
      applyActions(res.actions ?? []);
    } catch (e: unknown) {
      console.warn('[chat] send failed:', e);
      const message = e instanceof Error ? e.message : 'Unknown error';
      get().replace(assistantId, {
        content: "Sorry — I couldn't reach the assistant. Try again.",
        error: message,
        pending: false,
      });
    } finally {
      set({ pending: false });
    }
  },
}));
