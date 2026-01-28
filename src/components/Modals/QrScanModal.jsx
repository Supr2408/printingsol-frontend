import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";

export default function QrScanModal({ onClose, onScan }) {
  const navigate = useNavigate();

  const html5QrRef = useRef(null);

  // 🔒 Prevent duplicate scans
  const scannedRef = useRef(false);

  // 🔒 Prevent double cleanup
  const closingRef = useRef(false);

  /* ================= HARD CAMERA STOP ================= */
  const killVideoTracks = () => {
    const video = document.querySelector("#html5-qr-reader video");
    if (!video || !video.srcObject) return;

    try {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      video.srcObject = null;
    } catch (e) {
      console.warn("Failed to kill video tracks", e);
    }
  };

  /* ================= SAFE STOP ================= */
  const stopQrCamera = async () => {
    if (closingRef.current) return;
    closingRef.current = true;

    const scanner = html5QrRef.current;
    html5QrRef.current = null;

    try {
      if (scanner?.isScanning) {
        await scanner.stop();
      }
    } catch {}

    try {
      await scanner?.clear();
    } catch {}

    // 🔥 Final hardware release
    killVideoTracks();
  };

  /* ================= INIT SCANNER ================= */
  useEffect(() => {
    const regionId = "html5-qr-reader";
    const scanner = new Html5Qrcode(regionId);
    html5QrRef.current = scanner;

    let autoCloseTimer;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          async (decodedText) => {
            if (!decodedText) return;
            if (scannedRef.current) return;

            scannedRef.current = true;

            // 🔥 1. Close UI immediately
            onClose();

            // 🔥 2. Stop camera + scanner
            await stopQrCamera();

            // 🔥 3. Fire print ONCE
            onScan(decodedText.trim());

            // 🔁 Hard reset route (Chrome camera release helper)
            navigate("/dashboard", { replace: true });
          },
          () => {}
        );

        // ⏱ Auto-close QR if user waits too long
        autoCloseTimer = setTimeout(() => {
          if (!scannedRef.current) {
            onClose();
            stopQrCamera();
          }
        }, 15000); // 15 seconds
      } catch (err) {
        console.error("QR start failed", err);
        await stopQrCamera();
        onClose();
      }
    };

    start();

    // 🔥 HARD CLEANUP ON UNMOUNT
    return () => {
      clearTimeout(autoCloseTimer);
      scannedRef.current = false;
      stopQrCamera();
    };
  }, []);

  /* ================= UI ================= */
  return (
    <div className="editor-overlay">
      <div className="editor-modal max-w-sm">
        <div className="editor-header">
          <span>Scan Printer QR</span>
          <button
            className="close-btn"
            onClick={async () => {
              onClose();
              await stopQrCamera();
            }}
          >
            ✕
          </button>
        </div>

        <div className="p-3">
          <div
            id="html5-qr-reader"
            className="qr-camera-wrapper"
            style={{ width: "100%", height: "280px" }}
          />
        </div>

        <p className="text-sm text-center text-gray-500 pb-4">
          Center the QR code in the box
        </p>
      </div>
    </div>
  );
}
