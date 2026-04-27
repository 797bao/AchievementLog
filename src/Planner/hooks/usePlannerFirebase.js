import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update } from 'firebase/database';
import { database } from '../../firebase';

/* ─── Normalize Firebase data ───
   Firebase drops empty arrays ([] → null) and sometimes
   converts arrays to objects with numeric keys.           */

function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') return Object.values(val);
  return [];
}

function normalizeNode(node) {
  if (!node) return node;
  if (node.children !== undefined) {
    return {
      ...node,
      children: ensureArray(node.children).map(normalizeNode),
    };
  }
  return node;
}

function normalizeMilestones(raw) {
  const arr = ensureArray(raw);
  if (arr.length === 0) return null;

  return arr.map((m) => ({
    ...m,
    frames: ensureArray(m.frames).map((f) => ({
      ...f,
      systems: ensureArray(f.systems).map(normalizeNode),
    })),
    looseSystems: ensureArray(m.looseSystems).map(normalizeNode),
    looseTasks: ensureArray(m.looseTasks),
    arrows: ensureArray(m.arrows),
  }));
}

/* ─── Hook ─── */

export default function usePlannerFirebase(isOwner) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const hasLoadedRef = useRef(false);

  /* Load once on mount (only if owner — security rules block non-owners) */
  useEffect(() => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }

    get(ref(database, 'planner'))
      .then((snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          const milestones = normalizeMilestones(val.milestones);
          setData({
            milestones,
            taskOrder: val.taskOrder || {},
            activeMilestoneIdx: val.activeMilestoneIdx || 0,
            sidebarWidth: typeof val.sidebarWidth === 'number' ? val.sidebarWidth : undefined,
          });
        }
        hasLoadedRef.current = true;
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load planner data:', err);
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
  }, [isOwner]);

  /* Debounced save — 800ms after last change */
  const save = useCallback(
    (milestones, taskOrder, activeMilestoneIdx, sidebarWidth) => {
      if (!isOwner || !hasLoadedRef.current) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const payload = {
          milestones,
          taskOrder,
          activeMilestoneIdx,
          lastUpdated: Date.now(),
        };
        if (typeof sidebarWidth === 'number') payload.sidebarWidth = sidebarWidth;
        update(ref(database, 'planner'), payload).catch((err) => {
          console.error('Failed to save planner data:', err);
        });
      }, 800);
    },
    [isOwner]
  );

  /* Flush pending save immediately (e.g. before unmount) */
  const flush = useCallback(() => {
    // No-op — the timer will fire on its own.
    // Clearing on unmount to avoid writing after component gone.
  }, []);

  /* Cleanup timer on unmount */
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return { data, isLoading, save, flush };
}
