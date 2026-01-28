import { useEffect, useRef, useState, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import "../../styles/imageEditor.css";

const A4_PORTRAIT = { w: 595.28, h: 841.89 };
const A4_LANDSCAPE = { w: 841.89, h: 595.28 };
const EDGE_THRESHOLD = 60; // Distance from edge to trigger page jump

export default function ImageEditorModal({ file, onClose, onConfirm, onLaunchCamera }) {
  const canvasRef = useRef(null);
  const [pages, setPages] = useState([{ id: Date.now(), elements: [] }]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [orientation, setOrientation] = useState("portrait");
  const [copies, setCopies] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const processedFilesRef = useRef(new Set());
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  /* ================== HELPERS ================== */
  const updateSelectedElement = (key, value) => {
    setPages(prev => {
      const updated = [...prev];
      updated[currentPageIdx].elements = updated[currentPageIdx].elements.map(el =>
        el.id === selectedId ? { ...el, [key]: value } : el
      );
      return updated;
    });
  };

  const adjustValue = (key, delta, min, max) => {
    const element = pages[currentPageIdx].elements.find(el => el.id === selectedId);
    if (!element) return;
    const newValue = Math.min(max, Math.max(min, parseFloat((element[key] + delta).toFixed(2))));
    updateSelectedElement(key, newValue);
  };

  const removeSelectedElement = () => {
    if (!selectedId) return;
    setPages(prev => {
      const updated = [...prev];
      updated[currentPageIdx].elements = updated[currentPageIdx].elements.filter(el => el.id !== selectedId);
      return updated;
    });
    setSelectedId(null);
  };

  /* ================== IMAGE ADDITION ================== */
  const addImages = useCallback((files) => {
    const target = orientation === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
    files.forEach((f) => {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        const fitScale = Math.min((target.w * 0.7) / img.width, (target.h * 0.7) / img.height, 1);
        setPages(prev => {
          const updated = [...prev];
          const newElement = {
            id: newId,
            img,
            rawFile: f,
            x: (target.w - img.width * fitScale) / 2,
            y: (target.h - img.height * fitScale) / 2,
            scale: fitScale,
            brightness: 1,
            contrast: 1,
            grayscale: false
          };
          updated[currentPageIdx].elements = [...updated[currentPageIdx].elements, newElement];
          return updated;
        });
        setSelectedId(newId);
      };
      img.src = url;
    });
  }, [currentPageIdx, orientation]);

  useEffect(() => {
    if (!file) return;
    const key = `${file.name}_${file.size}_${file.lastModified}`;
    if (processedFilesRef.current.has(key)) return;
    processedFilesRef.current.add(key);
    addImages([file]);
  }, [file, addImages]);

  /* ================== CANVAS UI PREVIEW ================== */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const target = orientation === "portrait" ? A4_PORTRAIT : A4_LANDSCAPE;
    
    canvas.width = target.w;
    canvas.height = target.h;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, target.w, target.h);

    pages[currentPageIdx].elements.forEach((el) => {
      const dw = el.img.width * el.scale;
      const dh = el.img.height * el.scale;
      ctx.save();
      ctx.filter = `brightness(${el.brightness}) contrast(${el.contrast}) ${el.grayscale ? 'grayscale(1)' : ''}`;
      ctx.drawImage(el.img, el.x, el.y, dw, dh);
      ctx.restore();

      if (el.id === selectedId) {
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = "#4361ee";
        ctx.lineWidth = 3;
        ctx.strokeRect(el.x, el.y, dw, dh);
        ctx.setLineDash([]);
      }
    });
  }, [pages, currentPageIdx, selectedId, orientation]);

  /* ================== TELEPORT DRAG LOGIC ================== */
  const handleStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    const mouseX = (clientX - rect.left) * scaleX;
    const mouseY = (clientY - rect.top) * scaleY;

    const currentElements = pages[currentPageIdx].elements;
    for (let i = currentElements.length - 1; i >= 0; i--) {
      const el = currentElements[i];
      if (mouseX >= el.x && mouseX <= el.x + el.img.width * el.scale &&
          mouseY >= el.y && mouseY <= el.y + el.img.height * el.scale) {
        setSelectedId(el.id);
        setIsDragging(true);
        dragRef.current = { active: true, lastX: clientX, lastY: clientY };
        return;
      }
    }
    setSelectedId(null);
  };

  const handleMove = (e) => {
    if (!dragRef.current.active || !selectedId) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const canvasX = (clientX - rect.left) * scaleX;
    const dx = (clientX - dragRef.current.lastX) * scaleX;
    const dy = (clientY - dragRef.current.lastY) * scaleY;

    setPages(prev => {
      const updated = [...prev];
      const element = updated[currentPageIdx].elements.find(el => el.id === selectedId);
      if (!element) return prev;

      let targetIdx = currentPageIdx;
      let teleportX = element.x + dx;

      // MULTI-PAGE TELEPORT LOGIC
      if (canvasX > (canvasRef.current.width - EDGE_THRESHOLD) && currentPageIdx < prev.length - 1) {
        targetIdx = currentPageIdx + 1;
        teleportX = 20; 
      } else if (canvasX < EDGE_THRESHOLD && currentPageIdx > 0) {
        targetIdx = currentPageIdx - 1;
        const targetW = orientation === "portrait" ? A4_PORTRAIT.w : A4_LANDSCAPE.w;
        teleportX = targetW - (element.img.width * element.scale) - 20;
      }

      if (targetIdx !== currentPageIdx) {
        // Move element to new page array
        updated[currentPageIdx].elements = updated[currentPageIdx].elements.filter(el => el.id !== selectedId);
        updated[targetIdx].elements.push({ ...element, x: teleportX, y: element.y + dy });
        // Update view index after render
        setTimeout(() => setCurrentPageIdx(targetIdx), 0);
      } else {
        // Normal move on same page
        updated[currentPageIdx].elements = updated[currentPageIdx].elements.map(el =>
          el.id === selectedId ? { ...el, x: el.x + dx, y: el.y + dy } : el
        );
      }
      return updated;
    });

    dragRef.current.lastX = clientX;
    dragRef.current.lastY = clientY;
  };

  const handleEnd = () => {
    setIsDragging(false);
    dragRef.current.active = false;
  };

  /* ================== VECTOR HYBRID EXPORT ================== */
  const handleExport = async () => {
    setIsProcessing(true);
    try {
      const newPdf = await PDFDocument.create();
      const isP = orientation === "portrait";
      const sheetW = isP ? A4_PORTRAIT.w : A4_LANDSCAPE.w;
      const sheetH = isP ? A4_PORTRAIT.h : A4_LANDSCAPE.h;

      for (const pageData of pages) {
        const sheet = newPdf.addPage([sheetW, sheetH]);
        for (const el of pageData.elements) {
          const virtualCanvas = document.createElement("canvas");
          virtualCanvas.width = el.img.width;
          virtualCanvas.height = el.img.height;
          const vCtx = virtualCanvas.getContext("2d");
          vCtx.filter = `brightness(${el.brightness}) contrast(${el.contrast}) ${el.grayscale ? 'grayscale(1)' : ''}`;
          vCtx.drawImage(el.img, 0, 0);

          const processedData = virtualCanvas.toDataURL("image/jpeg", 0.95);
          const processedBytes = await fetch(processedData).then(res => res.arrayBuffer());
          const embeddedImg = await newPdf.embedJpg(processedBytes);
          const dims = embeddedImg.scale(el.scale);

          sheet.drawImage(embeddedImg, {
            x: el.x,
            y: sheetH - el.y - dims.height,
            width: dims.width,
            height: dims.height,
          });
        }
      }

      const pdfBytes = await newPdf.save();
      onConfirm({ 
        file: new File([pdfBytes], `print_${Date.now()}.pdf`, { type: "application/pdf" }), 
        pages: pages.length, copies, layout: orientation 
      });
    } catch (err) {
      console.error(err);
      alert("Error generating PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedElement = pages[currentPageIdx].elements.find(el => el.id === selectedId);

  return (
    <div className="mobile-editor-overlay">
      {isProcessing && <div className="processing-overlay"><div className="loader"></div><p>Generating PDF...</p></div>}
      
      <div className="mobile-editor-container">
        <div className="editor-nav">
          <button className="nav-back" onClick={onClose}>✕</button>
          <span className="nav-title">Page {currentPageIdx + 1} / {pages.length}</span>
          <button className="nav-save" onClick={handleExport}>Save</button>
        </div>

        <div className="page-tabs-container">
          {pages.map((_, idx) => (
            <div key={idx} className={`page-tab-item ${idx === currentPageIdx ? 'active' : ''}`} onClick={() => setCurrentPageIdx(idx)}>
              P{idx + 1}
            </div>
          ))}
          <button className="tab-add" onClick={() => setPages(p => [...p, { id: Date.now(), elements: [] }])}>+</button>
        </div>
        
        <div className={`mobile-preview-area ${isDragging ? 'dragging-active' : ''}`}>
          <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd} />
        </div>

        <div className="bottom-controls">
          {selectedElement ? (
            <div className="adjustment-panel">
              <div className="slider-group">
                <div className="slider-header"><span>Scale</span><b>{Math.round(selectedElement.scale * 100)}%</b></div>
                <div className="slider-with-buttons">
                  <button onClick={() => adjustValue('scale', -0.05, 0.1, 2.0)}>−</button>
                  <input type="range" min="0.1" max="2.0" step="0.01" value={selectedElement.scale} onChange={(e) => updateSelectedElement('scale', parseFloat(e.target.value))} />
                  <button onClick={() => adjustValue('scale', 0.05, 0.1, 2.0)}>+</button>
                </div>
              </div>

              <div className="slider-group">
                <div className="slider-header"><span>Brightness</span><b>{Math.round(selectedElement.brightness * 100)}%</b></div>
                <div className="slider-with-buttons">
                  <button onClick={() => adjustValue('brightness', -0.1, 0.4, 1.6)}>−</button>
                  <input type="range" min="0.4" max="1.6" step="0.01" value={selectedElement.brightness} onChange={(e) => updateSelectedElement('brightness', parseFloat(e.target.value))} />
                  <button onClick={() => adjustValue('brightness', 0.1, 0.4, 1.6)}>+</button>
                </div>
              </div>

              <div className="slider-group">
                <div className="slider-header"><span>Contrast</span><b>{Math.round(selectedElement.contrast * 100)}%</b></div>
                <div className="slider-with-buttons">
                  <button onClick={() => adjustValue('contrast', -0.1, 0.4, 1.6)}>−</button>
                  <input type="range" min="0.4" max="1.6" step="0.01" value={selectedElement.contrast} onChange={(e) => updateSelectedElement('contrast', parseFloat(e.target.value))} />
                  <button onClick={() => adjustValue('contrast', 0.1, 0.4, 1.6)}>+</button>
                </div>
              </div>

              <button className={`grayscale-toggle ${selectedElement.grayscale ? 'active' : ''}`} onClick={() => updateSelectedElement('grayscale', !selectedElement.grayscale)}>
                {selectedElement.grayscale ? "🌑 Grayscale On" : "🌈 Grayscale Off"}
              </button>

              <div className="element-actions-row">
                <button className="reset-btn" onClick={() => {
                  updateSelectedElement('brightness', 1);
                  updateSelectedElement('contrast', 1);
                  updateSelectedElement('grayscale', false);
                }}>🔄 Reset</button>
                <button className="done-editing-btn" onClick={() => setSelectedId(null)}>✓ Done</button>
                <button className="remove-element-btn" onClick={removeSelectedElement}>🗑 Remove</button>
              </div>
            </div>
          ) : (
             <div className="control-row">
               <div className="toggle-group">
                 <button className={orientation === 'portrait' ? 'active' : ''} onClick={() => setOrientation("portrait")}>Portrait</button>
                 <button className={orientation === 'landscape' ? 'active' : ''} onClick={() => setOrientation("landscape")}>Landscape</button>
               </div>
               <div className="editor-action-row">
                 <button className="xerox-trigger" onClick={onLaunchCamera}>📸 Scan</button>
                 <label className="add-img-trigger">
                   <span>🖼️ Add File</span>
                   <input type="file" hidden multiple accept="image/*" onChange={(e) => addImages(Array.from(e.target.files))} />
                 </label>
               </div>
             </div>
          )}
          <div className="final-actions">
            <div className="copies-stepper"><button onClick={() => setCopies(Math.max(1, copies - 1))}>−</button><span>{copies} Copies</span><button onClick={() => setCopies(copies + 1)}>+</button></div>
            <button className="primary-generate-btn" onClick={handleExport}>Confirm & Print</button>
          </div>
        </div>
      </div>
    </div>
  );
}