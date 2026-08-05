import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './Docs.css';
import useDocsFirebase from './hooks/useDocsFirebase';
import useLogFirebase from './hooks/useLogFirebase';
import DocsSidebar from './DocsSidebar';
import DocEditor from './DocEditor';
import DocToc from './DocToc';
import { LogRail, LogDayPage, todayKey } from './LogView';
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
  const { entries: logEntries, saveDay: saveLogDay } = useLogFirebase(isOwner);
  const [activeDocId, setActiveDocId] = useState(null);
  // Structured Log view: null = normal docs, a 'YYYY-MM-DD' string = that
  // day's template page (the month/day rail stays visible alongside it).
  // Deep link: opening .../docs#log lands on TODAY's page — the date is
  // computed at load time, so a bookmarked link always follows the calendar.
  const [logView, setLogView] = useState(
    () => (window.location.hash.toLowerCase() === '#log' ? todayKey() : null)
  );

  // Keep the hash in sync so the address bar is always bookmarkable:
  // any log page shows #log; leaving the log clears it. replaceState avoids
  // polluting browser history with every day switch (and doesn't fire
  // hashchange, so it can't loop with the listener below).
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const want = logView ? '#log' : '';
    if (hash !== want) {
      window.history.replaceState(null, '', pathname + search + want);
    }
  }, [logView]);

  // Typing #log into the address bar of an ALREADY-OPEN tab doesn't reload
  // the page — it only fires hashchange. Catch it and jump to today.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash.toLowerCase() === '#log') {
        setLogView(todayKey());
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved

  // Resizable rail widths.
  const [listW, setListW] = useState(() => readStoredW(LS_LIST_W, DEFAULT_LIST_W, MIN_LIST_W, MAX_LIST_W));
  const [tocW, setTocW]   = useState(() => readStoredW(LS_TOC_W,  DEFAULT_TOC_W,  MIN_TOC_W,  MAX_TOC_W));
  useEffect(() => { try { window.localStorage.setItem(LS_LIST_W, String(listW)); } catch (e) {} }, [listW]);
  useEffect(() => { try { window.localStorage.setItem(LS_TOC_W,  String(tocW));  } catch (e) {} }, [tocW]);

  // Mobile drawer state — sidebar slides off-canvas on small screens.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

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

  // Select-a-doc helper that also closes the mobile drawer so the editor
  // becomes visible immediately after picking on a phone.
  const selectDoc = useCallback((id) => {
    setActiveDocId(id);
    setLogView(null);
    closeSidebar();
  }, [closeSidebar]);

  // Clicking Log lands straight on today's page.
  const openLog = useCallback(() => {
    setLogView(todayKey());
    closeSidebar();
  }, [closeSidebar]);

  const handleLogChange = useCallback((dateKey, patch) => {
    setSaveState('saving');
    saveLogDay(dateKey, patch);
    setTimeout(() => setSaveState('saved'), 800);
  }, [saveLogDay]);

  const handleNew = useCallback(() => {
    const id = createDoc();
    if (id) selectDoc(id);
  }, [createDoc, selectDoc]);

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
      {/* Doc-picker button — only visible on mobile via CSS media query.
          Sits top-right so it doesn't collide with the main-app hamburger
          (top-left). Labeled "Docs" so users know this opens the doc list,
          not the section switcher. */}
      <button
        className="docs-hamburger"
        aria-label="Toggle doc list"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <span className="docs-hamburger-lines">
          <span /><span /><span />
        </span>
        <span>Docs</span>
      </button>
      {/* Backdrop that closes the drawer on tap — only rendered when open. */}
      <div
        className={`docs-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={closeSidebar}
      />

      <DocsSidebar
        docs={docs}
        docsOrder={docsOrder}
        activeDocId={logView ? null : activeDocId}
        onSelect={selectDoc}
        onNew={handleNew}
        onDelete={handleDelete}
        onReorder={reorderDocs}
        onExit={onExit}
        width={listW}
        onResize={setListW}
        minWidth={MIN_LIST_W}
        maxWidth={MAX_LIST_W}
        sidebarOpen={sidebarOpen}
        logActive={logView !== null}
        onOpenLog={openLog}
      />

      {/* TOC sits between the sidebar and main editor on the LEFT.
          In Log mode, the month/day rail takes its place. */}
      {logView && (
        <LogRail
          entries={logEntries}
          selectedDay={logView}
          onSelectDay={(d) => setLogView(d)}
        />
      )}
      {!logView && activeDoc && (
        <DocToc
          content={activeDoc.content}
          width={tocW}
          onResize={setTocW}
          minWidth={MIN_TOC_W}
          maxWidth={MAX_TOC_W}
        />
      )}

      <main className="docs-main">
        {logView && (
          <>
            <div className="docs-doc-header log-day-header">
              <div className={`docs-save-indicator docs-save-${saveState}`}>
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : ''}
              </div>
            </div>
            <LogDayPage
              dateKey={logView}
              entry={logEntries[logView]}
              onChange={handleLogChange}
            />
          </>
        )}

        {!logView && !activeDoc && (
          <div className="docs-empty-state">
            <div className="docs-empty-title">No doc selected</div>
            <div className="docs-empty-sub">
              Pick one from the sidebar, or
              <button className="docs-empty-link" onClick={handleNew}>start a new one</button>.
            </div>
          </div>
        )}

        {!logView && activeDoc && (
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
