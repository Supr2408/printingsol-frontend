import React, { useRef, useState, useEffect, useCallback } from "react";
import "../../styles/scanner.css";

export default function CameraPhotoDetection({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /* ================= CAMERA INIT ================= */
  useEffect(() => {
    let active = true;

    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!active) {
          s.getTracks().forEach(t => t.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setStream(s);
        }
      } catch (err) {
        console.error("Camera error:", err);
        alert("Camera permission required to scan pages.");
        onClose();
      }
    };

    startCamera();
    return () => {
      active = false;
    };
  }, [onClose]);

  /* ================= STOP CAMERA ================= */
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  /* ================= ESC TO CLOSE ================= */
  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* ================= CAPTURE LOGIC ================= */
  const processDocument = useCallback(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Guard: Ensure video is actually streaming and has dimensions
    if (!video || !container || video.videoWidth === 0) {
      console.warn("Camera stream not ready.");
      return;
    }

    setIsProcessing(true);

    try {
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;

      // Calculate object-fit: cover mapping
      const videoAspect = videoW / videoH;
      const containerAspect = containerW / containerH;

      let renderW, renderH, offsetX, offsetY;

      if (videoAspect > containerAspect) {
        renderH = containerH;
        renderW = renderH * videoAspect;
        offsetX = (renderW - containerW) / 2;
        offsetY = 0;
      } else {
        renderW = containerW;
        renderH = renderW / videoAspect;
        offsetX = 0;
        offsetY = (renderH - containerH) / 2;
      }

      // Guide box mapping (matches CSS 15% inset)
      const guideX = containerW * 0.15;
      const guideY = containerH * 0.15;
      const guideW = containerW * 0.7;
      const guideH = containerH * 0.7;

      const scaleX = videoW / renderW;
      const scaleY = videoH / renderH;

      const srcX = (guideX + offsetX) * scaleX;
      const srcY = (guideY + offsetY) * scaleY;
      const srcW = guideW * scaleX;
      const srcH = guideH * scaleY;

      // Final safety check to prevent canvas crashes
      if (isNaN(srcW) || srcW <= 0 || isNaN(srcH) || srcH <= 0) {
        throw new Error("Invalid dimensions calculated.");
      }

      canvas.width = srcW;
      canvas.height = srcH;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `scan_${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file);
        }
        setIsProcessing(false);
      }, "image/jpeg", 0.95);

    } catch (err) {
      console.error("Capture failed:", err);
      setIsProcessing(false); // Reset UI so user can try again
    }
  }, [onCapture]);

  /* ================= UI ================= */
  return (
    <div className="scanner-modal-overlay" onClick={onClose}>
      <div className="scanner-container" onClick={e => e.stopPropagation()}>
        <div className="scanner-header">
          <button className="scanner-cancel" onClick={onClose}>✕</button>
          <span className="scanner-title">Align Page</span>
          <div style={{ width: 40 }} />
        </div>

        <div className="camera-container" ref={containerRef}>
          <video
            ref={videoRef}
            autoPlay
            playsInline // Required for iOS
            muted
          />

          <div className="scanner-guide">
            <div className="guide-corner tl" />
            <div className="guide-corner tr" />
            <div className="guide-corner bl" />
            <div className="guide-corner br" />
          </div>

          {isProcessing && (
            <div className="processing-overlay">
              <div className="spinner"></div>
              <span>Capturing...</span>
            </div>
          )}
        </div>

        <div className="scanner-footer">
          <button 
            className="shutter-outer" 
            onClick={processDocument}
            disabled={isProcessing}
          >
            <div className="shutter-inner" />
          </button>
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
    </div>
  );
}