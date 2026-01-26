import { useState, useEffect } from "react";

interface TimerProps {
  duration?: number;
  __onStateChange?: (props: Record<string, unknown>) => void;
  __isSelected?: boolean;
}

export function Timer({ duration = 60, __isSelected }: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;

    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setIsRunning(false);
          return 0;
        }
        return r - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, remaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (remaining > 0) {
      setIsRunning(!isRunning);
    } else {
      setRemaining(duration);
      setIsRunning(true);
    }
  };

  return (
    <span
      onClick={handleClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        backgroundColor: __isSelected ? "rgba(58, 93, 140, 0.4)" : "rgba(60, 60, 80, 0.5)",
        borderRadius: "6px",
        fontFamily: "monospace",
        fontSize: "0.95em",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "1.1em" }}>{isRunning ? "⏸" : remaining === 0 ? "↺" : "▶"}</span>
      <span>{formatTime(remaining)}</span>
    </span>
  );
}
