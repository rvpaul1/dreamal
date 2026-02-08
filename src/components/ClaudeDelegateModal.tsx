import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface ClaudeDelegateModalProps {
  instructions: string;
  onConfirm: (sessionId: string) => void;
  onCancel: () => void;
}

export function ClaudeDelegateModal({
  instructions,
  onConfirm,
  onCancel,
}: ClaudeDelegateModalProps) {
  const [gitDirectory, setGitDirectory] = useState<string>("");
  const [instructionsMode, setInstructionsMode] = useState<"inline" | "file">(
    "inline"
  );
  const [inlineInstructions, setInlineInstructions] = useState<string>("");
  const [instructionsFilePath, setInstructionsFilePath] = useState<string>("");
  const [instructionsFileContent, setInstructionsFileContent] = useState<string>("");
  const [baseBranch, setBaseBranch] = useState<string>("main");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelectGitDirectory = async () => {
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select Git Repository",
      });
      if (selected) {
        setGitDirectory(selected as string);
        setError(null);
      }
    } catch (e) {
      setError(`Failed to select directory: ${e}`);
    }
  };

  const handleSelectInstructionsFile = async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        title: "Select Instructions File",
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (selected) {
        setInstructionsFilePath(selected as string);
        const content = await invoke<string>("read_entry", {
          filepath: selected,
        });
        setInstructionsFileContent(content);
        setError(null);
      }
    } catch (e) {
      setError(`Failed to read file: ${e}`);
    }
  };

  const handleSubmit = async () => {
    if (!gitDirectory) {
      setError("Please select a git repository");
      return;
    }

    if (instructionsMode === "file" && !instructionsFilePath) {
      setError("Please select an instructions file");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const sessionId = await invoke<string>("spawn_claude_session", {
        gitDirectory,
        instructions,
        additionalInstructions:
          instructionsMode === "inline" ? inlineInstructions : null,
        instructionsFileContent:
          instructionsMode === "file" ? instructionsFileContent : null,
        baseBranch,
      });
      onConfirm(sessionId);
    } catch (e) {
      setError(`Failed to start session: ${e}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle} onMouseDown={(e) => e.stopPropagation()}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>Delegate to Claude</h2>

        <div style={sectionStyle}>
          <label style={labelStyle}>Instructions from entry:</label>
          <div style={previewStyle}>{instructions}</div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Git Repository *</label>
          <div style={rowStyle}>
            <input
              type="text"
              value={gitDirectory}
              readOnly
              placeholder="Select a git repository..."
              style={inputStyle}
            />
            <button onClick={handleSelectGitDirectory} style={buttonStyle}>
              Browse
            </button>
          </div>
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Base Branch</label>
          <input
            type="text"
            value={baseBranch}
            onChange={(e) => setBaseBranch(e.target.value)}
            placeholder="main"
            style={inputStyle}
          />
        </div>

        <div style={sectionStyle}>
          <label style={labelStyle}>Additional Instructions</label>
          <div style={toggleContainerStyle}>
            <button
              onClick={() => setInstructionsMode("inline")}
              style={{
                ...toggleButtonStyle,
                ...(instructionsMode === "inline" ? activeToggleStyle : {}),
              }}
            >
              Inline
            </button>
            <button
              onClick={() => setInstructionsMode("file")}
              style={{
                ...toggleButtonStyle,
                ...(instructionsMode === "file" ? activeToggleStyle : {}),
              }}
            >
              From File
            </button>
          </div>

          {instructionsMode === "inline" ? (
            <textarea
              value={inlineInstructions}
              onChange={(e) => setInlineInstructions(e.target.value)}
              placeholder="Add any additional context or instructions..."
              style={textareaStyle}
              rows={4}
            />
          ) : (
            <div style={rowStyle}>
              <input
                type="text"
                value={instructionsFilePath}
                readOnly
                placeholder="Select a .md file..."
                style={inputStyle}
              />
              <button onClick={handleSelectInstructionsFile} style={buttonStyle}>
                Browse
              </button>
            </div>
          )}
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={actionsStyle}>
          <button onClick={onCancel} style={cancelButtonStyle}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              ...submitButtonStyle,
              opacity: isSubmitting ? 0.6 : 1,
            }}
          >
            {isSubmitting ? "Delegating..." : "Delegate"}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#1e1e1e",
  borderRadius: "8px",
  padding: "24px",
  width: "500px",
  maxWidth: "90vw",
  maxHeight: "90vh",
  overflow: "auto",
  border: "1px solid #333",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 20px 0",
  fontSize: "1.25rem",
  fontWeight: 600,
  color: "#fff",
};

const sectionStyle: React.CSSProperties = {
  marginBottom: "16px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "#aaa",
};

const previewStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "#2a2a2a",
  borderRadius: "4px",
  fontSize: "0.875rem",
  color: "#ddd",
  whiteSpace: "pre-wrap",
  maxHeight: "80px",
  overflow: "auto",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  backgroundColor: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "0.875rem",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  backgroundColor: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "0.875rem",
  resize: "vertical",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "#3a3a3a",
  border: "1px solid #555",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const toggleContainerStyle: React.CSSProperties = {
  display: "flex",
  gap: "4px",
  marginBottom: "8px",
};

const toggleButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  backgroundColor: "#2a2a2a",
  border: "1px solid #444",
  borderRadius: "4px",
  color: "#888",
  fontSize: "0.75rem",
  cursor: "pointer",
};

const activeToggleStyle: React.CSSProperties = {
  backgroundColor: "#6366f1",
  borderColor: "#6366f1",
  color: "#fff",
};

const errorStyle: React.CSSProperties = {
  padding: "8px 12px",
  backgroundColor: "rgba(239, 68, 68, 0.2)",
  border: "1px solid rgba(239, 68, 68, 0.4)",
  borderRadius: "4px",
  color: "#ef4444",
  fontSize: "0.875rem",
  marginBottom: "16px",
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "20px",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "transparent",
  border: "1px solid #555",
  borderRadius: "4px",
  color: "#aaa",
  fontSize: "0.875rem",
  cursor: "pointer",
};

const submitButtonStyle: React.CSSProperties = {
  padding: "8px 20px",
  backgroundColor: "#6366f1",
  border: "none",
  borderRadius: "4px",
  color: "#fff",
  fontSize: "0.875rem",
  fontWeight: 500,
  cursor: "pointer",
};
