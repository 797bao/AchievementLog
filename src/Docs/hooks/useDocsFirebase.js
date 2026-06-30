import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, get, update, set, remove, push } from 'firebase/database';
import { database } from '../../firebase';

/**
 * Owner-only persistence for the Docs section. Mirrors the pattern used by
 * usePlannerFirebase: load once on mount when isOwner, debounce saves.
 *
 * Data shape in Firebase:
 *   /docs/{docId} = {
 *     title: string,
 *     content: ProseMirror JSON object  (TipTap.getJSON())
 *     createdAt, updatedAt: ms epoch
 *   }
 */
export default function useDocsFirebase(isOwner) {
  const [docs, setDocs] = useState({}); // { [docId]: doc }
  // Explicit manual ordering: array of docIds in display order. Persisted
  // separately at /docs_order so editing a doc doesn't shuffle the sidebar.
  // Docs that don't appear in this array are treated as "new / orphan" and
  // get sorted to the end of the list by updatedAt.
  const [docsOrder, setDocsOrder] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const saveTimersRef = useRef({}); // per-doc debounced save timers
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }
    // Load docs and order in parallel.
    Promise.all([
      get(ref(database, 'docs')),
      get(ref(database, 'docs_order')),
    ])
      .then(([docsSnap, orderSnap]) => {
        if (docsSnap.exists()) {
          setDocs(docsSnap.val() || {});
        }
        if (orderSnap.exists()) {
          const v = orderSnap.val();
          // RTDB stores arrays as either real arrays or { 0:..., 1:... }; coerce.
          const arr = Array.isArray(v) ? v : Object.values(v || {});
          setDocsOrder(arr.filter(Boolean));
        }
        hasLoadedRef.current = true;
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load docs:', err);
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
  }, [isOwner]);

  // Writes the order array to Firebase. Used by every mutation that changes
  // the doc set (create / delete / reorder).
  const persistOrder = useCallback((nextOrder) => {
    if (!isOwner) return;
    set(ref(database, 'docs_order'), nextOrder).catch((e) => console.error('Save docs_order failed:', e));
  }, [isOwner]);

  /** Create a new empty doc. Returns its new id. New docs are added to the
   *  TOP of the order so the user can immediately see and start editing
   *  them; the manual order is preserved for everything else. */
  const createDoc = useCallback(() => {
    if (!isOwner) return null;
    const newRef = push(ref(database, 'docs'));
    const docId = newRef.key;
    const now = Date.now();
    const doc = {
      title: 'Untitled',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      createdAt: now,
      updatedAt: now,
    };
    setDocs((prev) => ({ ...prev, [docId]: doc }));
    set(newRef, doc).catch((e) => console.error('Create doc failed:', e));
    setDocsOrder((prev) => {
      const next = [docId, ...prev.filter((id) => id !== docId)];
      persistOrder(next);
      return next;
    });
    return docId;
  }, [isOwner, persistOrder]);

  /** Save a doc — debounced per-doc so heavy typing doesn't spam Firebase. */
  const saveDoc = useCallback((docId, patch) => {
    if (!isOwner || !hasLoadedRef.current) return;
    // Apply locally first (optimistic). Updates updatedAt automatically.
    setDocs((prev) => {
      const cur = prev[docId];
      if (!cur) return prev;
      return { ...prev, [docId]: { ...cur, ...patch, updatedAt: Date.now() } };
    });
    // Debounce the actual write
    if (saveTimersRef.current[docId]) clearTimeout(saveTimersRef.current[docId]);
    saveTimersRef.current[docId] = setTimeout(() => {
      // TipTap's getJSON() can produce nodes whose `attrs` use prototype-less
      // objects (Object.create(null)) — Firebase's validator calls
      // .hasOwnProperty on every key and blows up on those. JSON round-trip
      // strips the weird prototypes AND drops undefined values (which
      // Firebase also rejects). One stone, two birds.
      const payload = JSON.parse(JSON.stringify({ ...patch, updatedAt: Date.now() }));
      update(ref(database, `docs/${docId}`), payload)
        .catch((e) => console.error('Save doc failed:', e));
    }, 600);
  }, [isOwner]);

  /** Delete a doc. */
  const deleteDoc = useCallback((docId) => {
    if (!isOwner) return;
    setDocs((prev) => {
      const next = { ...prev };
      delete next[docId];
      return next;
    });
    remove(ref(database, `docs/${docId}`)).catch((e) => console.error('Delete doc failed:', e));
    setDocsOrder((prev) => {
      const next = prev.filter((id) => id !== docId);
      persistOrder(next);
      return next;
    });
  }, [isOwner, persistOrder]);

  /** Move a doc to a new position in the manual order. Accepts the dragged
   *  doc's id, a target doc id, and whether to drop before or after the
   *  target. The order array is rebuilt and persisted. */
  const reorderDocs = useCallback((fromId, toId, position /* 'before' | 'after' */) => {
    if (!isOwner) return;
    setDocsOrder((prev) => {
      // Make sure both ids are in the working set; any missing ones get
      // appended so we don't accidentally drop them.
      const set1 = new Set(prev);
      const knownIds = Object.keys(docs);
      const all = [...prev, ...knownIds.filter((id) => !set1.has(id))];
      const withoutFrom = all.filter((id) => id !== fromId);
      const targetIdx = withoutFrom.indexOf(toId);
      if (targetIdx < 0) return prev; // target gone, no-op
      const insertAt = position === 'after' ? targetIdx + 1 : targetIdx;
      const next = [...withoutFrom.slice(0, insertAt), fromId, ...withoutFrom.slice(insertAt)];
      persistOrder(next);
      return next;
    });
  }, [isOwner, docs, persistOrder]);

  // Clean up any pending timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimersRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  return { docs, docsOrder, isLoading, createDoc, saveDoc, deleteDoc, reorderDocs };
}
