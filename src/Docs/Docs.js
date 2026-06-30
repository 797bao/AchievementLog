import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Docs.css';
import useDocsFirebase from './hooks/useDocsFirebase';
import DocsSidebar from './DocsSidebar';
import DocEditor from './DocEditor';
import DocToc from './DocToc';
import { uploadDocImage } from './helpers/imageUpload';
import { uploadDocVideo } from './helpers/videoUpload';

/* ─── Outer shell ─── */
export default function Docs({ isOwner, onExit }) {
  if (!isOwner) {
    return (
      <div className="docs">
        <div className="docs-loading">This area is private.</div>
      </div>
    );
  }
  return <DocsInner isOwner={isOwner} onExit={onExit} />;
}

/* ─── Inner component (renders once auth is resolved) ─── */
// localStorage keys for the resizable rails (per-device UI prefs).
const LS_LIST_W = 'docs.listW';
const LS_TOC_W = 'docs.tocW';
const DEFAULT_LIST_W = 240;
const DEFAULT_TOC_W = 200;
const MIN_LIST_W = 180; const MAX_LIST_W = 420;
const MIN_TOC_W = 140;  const MAX_TOC_W = 360;

function readStoredW(key, fallback, min, max) {
  try {
    const v = parseInt(window.localStorage.getItem(key) || '', 10);
    if (Number.isFinite(v)) return Math.max(min, Math.min(max, v));
  } catch (e) { /* ignore */ }
  return fallback;
}

function DocsInner({ isOwner, onExit }) {
  const { docs, docsOrder, isLoading, createDoc, saveDoc, deleteDoc, reorderDocs } = useDocsFirebase(isOwner);
  const [activeDocId, setActiveDocId] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved

  // Resizable rail widths.
  const [listW, setListW] = useState(() => readStoredW(LS_LIST_W, DEFAULT_LIST_W, MIN_LIST_W, MAX_LIST_W));
  const [tocW, setTocW]   = useState(() => readStoredW(LS_TOC_W,  DEFAULT_TOC_W,  MIN_TOC_W,  MAX_TOC_W));
  useEffect(() => { try { window.localStorage.setItem(LS_LIST_W, String(listW)); } catch (e) {} }, [listW]);
  useEffect(() => { try { window.localStorage.setItem(LS_TOC_W,  String(tocW));  } catch (e) {} }, [tocW]);

  // Auto-select the most recently updated doc once loaded (if any). If none
  // exist, leave it null — the editor area shows an empty state.
  useEffect(() => {
    if (isLoading) return;
    if (activeDocId && docs[activeDocId]) return;
    const ids = Object.keys(docs || {});
    if (ids.length === 0) return;
    const sorted = ids.sort((a, b) => (docs[b].updatedAt || 0) - (docs[a].updatedAt || 0));
    setActiveDocId(sorted[0]);
  }, [isLoading, docs, activeDocId]);

  const activeDoc = activeDocId ? docs[activeDocId] : null;

  // Title + content edit handlers — both go through saveDoc which debounces.
  const handleTitleChange = useCallback((newTitle) => {
    if (!activeDocId) return;
    setSaveState('saving');
    saveDoc(activeDocId, { title: newTitle });
    // The actual write is debounced; reflect the "saved" indicator a beat later.
    setTimeout(() => setSaveState('saved'), 800);
  }, [activeDocId, saveDoc]);

  const handleContentChange = useCallback((newContent) => {
    if (!activeDocId) return;
    setSaveState('saving');
    saveDoc(activeDocId, { content: newContent });
    setTimeout(() => setSaveState('saved'), 800);
  }, [activeDocId, saveDoc]);

  const handleNew = useCallback(() => {
    const id = createDoc();
    if (id) setActiveDocId(id);
  }, [createDoc]);

  const handleDelete = useCallback((docId) => {
    deleteDoc(docId);
    if (docId === activeDocId) setActiveDocId(null);
  }, [deleteDoc, activeDocId]);

  // Image upload — reuses the same Firebase Storage helper the planner uses,
  // so we don't have to set up a second pipeline.
  const handleImageUpload = useCallback(async (file) => {
    const { url } = await uploadDocImage(file);
    return url;
  }, []);

  const handleVideoUpload = useCallback(async (file) => {
    const { url } = await uploadDocVideo(file);
    return url;
  }, []);

  // Stable content reference — passed to the editor only when activeDocId
  // changes so the editor doesn't re-run setContent on every keystroke.
  const editorContent = useMemo(
    () => (activeDoc ? activeDoc.content : null),
    [activeDocId]   // intentionally tied to id only — DocEditor handles content updates internally
  );

  if (isLoading) {
    return (
      <div className="docs">
        <div className="docs-loading">Loading docs&hellip;</div>
      </div>
    );
  }

  return (
    <div className="docs">
      <DocsSidebar
        docs={docs}
        docsOrder={docsOrder}
        activeDocId={activeDocId}
        onSelect={setActiveDocId}
        onNew={handleNew}
        onDelete={handleDelete}
        onReorder={reorderDocs}
        onExit={onExit}
        width={listW}
        onResize={setListW}
        minWidth={MIN_LIST_W}
        maxWidth={MAX_LIST_W}
      />

      {/* TOC sits between the sidebar and main editor on the LEFT */}
      {activeDoc && (
        <DocToc
          content={activeDoc.content}
          width={tocW}
          onResize={setTocW}
          minWidth={MIN_TOC_W}
          maxWidth={MAX_TOC_W}
        />
      )}

      <main className="docs-main">
        {!activeDoc && (
          <div className="docs-empty-state">
            <div className="docs-empty-title">No doc selected</div>
            <div className="docs-empty-sub">
              Pick one from the sidebar, or
              <button className="docs-empty-link" onClick={handleNew}>start a new one</button>.
            </div>
          </div>
        )}

        {activeDoc && (
          <>
            <div className="docs-doc-header">
              <input
                className="docs-title-input"
                type="text"
                value={activeDoc.title || ''}
                placeholder="Untitled"
                onChange={(e) => handleTitleChange(e.target.value)}
                spellCheck={false}
              />
              <div className={`docs-save-indicator docs-save-${saveState}`}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
              </div>
            </div>

            <DocEditor
              key={activeDocId}
              content={editorContent}
              onChange={handleContentChange}
              onImageUpload={handleImageUpload}
              onVideoUpload={handleVideoUpload}
            />
          </>
        )}
      </main>
    </div>
  );
}
