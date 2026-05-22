"use client";
import { useState, useEffect } from "react";

/**
 * Hook that returns a real-time formatted clock string.
 * Updates every second with the current Philippine time.
 */
export function useClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("en-PH", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
