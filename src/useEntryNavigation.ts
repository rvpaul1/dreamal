import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Document } from "./documentModel";
import { parseFromMDX, getFilePath } from "./documentModel";

interface NavigationState {
  entries: string[];
  currentIndex: number;
  isLoading: boolean;
}

export function useEntryNavigation(
  document: Document,
  journalDir: string | null,
  onLoadEntry: (doc: Document, filepath: string) => void,
  flushSave: () => void
) {
  const [state, setState] = useState<NavigationState>({
    entries: [],
    currentIndex: -1,
    isLoading: false,
  });

  const currentFilepathRef = useRef<string | null>(null);

  useEffect(() => {
    if (journalDir) {
      currentFilepathRef.current = getFilePath(journalDir, document.metadata.created);
    }
  }, [journalDir, document.metadata.created]);

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

  const loadEntry = useCallback(
    async (filepath: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const content = await invoke<string>("read_entry", { filepath });
        const doc = parseFromMDX(content, filepath);
        currentFilepathRef.current = filepath;
        onLoadEntry(doc, filepath);
        setState((prev) => ({
          ...prev,
          currentIndex: prev.entries.indexOf(filepath),
          isLoading: false,
        }));
      } catch (err) {
        console.error("Failed to load entry:", err);
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [onLoadEntry]
  );

  const navigatePrev = useCallback(async () => {
    await refreshEntries();
    setState((prev) => {
      const targetIndex = prev.currentIndex - 1;
      if (targetIndex >= 0 && targetIndex < prev.entries.length) {
        flushSave();
        loadEntry(prev.entries[targetIndex]);
      }
      return prev;
    });
  }, [refreshEntries, loadEntry, flushSave]);

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
  }, [refreshEntries, loadEntry, flushSave]);

  const setCurrentFilepath = useCallback(
    (filepath: string) => {
      currentFilepathRef.current = filepath;
      setState((prev) => ({
        ...prev,
        currentIndex: prev.entries.indexOf(filepath),
      }));
    },
    []
  );

  return {
    entries: state.entries,
    currentIndex: state.currentIndex,
    isLoading: state.isLoading,
    navigatePrev,
    navigateNext,
    refreshEntries,
    setCurrentFilepath,
    hasPrev: state.currentIndex > 0,
    hasNext: state.currentIndex < state.entries.length - 1 && state.currentIndex >= 0,
  };
}
