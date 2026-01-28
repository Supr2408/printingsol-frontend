import { useEffect, useRef, useState, memo, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { PDFDocument } from "pdf-lib";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min?url";
import "../../styles/pdfEditor.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PageThumbnail = memo(({ pdf, pageNum }) => {
  const thumbRef = useRef(null);
  useEffect(() => {
    if (!pdf) return;
    let isCancelled = false;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (isCancelled) return;
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = thumbRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) { console.error(e); }
    })();
    return () => { isCancelled = true; };
  }, [pdf, pageNum]);
  return <canvas ref={thumbRef} />;
});

export default function PdfEditorModal({ file, onClose, onConfirm }) {
  const canvasRef = useRef(null);
  const [pdf, setPdf] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPages, setSelectedPages] = useState([]);
  const [rangeInput, setRangeInput] = useState(""); 
  const [sheetIndex, setSheetIndex] = useState(0);
  const [pagesPerSheet, setPagesPerSheet] = useState(1);
  const [layout, setLayout] = useState("portrait");
  const [mode, setMode] = useState("editor");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!file) return;
    (async () => {
      const buffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      setPdf(doc);
      setTotalPages(doc.numPages);
      setSelectedPages(Array.from({ length: doc.numPages }, (_, i) => i + 1));
      setRangeInput(`1-${doc.numPages}`);
    })();
  }, [file]);

  const parsePageRange = (input, max) => {
    const pages = new Set();
    const parts = input.split(/[, ]+/);
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= max) pages.add(i);
          }
        }
      } else {
        const num = Number(part);
        if (!isNaN(num) && num >= 1 && num <= max) pages.add(num);
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  // Improved Grid Calculation
  const getGridConfig = useCallback(() => {
    const cols = pagesPerSheet === 1 ? 1 : pagesPerSheet === 2 ? 2 : Math.ceil(Math.sqrt(pagesPerSheet));
    const rows = Math.ceil(pagesPerSheet / cols);
    return { cols, rows };
  }, [pagesPerSheet]);

  useEffect(() => {
    if (!pdf || selectedPages.length === 0 || mode !== "editor") return;
    let isCancelled = false;
    const render = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 2;
      
      const A4_W = 595.28; const A4_H = 841.89;
      const baseW = layout === "portrait" ? A4_W : A4_H;
      const baseH = layout === "portrait" ? A4_H : A4_W;
      const renderScale = 1.0; 

      canvas.width = baseW * renderScale * dpr;
      canvas.height = baseH * renderScale * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, baseW, baseH);

      const { cols, rows } = getGridConfig();
      const cellW = baseW / cols;
      const cellH = baseH / rows;

      const chunk = selectedPages.slice(sheetIndex * pagesPerSheet, (sheetIndex * pagesPerSheet) + pagesPerSheet);

      for (let i = 0; i < chunk.length; i++) {
        if (isCancelled) break;
        try {
          const page = await pdf.getPage(chunk[i]);
          const viewport = page.getViewport({ scale: 1 });
          const s = Math.min(cellW / viewport.width, cellH / viewport.height) * 0.9;
          const vp = page.getViewport({ scale: s * dpr });
          
          const temp = document.createElement("canvas");
          temp.width = vp.width; temp.height = vp.height;
          await page.render({ canvasContext: temp.getContext("2d"), viewport: vp }).promise;
          
          const x = (i % cols) * cellW + (cellW - vp.width / dpr) / 2;
          const y = Math.floor(i / cols) * cellH + (cellH - vp.height / dpr) / 2;
          ctx.drawImage(temp, x, y, vp.width / dpr, vp.height / dpr);
        } catch (e) { console.error(e); }
      }
    };
    render();
    return () => { isCancelled = true; };
  }, [pdf, selectedPages, sheetIndex, pagesPerSheet, layout, mode, getGridConfig]);

  const totalSheets = Math.ceil(selectedPages.length / pagesPerSheet);

  const handleFinalSave = async () => {
    if (selectedPages.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    try {
      const originalBytes = await file.arrayBuffer();
      const originalPdf = await PDFDocument.load(originalBytes);
      const newPdf = await PDFDocument.create();
      
      const isP = layout === "portrait";
      const sheetW = isP ? 595.28 : 841.89; 
      const sheetH = isP ? 841.89 : 595.28;
      
      const { cols, rows } = getGridConfig();
      const cellW = sheetW / cols; 
      const cellH = sheetH / rows;

      for (let i = 0; i < selectedPages.length; i += pagesPerSheet) {
        const chunk = selectedPages.slice(i, i + pagesPerSheet);
        const sheet = newPdf.addPage([sheetW, sheetH]);
        
        for (let j = 0; j < chunk.length; j++) {
          // pdf-lib is 0-indexed for page copying
          const [copiedPage] = await newPdf.copyPages(originalPdf, [chunk[j] - 1]);
          const embeddedPage = await newPdf.embedPage(copiedPage);
          
          const { width, height } = copiedPage.getSize();
          const scale = Math.min(cellW / width, cellH / height) * 0.95;
          
          const drawW = width * scale;
          const drawH = height * scale;
          
          const colIndex = j % cols;
          const rowIndex = Math.floor(j / cols);
          
          const x = colIndex * cellW + (cellW - drawW) / 2;
          // In PDF coordinates, (0,0) is bottom-left. 
          // We calculate from top by: SheetHeight - ((row + 1) * CellHeight) + Offset
          const y = sheetH - ((rowIndex + 1) * cellH) + (cellH - drawH) / 2;

          sheet.drawPage(embeddedPage, {
            x,
            y,
            width: drawW,
            height: drawH,
          });
        }
        setProgress(Math.round(((i + chunk.length) / selectedPages.length) * 100));
      }

      const editedBytes = await newPdf.save();
      const editedFile = new File([editedBytes], `edited_${file.name}`, { type: "application/pdf" });
      
      onConfirm({ 
        file: editedFile, 
        pages: newPdf.getPageCount() 
      });
    } catch (e) {
      console.error(e);
      alert("Error generating PDF: " + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Rendering logic for select-pages and main editor remains same as your snippet...
  // (Included below for completeness)

  if (mode === "select-pages") {
    return (
      <div className="editor-overlay">
        <div className="editor-modal">
          <div className="editor-header pt-safe">
            <span>Select Pages</span>
            <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={() => setSelectedPages(Array.from({length: totalPages}, (_,i)=>i+1))} style={{fontSize: '0.75rem', padding: '4px 8px'}}>All</button>
                <button onClick={() => setSelectedPages([])} style={{fontSize: '0.75rem', padding: '4px 8px'}}>None</button>
                <button className="close-btn" onClick={() => setMode("editor")}>✕</button>
            </div>
          </div>
          <div className="search-bar">
            <input type="text" placeholder="Ex: 1, 3, 5-10" value={rangeInput} onChange={(e) => setRangeInput(e.target.value)} />
            <button onClick={() => setSelectedPages(parsePageRange(rangeInput, totalPages))} style={{background: '#4361ee', color: '#fff', border: 'none'}}>Apply</button>
          </div>
          <div className="page-grid">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <div key={p} className={`page-card ${selectedPages.includes(p) ? "selected" : ""}`} onClick={() => setSelectedPages(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p].sort((a,b)=>a-b))}>
                <div className="thumb-container"><PageThumbnail pdf={pdf} pageNum={p} /></div>
                <span>Page {p}</span>
              </div>
            ))}
          </div>
          <div className="editor-actions">
            <button className="btn-primary" onClick={() => setMode("editor")}>Done ({selectedPages.length} Pages)</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-overlay">
      <div className="editor-modal">
        {isGenerating && <div className="processing-overlay"><div className="loader"></div><p>Processing: {progress}%</p></div>}
        <div className="editor-header">
          <span>Print Settings</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="preview-area">
          <div className="preview-nav">
            <button onClick={() => setSheetIndex(i => Math.max(0, i - 1))}>‹</button>
            <span>{sheetIndex + 1} / {totalSheets || 1}</span>
            <button onClick={() => setSheetIndex(i => Math.min(totalSheets - 1, i + 1))}>›</button>
          </div>
          <div className="preview-canvas">
            <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd' }} />
          </div>
        </div>
        <div className="editor-settings">
          <button className="select-pages-trigger" onClick={() => setMode("select-pages")}>
            Selected Pages: <strong>{selectedPages.length}</strong>
            <span>Change ›</span>
          </button>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Orientation</label>
              <div className="toggle-group">
                <button className={layout === "portrait" ? "active" : ""} onClick={() => setLayout("portrait")}>Portrait</button>
                <button className={layout === "landscape" ? "active" : ""} onClick={() => setLayout("landscape")}>Landscape</button>
              </div>
            </div>
            <div className="setting-item">
              <label>Pages Per Sheet</label>
              <div className="pps-grid">
                {[1, 2, 4, 6, 9, 16].map(n => (
                  <button key={n} className={pagesPerSheet === n ? "active" : ""} onClick={() => {setPagesPerSheet(n); setSheetIndex(0);}}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="editor-actions">
          <button className="btn-primary" onClick={handleFinalSave} disabled={selectedPages.length === 0}>Apply & Save PDF</button>
        </div>
      </div>
    </div>
  );
}