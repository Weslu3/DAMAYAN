"use client";
import { useState, useCallback } from "react";

export interface ToastMessage {
  id: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  duration?: number;
}

/**
 * Hook for managing toast notifications with queue support.
 */
export function useToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const show = useCallback(
    (
      message: string,
      options?: { type?: "info" | "success" | "error" | "warning"; duration?: number }
    ) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      const duration = options?.duration ?? 3000;

      setMessages((prev) => [...prev, { id, message, type: options?.type || "info", duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeMessage(id);
        }, duration);
      }

      return id;
    },
    []
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, show, removeMessage, clear };
}
