import { useEffect, useRef, useState } from "react";
import { adminErrorMessage } from "../admin-error";
import { articleImageMarkup, bodyHasText, editorHtmlFromBody, sanitizeArticleHtml } from "../article-body";
import { isArticleImageFile } from "../compress-image";
import { uploadMediaAsset } from "../upload-image";

type Props = {
  value: string;
  onChange: (html: string) => void;
  ownerName?: string;
  onError?: (message: string) => void;
};

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  heading: "" | "h2" | "h3";
};

const EMPTY_DOC = "<p><br></p>";

function currentHeading(): "" | "h2" | "h3" {
  if (typeof document === "undefined") return "";
  if (document.queryCommandValue("formatBlock").toLowerCase() === "h2") return "h2";
  if (document.queryCommandValue("formatBlock").toLowerCase() === "h3") return "h3";
  return "";
}

export function ArticleBodyEditor({ value, onChange, ownerName, onError }: Props) {
  const surface = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef("");
  const savedSelection = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [toolbar, setToolbar] = useState<ToolbarState>({ bold: false, italic: false, underline: false, heading: "" });

  useEffect(() => {
    if (!surface.current) return;
    const next = editorHtmlFromBody(value);
    if (next === lastEmitted.current) return;
    surface.current.innerHTML = next || EMPTY_DOC;
    lastEmitted.current = next;
  }, [value]);

  const emit = () => {
    if (!surface.current) return;
    const html = sanitizeArticleHtml(surface.current.innerHTML);
    lastEmitted.current = html;
    onChange(html);
  };

  const rememberSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) savedSelection.current = selection.getRangeAt(0);
  };

  const restoreSelection = () => {
    const range = savedSelection.current;
    if (!range) return;
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };

  const run = (command: string, commandValue?: string) => {
    surface.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    emit();
    syncToolbar();
  };

  const applyBlock = (tag: "p" | "h2" | "h3" | "blockquote") => {
    run("formatBlock", tag);
  };

  const syncToolbar = () => {
    if (typeof document === "undefined") return;
    setToolbar({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      heading: currentHeading(),
    });
  };

  const insertUploadedImage = async (file: File) => {
    if (!isArticleImageFile(file)) {
      onError?.("Use a JPEG, PNG, or WebP image up to 12 MB.");
      return;
    }
    setImageBusy(true);
    onError?.("");
    try {
      const uploaded = await uploadMediaAsset(file, { ownerName, role: "body" });
      const markup = articleImageMarkup(uploaded.src, uploaded.alt || ownerName || uploaded.file);
      if (!markup) throw new Error("Could not upload that image.");
      surface.current?.focus();
      restoreSelection();
      document.execCommand("insertHTML", false, markup);
      emit();
    } catch (caught) {
      onError?.(adminErrorMessage(caught, "Could not upload that image."));
    } finally {
      setImageBusy(false);
    }
  };

  const applyLink = () => {
    const href = linkUrl.trim();
    surface.current?.focus();
    restoreSelection();
    if (!href) {
      document.execCommand("unlink");
    } else {
      const safe = href.startsWith("/") || /^https?:\/\//i.test(href) ? href : `https://${href}`;
      document.execCommand("createLink", false, safe);
    }
    setLinkOpen(false);
    setLinkUrl("");
    emit();
  };

  return (
    <div className="admin-doc-editor">
      <div className="admin-doc-toolbar" role="toolbar" aria-label="Article formatting">
        <button type="button" className={toolbar.bold ? "is-active" : ""} aria-pressed={toolbar.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => run("bold")}><strong>B</strong></button>
        <button type="button" className={toolbar.italic ? "is-active" : ""} aria-pressed={toolbar.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => run("italic")}><em>I</em></button>
        <button type="button" className={toolbar.underline ? "is-active" : ""} aria-pressed={toolbar.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => run("underline")}><span style={{ textDecoration: "underline" }}>U</span></button>
        <span className="admin-doc-toolbar-rule" />
        <button type="button" className={toolbar.heading === "h2" ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => applyBlock(toolbar.heading === "h2" ? "p" : "h2")}>Heading</button>
        <button type="button" className={toolbar.heading === "h3" ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => applyBlock(toolbar.heading === "h3" ? "p" : "h3")}>Subheading</button>
        <span className="admin-doc-toolbar-rule" />
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertUnorderedList")}>Bullets</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("insertOrderedList")}>Numbers</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyBlock("blockquote")}>Quote</button>
        <span className="admin-doc-toolbar-rule" />
        <button type="button" onMouseDown={(event) => { event.preventDefault(); rememberSelection(); }} onClick={() => {
          rememberSelection();
          setLinkOpen((open) => !open);
        }}>Link</button>
        <input
          ref={imageRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif"
          hidden
          data-testid="article-body-image-file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void insertUploadedImage(file);
          }}
        />
        <button
          type="button"
          disabled={imageBusy}
          data-testid="article-body-image"
          onMouseDown={(event) => { event.preventDefault(); rememberSelection(); }}
          onClick={() => imageRef.current?.click()}
        >
          {imageBusy ? "Uploading…" : "Image"}
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("undo")}>Undo</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("redo")}>Redo</button>
      </div>
      {linkOpen && (
        <div className="admin-doc-link-row">
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https:// or /products/ryegrass"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkOpen(false);
            }}
          />
          <button type="button" className="admin-button outline small" onClick={applyLink}>Apply link</button>
          <button type="button" className="admin-button ghost small" onClick={() => { setLinkOpen(false); run("unlink"); }}>Remove</button>
        </div>
      )}
      <div
        ref={surface}
        className={`admin-doc-surface article-body${!bodyHasText(value) ? " is-empty" : ""}`}
        contentEditable
        role="textbox"
        aria-label="Article body"
        aria-multiline="true"
        data-placeholder="Start writing. Use the toolbar for headings, lists, links, images and emphasis. The article title is already the page heading."
        onInput={emit}
        onBlur={emit}
        onMouseUp={syncToolbar}
        onKeyUp={syncToolbar}
        onPaste={(event) => {
          const image = [...event.clipboardData.files].find((file) => isArticleImageFile(file));
          if (image) {
            event.preventDefault();
            rememberSelection();
            void insertUploadedImage(image);
            return;
          }
          event.preventDefault();
          const html = event.clipboardData.getData("text/html");
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertHTML", false, html ? sanitizeArticleHtml(html) : sanitizeArticleHtml(`<p>${text.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>")}</p>`));
          emit();
        }}
      />
    </div>
  );
}
