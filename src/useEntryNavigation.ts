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
  initialFilePath: string | null,
  journalDir: string | null,
  updateDocument: (doc: Document) => void,
  flushSave: () => void
) {
  const [state, setState] = useState<NavigationState>({
    entries: [],
    currentIndex: -1,
    isLoading: false,
  });

  const initialFilePathRef = useRef<string | null>(initialFilePath);
  const hasCheckedInitialEntry = useRef(false);
  const navigatingRef = useRef(false);

  useEffect(() => {
    initialFilePathRef.current = initialFilePath;
  }, [initialFilePath]);

  const refreshEntries = useCallback(async () => {
    try {
      const entries = await invoke<string[]>("list_entries");
      setState((prev) => {
        const currentPath = initialFilePathRef.current;
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
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        const content = await invoke<string>("read_entry", { filepath });
        const doc = parseFromMDX(content, filepath);
        initialFilePathRef.current = filepath;
        updateDocument(doc);
      } catch (err) {
        console.error("Failed to load entry:", err);
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [updateDocument]
  );

  const navigate = useCallback(
    async (delta: number) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      try {
        const entries = await invoke<string[]>("list_entries");
        const currentPath = initialFilePathRef.current;
        const currentIndex = currentPath ? entries.indexOf(currentPath) : -1;
        const resolvedIndex = currentIndex >= 0 ? currentIndex : entries.length;
        const targetIndex = resolvedIndex + delta;

        if (targetIndex >= 0 && targetIndex < entries.length) {
          flushSave();
          setState((prev) => ({ ...prev, entries, currentIndex: targetIndex }));
          await loadEntry(entries[targetIndex]);
        } else {
          setState((prev) => ({ ...prev, entries, currentIndex: resolvedIndex }));
        }
      } catch (err) {
        console.error("Failed to navigate:", err);
      } finally {
        navigatingRef.current = false;
      }
    },
    [loadEntry, flushSave]
  );

  const navigatePrev = useCallback(() => navigate(-1), [navigate]);
  const navigateNext = useCallback(() => navigate(1), [navigate]);

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
