import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

type SessionStatus = "initializing" | "working" | "completed" | "error";

interface SessionInfo {
  id: string;
  status: SessionStatus;
  pr_url: string | null;
  error_message: string | null;
  git_directory: string;
  instructions: string;
  created_at: number;
}

interface ClaudeStatusProps {
  sessionId: string;
}

const statusConfig = {
  initializing: {
    label: "Initializing...",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    color: "#6366f1",
    borderColor: "rgba(99, 102, 241, 0.4)",
  },
  working: {
    label: "Claude is working...",
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    color: "#eab308",
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  completed: {
    label: "Claude has finished. Click for PR",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  error: {
    label: "Error",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#ef4444",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
};

export function ClaudeStatus({ sessionId }: ClaudeStatusProps) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let pollInterval: number | null = null;

    const fetchStatus = async () => {
      try {
        const info = await invoke<SessionInfo>("get_session_status", {
          sessionId,
        });
        if (mounted) {
          setSessionInfo(info);
          setError(null);

          if (
            info.status === "completed" ||
            info.status === "error"
          ) {
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          }
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    };

    fetchStatus();
    pollInterval = window.setInterval(fetchStatus, 3000);

    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionId]);

  const handleClick = async () => {
    if (sessionInfo?.status === "completed" && sessionInfo.pr_url) {
      await openUrl(sessionInfo.pr_url);
    }
  };

  const status: SessionStatus = sessionInfo?.status ?? "initializing";
  const config = statusConfig[status];

  const isClickable = status === "completed" && sessionInfo?.pr_url;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "2px 10px",
    fontSize: "0.8em",
    fontWeight: 500,
    lineHeight: "1.5",
    backgroundColor: config.backgroundColor,
    color: config.color,
    border: `1px solid ${config.borderColor}`,
    borderRadius: "4px",
    verticalAlign: "middle",
    cursor: isClickable ? "pointer" : "default",
    transition: "all 0.2s ease",
  };

  if (error) {
    return (
      <span
        style={{
          ...baseStyle,
          backgroundColor: statusConfig.error.backgroundColor,
          color: statusConfig.error.color,
          borderColor: statusConfig.error.borderColor,
        }}
        title={error}
      >
        <ErrorIcon />
        Error: {error.slice(0, 30)}...
      </span>
    );
  }

  return (
    <span
      style={baseStyle}
      onClick={handleClick}
      title={
        status === "error"
          ? sessionInfo?.error_message ?? "Unknown error"
          : status === "completed"
          ? "Click to open PR"
          : sessionInfo?.instructions ?? ""
      }
    >
      {(status === "initializing" || status === "working") && <Spinner />}
      {status === "completed" && <CheckIcon />}
      {status === "error" && <ErrorIcon />}
      {status === "error" && sessionInfo?.error_message
        ? `Error: ${sessionInfo.error_message.slice(0, 30)}...`
        : config.label}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      style={{
        animation: "spin 1s linear infinite",
      }}
    >
      <style>
        {`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}
      </style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="10"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
