import { Injectable, OnModuleDestroy } from '@nestjs/common';

interface TypingState {
  lastTypingAt: number;
  autoStopTimer: ReturnType<typeof setTimeout> | null;
}

type AutoStopCallback = (userId: string, conversationId: string) => void;

/**
 * Manages ephemeral per-user typing indicators entirely in memory.
 *
 * Debounce window : 2000 ms  — repeated isTyping:true within this window
 *                              updates lastTypingAt but does NOT reset the
 *                              auto-stop timer (avoids timer churn on fast typists).
 * Auto-stop timeout: 3000 ms — if no new typing event arrives, the server
 *                              emits isTyping:false on the client's behalf.
 *
 * NOTE: State is process-local. In a multi-instance deployment, auto-stop events
 * are only emitted by the instance that received the last typing event —
 * acceptable since typing indicators are best-effort UX.
 */
@Injectable()
export class TypingService implements OnModuleDestroy {
  private static readonly DEBOUNCE_MS = 2000;
  private static readonly AUTO_STOP_MS = 3000;

  // Key: `${userId}:${conversationId}`
  private readonly state = new Map<string, TypingState>();
  private autoStopCallback: AutoStopCallback | null = null;

  setAutoStopCallback(cb: AutoStopCallback): void {
    this.autoStopCallback = cb;
  }

  /**
   * Process an incoming typing event.
   * Returns whether the event should be forwarded to the other participant.
   */
  handleTyping(
    userId: string,
    conversationId: string,
    isTyping: boolean,
  ): { shouldForward: boolean } {
    const key = this.buildKey(userId, conversationId);

    if (!isTyping) {
      this.clearEntry(key);
      return { shouldForward: true };
    }

    const existing = this.state.get(key);
    const now = Date.now();

    if (existing) {
      // Within debounce window — update timestamp, leave existing timer running
      if (now - existing.lastTypingAt < TypingService.DEBOUNCE_MS) {
        existing.lastTypingAt = now;
        return { shouldForward: true };
      }
      // Gap exceeded debounce — treat as new typing session, reset timer
      this.clearEntry(key);
    }

    const timer = setTimeout(() => {
      this.state.delete(key);
      this.autoStopCallback?.(userId, conversationId);
    }, TypingService.AUTO_STOP_MS);

    this.state.set(key, { lastTypingAt: now, autoStopTimer: timer });
    return { shouldForward: true };
  }

  /**
   * Clear all typing state for a disconnecting user.
   * Returns conversationIds that had active state so the caller
   * can emit isTyping:false for each.
   */
  clearUserState(userId: string): string[] {
    const prefix = `${userId}:`;
    const affected: string[] = [];

    for (const key of this.state.keys()) {
      if (key.startsWith(prefix)) {
        affected.push(key.slice(prefix.length));
        this.clearEntry(key);
      }
    }

    return affected;
  }

  onModuleDestroy(): void {
    for (const key of Array.from(this.state.keys())) {
      this.clearEntry(key);
    }
  }

  private clearEntry(key: string): void {
    const entry = this.state.get(key);
    if (entry?.autoStopTimer) clearTimeout(entry.autoStopTimer);
    this.state.delete(key);
  }

  private buildKey(userId: string, conversationId: string): string {
    return `${userId}:${conversationId}`;
  }
}
