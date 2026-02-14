import { useState, useCallback, useEffect, useRef } from "react";

interface FindReplaceMatch {
  line: number;
  startCol: number;
  endCol: number;
}

interface FindReplaceProps {
  lines: string[];
  showReplace: boolean;
  initialSearchText?: string;
  onClose: () => void;
  onNavigateToMatch: (line: number, startCol: number, endCol: number) => void;
  onReplace: (match: FindReplaceMatch, replacement: string) => void;
  onReplaceAll: (searchText: string, replacement: string) => void;
  onToggleReplace: () => void;
}

function findAllMatches(lines: string[], searchText: string): FindReplaceMatch[] {
  if (!searchText) return [];
  const matches: FindReplaceMatch[] = [];
  const lowerSearch = searchText.toLowerCase();
  for (let i = 0; i < lines.length; i++) {
    const lowerLine = lines[i].toLowerCase();
    let startIndex = 0;
    while (true) {
      const found = lowerLine.indexOf(lowerSearch, startIndex);
      if (found === -1) break;
      matches.push({ line: i, startCol: found, endCol: found + searchText.length });
      startIndex = found + 1;
    }
  }
  return matches;
}

export function FindReplace({
  lines,
  showReplace,
  initialSearchText,
  onClose,
  onNavigateToMatch,
  onReplace,
  onReplaceAll,
  onToggleReplace,
}: FindReplaceProps) {
  const [searchText, setSearchText] = useState(initialSearchText ?? "");
  const [replaceText, setReplaceText] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  const matches = findAllMatches(lines, searchText);

  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, []);

  useEffect(() => {
    if (matches.length > 0) {
      const idx = Math.min(currentMatchIndex, matches.length - 1);
      setCurrentMatchIndex(idx);
      const match = matches[idx];
      onNavigateToMatch(match.line, match.startCol, match.endCol);
    }
  }, [searchText, lines]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(next);
    onNavigateToMatch(matches[next].line, matches[next].startCol, matches[next].endCol);
  }, [matches, currentMatchIndex, onNavigateToMatch]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prev);
    onNavigateToMatch(matches[prev].line, matches[prev].startCol, matches[prev].endCol);
  }, [matches, currentMatchIndex, onNavigateToMatch]);

  const handleReplace = useCallback(() => {
    if (matches.length === 0) return;
    const match = matches[currentMatchIndex];
    onReplace(match, replaceText);
  }, [matches, currentMatchIndex, replaceText, onReplace]);

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0 || !searchText) return;
    onReplaceAll(searchText, replaceText);
  }, [matches, searchText, replaceText, onReplaceAll]);

  const handleFindKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrev();
        } else {
          goToNext();
        }
      }
    },
    [onClose, goToNext, goToPrev]
  );

  const handleReplaceKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleReplace();
      }
    },
    [onClose, handleReplace]
  );

  return (
    <div style={{
      position: "fixed",
      top: 8,
      right: 8,
      background: "#2a2a2a",
      border: "1px solid #3a3a3a",
      borderRadius: 6,
      padding: "8px 10px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      zIndex: 200,
      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
      fontSize: 14,
    }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input
          ref={findInputRef}
          type="text"
          placeholder="Find"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleFindKeyDown}
          style={{
            background: "#1a1a1a",
            border: "1px solid #3a3a3a",
            borderRadius: 3,
            color: "#e0e0e0",
            padding: "3px 6px",
            width: 180,
            outline: "none",
            fontSize: 13,
          }}
        />
        <span style={{ color: "#888", fontSize: 12, minWidth: 50, textAlign: "center" }}>
          {matches.length > 0 ? `${currentMatchIndex + 1}/${matches.length}` : "No results"}
        </span>
        <button onClick={goToPrev} style={buttonStyle} title="Previous (Shift+Enter)">&#x25B2;</button>
        <button onClick={goToNext} style={buttonStyle} title="Next (Enter)">&#x25BC;</button>
        {!showReplace && (
          <button onClick={onToggleReplace} style={buttonStyle} title="Toggle Replace">&#x25BA;</button>
        )}
        <button onClick={onClose} style={buttonStyle} title="Close (Escape)">&times;</button>
      </div>
      {showReplace && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            placeholder="Replace"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={handleReplaceKeyDown}
            style={{
              background: "#1a1a1a",
              border: "1px solid #3a3a3a",
              borderRadius: 3,
              color: "#e0e0e0",
              padding: "3px 6px",
              width: 180,
              outline: "none",
              fontSize: 13,
            }}
          />
          <button onClick={handleReplace} style={buttonStyle} title="Replace">Replace</button>
          <button onClick={handleReplaceAll} style={buttonStyle} title="Replace All">All</button>
        </div>
      )}
    </div>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "#3a3a3a",
  border: "1px solid #4a4a4a",
  borderRadius: 3,
  color: "#e0e0e0",
  padding: "2px 8px",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: "1.4",
};

export { findAllMatches };
export type { FindReplaceMatch };
