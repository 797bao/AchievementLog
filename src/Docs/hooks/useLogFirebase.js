import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '../../firebase';

/**
 * Persistence for the structured daily Log inside the Docs section.
 *
 * Data shape in Firebase:
 *   /docs_log/{YYYY-MM-DD} = {
 *     planned: string,
 *     coreMechanics: string,
 *     gameFeel: string,
 *     visuals: string,
 *     ui: string,
 *     ideation: string,
 *     updatedAt: ms epoch
 *   }
 *
 * Every day from LOG_START_DATE to today gets a row in the UI whether or not
 * an entry exists yet; entries are created lazily on first edit.
 */
export const LOG_START_DATE = '2026-08-05';

export const LOG_TAGS = [
  { key: 'coreMechanics', label: 'Core Mechanics' },
  { key: 'gameFeel',      label: 'Game Feel' },
  { key: 'visuals',       label: 'Visuals' },
  { key: 'ui',            label: 'UI' },
  { key: 'ideation',      label: 'Ideation' },
];

export default function useLogFirebase(isOwner) {
  const [entries, setEntries] = useState({}); // { 'YYYY-MM-DD': entry }
  const [isLoading, setIsLoading] = useState(true);
  const saveTimersRef = useRef({});
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }
    get(ref(database, 'docs_log'))
      .then((snap) => {
        if (snap.exists()) setEntries(snap.val() || {});
        hasLoadedRef.current = true;
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load log:', err);
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
  }, [isOwner]);

  /** Patch one day's entry — debounced per-day like saveDoc. */
  const saveDay = useCallback((dateKey, patch) => {
    if (!isOwner || !hasLoadedRef.current) return;
    setEntries((prev) => ({
      ...prev,
      [dateKey]: { ...(prev[dateKey] || {}), ...patch, updatedAt: Date.now() },
    }));
    if (saveTimersRef.current[dateKey]) clearTimeout(saveTimersRef.current[dateKey]);
    saveTimersRef.current[dateKey] = setTimeout(() => {
      const payload = JSON.parse(JSON.stringify({ ...patch, updatedAt: Date.now() }));
      update(ref(database, `docs_log/${dateKey}`), payload)
        .catch((e) => console.error('Save log entry failed:', e));
    }, 600);
  }, [isOwner]);

  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  return { entries, isLoading, saveDay };
}
