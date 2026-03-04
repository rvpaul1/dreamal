import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Document } from "./documentModel";
import { parseFromMDX, isContentBlank } from "./documentModel";

interface NavigationState {
  entries: string[];
  currentIndex: number;
  isLoading: boolean;
}

export function useEntryNavigation(
  document: Document,
  journalDir: string | null,
  updateDocument: (doc: Document) => void,
  flushSave: () => void
) {
  const [state, setState] = useState<NavigationState>({
    entries: [],
    currentIndex: -1,
    isLoading: false,
  });

  const currentFilepathRef = useRef<string | null>(null);
  const hasCheckedInitialEntry = useRef(false);

  useEffect(() => {
    currentFilepathRef.current = document.metadata.filepath ?? null;
  }, [document.metadata.filepath]);

  const refreshEntries = useCallback(async () => {
    try {
      const entries = await invoke<string[]>("list_entries");
      setState((prev) => {
        const currentPath = currentFilepathRef.current;
        const newIndex = currentPath ? entries.indexOf(currentPath) : -1;
        return {
          ...prev,
          entries,
          currentIndex: newIndex >= 0 ? newIndex : entries.length,
        };
      });
    } catch (err) {
      console.error("Failed to list entries:", err);
    }
  }, []);

  useEffect(() => {
    if (journalDir) {
      refreshEntries();
    }
  }, [journalDir, refreshEntries]);

  useEffect(() => {
    if (!journalDir || hasCheckedInitialEntry.current) return;
    hasCheckedInitialEntry.current = true;

    async function checkLatestEntry() {
      try {
        const entries = await invoke<string[]>("list_entries");
        if (entries.length === 0) return;

        const latestEntry = entries[entries.length - 1];
        const content = await invoke<string>("read_entry", { filepath: latestEntry });

        if (isContentBlank(content)) {
          const doc = parseFromMDX(content, latestEntry);
          updateDocument(doc);
        }
      } catch (err) {
        console.error("Failed to check latest entry:", err);
      }
    }

    checkLatestEntry();
  }, [journalDir, updateDocument]);

  const loadEntry = useCallback(
    async (filepath: string) => {
      console.log("Load file" + filepath);
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const content = await invoke<string>("read_entry", { filepath });
        const doc = parseFromMDX(content, filepath);
        currentFilepathRef.current = filepath;
        updateDocument(doc);
      } catch (err) {
        console.error("Failed to load entry:", err);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [updateDocument, setState]
  );

  const navigatePrev = useCallback(async () => {
    await refreshEntries();
    setState((prev) => {
      const targetIndex = prev.currentIndex - 1;
      console.log("targetIndex: " + targetIndex);
      if (targetIndex >= 0 && targetIndex < prev.entries.length) {
        flushSave();
        loadEntry(prev.entries[targetIndex]);
        return {
          ...prev,
          currentIndex: targetIndex
        }
      }
      return prev;
    });
  }, [refreshEntries, loadEntry, flushSave, setState]);

  const navigateNext = useCallback(async () => {
    await refreshEntries();
    setState((prev) => {
      const targetIndex = prev.currentIndex + 1;
      if (targetIndex >= 0 && targetIndex < prev.entries.length) {
        flushSave();
        loadEntry(prev.entries[targetIndex]);
      }
      return prev;
    });
  }, [refreshEntries, loadEntry, flushSave, setState]);

  return {
    entries: state.entries,
    currentIndex: state.currentIndex,
    isLoading: state.isLoading,
    navigatePrev,
    navigateNext,
    refreshEntries,
    hasPrev: state.currentIndex > 0,
    hasNext: state.currentIndex < state.entries.length - 1 && state.currentIndex >= 0,
  };
}
