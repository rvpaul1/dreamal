import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Document } from "./documentModel";
import { serializeToMDX, getFilePath, updateModified } from "./documentModel";

const DEBOUNCE_MS = 3000;

interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  error?: string;
}

export function usePersistence(
  document: Document,
  onMetadataUpdate: (metadata: Document["metadata"]) => void
) {
  const [journalDir, setJournalDir] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDocRef = useRef<Document | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    invoke<string>("ensure_journal_dir")
      .then((dir) => {
        if (isMountedRef.current) {
          setJournalDir(dir);
        }
      })
      .catch((err) => {
        console.error("Failed to initialize journal directory:", err);
        if (isMountedRef.current) {
          setSaveState({ status: "error", error: String(err) });
        }
      });
  }, []);

  const saveToFile = useCallback(
    async (doc: Document) => {
      if (!journalDir) {
        return;
      }

      const updatedDoc = updateModified(doc);
      onMetadataUpdate(updatedDoc.metadata);

      setSaveState({ status: "saving" });

      try {
        const mdx = serializeToMDX(updatedDoc);
        const filepath = getFilePath(journalDir, updatedDoc.metadata.created);

        await invoke("write_entry", { filepath, content: mdx });

        if (isMountedRef.current) {
          setSaveState({ status: "saved" });
        }
      } catch (err) {
        console.error("Failed to save entry:", err);
        if (isMountedRef.current) {
          setSaveState({ status: "error", error: String(err) });
        }
      }
    },
    [journalDir, onMetadataUpdate]
  );

  const scheduleSave = useCallback(
    (doc: Document) => {
      pendingDocRef.current = doc;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingDocRef.current) {
          saveToFile(pendingDocRef.current);
          pendingDocRef.current = null;
        }
      }, DEBOUNCE_MS);
    },
    [saveToFile]
  );

  const flushSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    if (pendingDocRef.current) {
      saveToFile(pendingDocRef.current);
      pendingDocRef.current = null;
    }
  }, [saveToFile]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unlisten = listen("tauri://close-requested", () => {
      flushSave();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [flushSave]);

  const contentRef = useRef(document.editor.lines);
  useEffect(() => {
    const prevContent = contentRef.current;
    const newContent = document.editor.lines;

    if (prevContent !== newContent && journalDir) {
      scheduleSave(document);
    }
    contentRef.current = newContent;
  }, [document.editor.lines, document, journalDir, scheduleSave]);

  return {
    saveState,
    flushSave,
    journalDir,
  };
}
