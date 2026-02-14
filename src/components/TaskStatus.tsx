interface TaskStatusProps {
  status?: "todo" | "in-progress" | "done" | "wont-do";
}

const statusConfig = {
  todo: {
    label: "To Do",
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    color: "#ef4444",
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  "in-progress": {
    label: "In Progress",
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    color: "#eab308",
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  done: {
    label: "Done",
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
    borderColor: "rgba(34, 197, 94, 0.4)",
  },
  "wont-do": {
    label: "Won't Do",
    backgroundColor: "rgba(156, 163, 175, 0.2)",
    color: "#9ca3af",
    borderColor: "rgba(156, 163, 175, 0.4)",
  },
};

export function TaskStatus({ status = "todo" }: TaskStatusProps) {
  const config = statusConfig[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0px 6px",
        fontSize: "0.75em",
        fontWeight: 500,
        lineHeight: "1.4",
        backgroundColor: config.backgroundColor,
        color: config.color,
        border: `1px solid ${config.borderColor}`,
        borderRadius: "9999px",
        verticalAlign: "middle",
      }}
    >
      {config.label}
    </span>
  );
}
