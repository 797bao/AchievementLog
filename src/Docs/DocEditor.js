import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent, Extension, ReactNodeViewRenderer } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
// TextStyle + FontSize are named exports in v3+ of this package, and
// FontSize ships as a first-class extension — no need to roll our own.
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import DocContextMenu from './DocContextMenu';
import DocLightbox from './DocLightbox';
import ImageNodeView from './ImageNodeView';
import VideoNodeView from './VideoNodeView';

/**
 * Image with extra attributes for in-place resize (width) and alignment
 * (left/center/right — float-based so two adjacent images with float-left
 * naturally sit side-by-side). A React NodeView renders the resize handle
 * and alignment toolbar on hover.
 */
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => attrs.width ? { style: `width: ${attrs.width}` } : {},
      },
      align: {
        default: null, // null | 'left' | 'right' | 'center'
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) => attrs.align ? { 'data-align': attrs.align } : {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

/**
 * Video node — block-level leaf that renders a <video controls> element via
 * a React NodeView (so it gets the same resize + alignment treatment as
 * images). Source is a Firebase Storage URL set when the user pastes/drops
 * a video file.
 */
const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      src: { default: null },
      width: {
        default: null,
        parseHTML: (el) => el.style.width || el.getAttribute('width') || null,
        renderHTML: (attrs) => attrs.width ? { style: `width: ${attrs.width}` } : {},
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-align') || null,
        renderHTML: (attrs) => attrs.align ? { 'data-align': attrs.align } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'video[src]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: 'true', class: 'doc-vid' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView);
  },
});

/**
 * Indent extension: adds a numeric `indent` attribute to paragraphs, headings,
 * blockquotes, and lists. Tab / Shift-Tab adjust it.
 *
 * In a list with >1 sibling, Tab still nests (sinkListItem). When sinking
 * isn't possible (single item, or cursor on the first item), Tab falls
 * through to indenting the WHOLE LIST instead. So a one-item bullet list
 * indents in lockstep with the paragraph above it.
 */
const INDENT_TYPES = ['paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList'];

/**
 * Find the best ancestor of the current selection to apply indent to.
 * Lists take priority — if the cursor is inside one, we want to indent the
 * list as a block (not the inner paragraph inside its list-item).
 */
function findIndentTarget($from) {
  let listMatch = null;
  let blockMatch = null;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    const name = node.type.name;
    if ((name === 'bulletList' || name === 'orderedList') && !listMatch) {
      listMatch = { type: name, node };
    } else if (
      (name === 'paragraph' || name === 'heading' || name === 'blockquote') &&
      !blockMatch
    ) {
      blockMatch = { type: name, node };
    }
  }
  // List-level indent wins when we're inside a list.
  return listMatch || blockMatch;
}

const Indent = Extension.create({
  name: 'indent',
  addOptions() {
    return { types: INDENT_TYPES, minIndent: 0, maxIndent: 8 };
  },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el) => parseInt(el.getAttribute('data-indent') || '0', 10) || 0,
          renderHTML: (attrs) => {
            const n = attrs.indent || 0;
            if (!n) return {};
            return { 'data-indent': n, style: `margin-left: ${n * 24}px` };
          },
        },
      },
    }];
  },
  addCommands() {
    const opts = this.options;
    return {
      indent: () => ({ state, chain }) => {
        const target = findIndentTarget(state.selection.$from);
        if (!target) return false;
        const cur = (target.node.attrs && target.node.attrs.indent) || 0;
        const next = Math.min(cur + 1, opts.maxIndent);
        if (next === cur) return false;
        return chain().updateAttributes(target.type, { indent: next }).run();
      },
      outdent: () => ({ state, chain }) => {
        const target = findIndentTarget(state.selection.$from);
        if (!target) return false;
        const cur = (target.node.attrs && target.node.attrs.indent) || 0;
        const next = Math.max(cur - 1, opts.minIndent);
        if (next === cur) return false;
        return chain().updateAttributes(target.type, { indent: next }).run();
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Nest within a list when possible (multi-item list, cursor not on first item).
        if (this.editor.can().sinkListItem('listItem')) {
          return this.editor.chain().focus().sinkListItem('listItem').run();
        }
        // Otherwise, indent the closest indentable block (paragraph, heading, list, etc.)
        return this.editor.chain().focus().indent().run();
      },
      'Shift-Tab': () => {
        if (this.editor.can().liftListItem('listItem')) {
          return this.editor.chain().focus().liftListItem('listItem').run();
        }
        return this.editor.chain().focus().outdent().run();
      },
    };
  },
});

/**
 * TipTap-backed rich text editor.
 *
 * Formatting is surfaced via right-click context menu on a selection, not
 * a persistent toolbar — keeps the writing surface clean. Image paste/drop,
 * link-on-paste, and markdown-style shortcuts (#, ##, > blockquote, etc.) all
 * work without explicit buttons.
 */
export default function DocEditor({ content, onChange, onImageUpload, onVideoUpload }) {
  const onImageUploadRef = useRef(onImageUpload);
  onImageUploadRef.current = onImageUpload;
  const onVideoUploadRef = useRef(onVideoUpload);
  onVideoUploadRef.current = onVideoUpload;

  const [menu, setMenu] = useState(null); // { x, y } or null
  // Lightbox state: when an image is clicked, store its src + the document
  // position so we can offer a delete action that knows what to remove.
  const [lightbox, setLightbox] = useState(null); // { src, alt, pos } or null
  const editorRootRef = useRef(null);

  const insertImageFromFile = useCallback(async (view, file) => {
    if (!onImageUploadRef.current) return;
    try {
      const url = await onImageUploadRef.current(file);
      if (!url) return;
      const { schema } = view.state;
      const node = schema.nodes.image.create({ src: url, alt: file.name || '' });
      const tr = view.state.tr.replaceSelectionWith(node);
      view.dispatch(tr);
    } catch (err) {
      console.error('Image upload failed:', err);
    }
  }, []);

  const insertVideoFromFile = useCallback(async (view, file) => {
    if (!onVideoUploadRef.current) return;
    try {
      const url = await onVideoUploadRef.current(file);
      if (!url) return;
      const { schema } = view.state;
      const node = schema.nodes.video.create({ src: url });
      const tr = view.state.tr.replaceSelectionWith(node);
      view.dispatch(tr);
    } catch (err) {
      console.error('Video upload failed:', err);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: 'Start writing your design notes…' }),
      ResizableImage.configure({ HTMLAttributes: { class: 'doc-img' } }),
      Video,
      // autolink turns URLs typed inline into links automatically;
      // linkOnPaste wraps a selection in a link when you paste a URL on top
      // of it. Together they make explicit "add link" UI mostly unnecessary.
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { class: 'doc-link' },
      }),
      TextStyle,
      FontSize,
      Indent,
    ],
    editorProps: {
      // Disable the browser's native spellcheck. Its dictionary is too narrow
      // for design vocabulary (flags "gameplay", "lerp", "FX", etc.) and the
      // wavy red underlines were distracting more than they helped.
      attributes: { spellcheck: 'false' },
      handlePaste: (view, event) => {
        const items = event.clipboardData && event.clipboardData.items;
        if (!items) return false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const t = item.type || '';
          if (t.indexOf('image/') === 0) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              insertImageFromFile(view, file);
              return true;
            }
          }
          if (t.indexOf('video/') === 0) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              insertVideoFromFile(view, file);
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event, slice, moved) => {
        if (moved) return false;
        const files = event.dataTransfer && event.dataTransfer.files;
        if (!files || files.length === 0) return false;
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const t = file.type || '';
          if (t.indexOf('image/') === 0) {
            event.preventDefault();
            insertImageFromFile(view, file);
            return true;
          }
          if (t.indexOf('video/') === 0) {
            event.preventDefault();
            insertVideoFromFile(view, file);
            return true;
          }
        }
        return false;
      },
    },
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor }) => { if (onChange) onChange(editor.getJSON()); },
  }, []);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(content)) {
      editor.commands.setContent(content || { type: 'doc', content: [{ type: 'paragraph' }] }, false);
    }
  }, [content, editor]);

  // Right-click → show our floating formatting menu. Only when there's a
  // non-empty selection — empty right-click falls through to the browser's
  // own context menu (so paste, inspect, etc. still work as expected).
  const handleContextMenu = useCallback((e) => {
    if (!editor) return;
    const sel = editor.state.selection;
    const hasSelection = sel && !sel.empty;
    if (!hasSelection) return; // browser default
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, [editor]);

  // Click on an <img> inside the editor → open the lightbox. Uses
  // posAtDOM to remember where the image node sits in the document, so the
  // Delete button in the lightbox can remove that exact node.
  useEffect(() => {
    if (!editor) return;
    const root = editorRootRef.current;
    if (!root) return;
    const onClick = (e) => {
      const t = e.target;
      if (t && t.tagName === 'IMG' && root.contains(t)) {
        e.preventDefault();
        try {
          const pos = editor.view.posAtDOM(t, 0);
          setLightbox({ src: t.src, alt: t.alt, pos });
        } catch (err) {
          // posAtDOM can throw if the DOM is stale; just open the lightbox
          // without a pos and the delete button will degrade to a no-op.
          setLightbox({ src: t.src, alt: t.alt, pos: null });
        }
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [editor]);

  const deleteImage = useCallback(() => {
    if (!editor || !lightbox || lightbox.pos == null) { setLightbox(null); return; }
    // An image node has size 1 in ProseMirror — delete the single slot.
    editor.chain().focus().deleteRange({ from: lightbox.pos, to: lightbox.pos + 1 }).run();
    setLightbox(null);
  }, [editor, lightbox]);

  if (!editor) return null;

  return (
    <div className="doc-editor" onContextMenu={handleContextMenu} ref={editorRootRef}>
      <EditorContent editor={editor} className="doc-editor-content" />
      {menu && (
        <DocContextMenu
          editor={editor}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
        />
      )}
      {lightbox && (
        <DocLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
          onDelete={deleteImage}
        />
      )}
    </div>
  );
}
