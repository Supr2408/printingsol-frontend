import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

import { useEffect, useState, useRef } from "react";
import { auth, db } from "../services/firebase";
import {
  doc,
  onSnapshot,
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useNavigate, useLocation } from "react-router-dom";

import PdfEditorModal from "../components/Modals/PdfEditorModal";
import QrScanModal from "../components/Modals/QrScanModal";
import RechargeModal from "../components/Modals/RechargeModal";
import { sendPrintRequest } from "../services/printer";
import ImageEditorModal from "../components/Modals/ImageEditorModal";
import CameraPhotoDetection from "../components/Modals/camaraPhotoDetection";

// Base prices
const PRICE_SINGLE_PAGE = 2; // ₹2 per page
const PRICE_DUPLEX_SHEET = 3; // ₹3 per sheet (2 pages)

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = auth.currentUser;

  /* ================= STATE MANAGEMENT ================= */
  const [userData, setUserData] = useState(null);
  const [file, setFile] = useState(null);
  const [isImageFile, setIsImageFile] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [originalPages, setOriginalPages] = useState(0);

  const [printSettings, setPrintSettings] = useState({
    pages: 0,
    copies: 1,
    layout: "single",
    duplex: false,
  });

  const printInProgressRef = useRef(false);
  const printSessionRef = useRef(0);



  /* ================= PRICING LOGIC ================= */
  const calculateTotalCost = () => {
    const { pages, copies, duplex } = printSettings;
    const numPages = Number(pages) || 0;
    const numCopies = Number(copies) || 1;
    const totalDocPages = numPages * numCopies;

    if (totalDocPages <= 0) return 0;

    if (duplex) {
      const physicalSheets = Math.ceil(totalDocPages / 2);
      return physicalSheets * PRICE_DUPLEX_SHEET;
    } else {
      return totalDocPages * PRICE_SINGLE_PAGE;
    }
  };

  const totalCost = calculateTotalCost();

  /* ================= UI FLOW STATE ================= */
  const [showChoice, setShowChoice] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false); 
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showRecharge, setShowRecharge] = useState(false);
  const [autoRechargeAmount, setAutoRechargeAmount] = useState(0);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showPhotoSourceChoice, setShowPhotoSourceChoice] = useState(false);
  const fileInputRef = useRef(null);

  /* ================= DATA SYNC & EFFECTS ================= */
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setUserData(snap.data());
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (location.state?.autoRechargeAmount) {
      setAutoRechargeAmount(location.state.autoRechargeAmount);
      setShowRecharge(true);
      navigate("/dashboard", { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    const close = () => setShowAccountMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  /* ================= FILE HANDLING ================= */
  const onFileChange = async (e, type) => {
    const f = e.target.files[0];
    if (!f) return;

    setFile(f);
    const isImage = type === "image";
    setIsImageFile(isImage);
    setShowChoice(false);
    setShowImageEditor(false);

    // Reset view states
    setShowQuickSettings(false);
    setShowEditor(false);

    if (isImage) {
      // FOR IMAGES: Bypass choice menu and go straight to editor
      setShowChoice(false); 
      setShowImageEditor(true);
      setOriginalPages(1);
      setPrintSettings({
        pages: 1,
        copies: 1,
        layout: "portrait",
        duplex: false,
      });
    } else {
      // FOR PDF: Show the "Original or Customize" choice menu
      setShowChoice(true);
      setShowImageEditor(false);
      try {
        const buffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        setOriginalPages(pdf.numPages);
        setPrintSettings({
          pages: pdf.numPages,
          copies: 1,
          layout: "single",
          duplex: false,
        });
      } catch (err) {
        alert("Could not read PDF file.");
      }
    }
  };

  const handleCameraCapture = (imageBlob) => {
    const capturedFile = new File([imageBlob], `scan_${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setFile(capturedFile);
    setIsImageFile(true);
    setOriginalPages(1);
    setPrintSettings({
      pages: 1,
      copies: 1,
      layout: "portrait",
      duplex: false,
    });
    setShowChoice(false); // Ensure choice menu is hidden
    setShowCameraScanner(false);
    setShowImageEditor(true);
  };

  /* ================= PRINT EXECUTION ================= */

 const resetPrintFlow = () => {
  setFile(null);
  setIsImageFile(false);
  setOriginalPages(0);

  setShowChoice(false);
  setShowQuickSettings(false);
  setShowEditor(false);
  setShowImageEditor(false);

  if (fileInputRef.current) {
    fileInputRef.current.value = "";
  }
};




const handlePrinterScan = async (printerUrl) => {
   
  if (printInProgressRef.current) return;
  printInProgressRef.current = true;
  setShowQrScanner(false);

   if (!file) {
  printInProgressRef.current = false;
  return;
}

  try {
    await sendPrintRequest({
      printerUrl,
      file,
      settings: printSettings,
      amount: totalCost,
      userId: user.uid,
    });

    await addDoc(collection(db, "users", user.uid, "transactions"), {
      type: "debit",
      amount: totalCost,
      pages: printSettings.pages * printSettings.copies,
      createdAt: serverTimestamp(),
    });

    alert("🖨️ Print started");
    resetPrintFlow();

    // RESET UI

setFile(null);
setIsImageFile(false);
setOriginalPages(0);

setShowChoice(false);
setShowEditor(false);
setShowImageEditor(false);
setShowQuickSettings(false);

// 🔥 THIS LINE FIXES IT
if (fileInputRef.current) {
  fileInputRef.current.value = "";
}




  } catch (err) {
    console.error(err);
    alert("Print failed");
  } finally {
    // 🔓 UNLOCK FOR NEXT PRINT
    printInProgressRef.current = false;
    printSessionRef.current = 0;
  }
  
};



  const initiatePrintRequest = () => {
  const balance = userData.balance || 0;
  if (balance < totalCost) {
    setAutoRechargeAmount(totalCost - balance);
    setShowRecharge(true);
  } else {
    printSessionRef.current += 1;   // 🔥 NEW SESSION
    setShowQrScanner(true);
  }
};


  if (!userData) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-blue-600 font-medium text-lg">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-10">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 flex justify-between items-center px-4 py-4 bg-blue-600 text-white shadow-lg z-50 pt-safe">
        <h1 className="text-xl font-bold tracking-tight">Printingsol</h1>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAccountMenu((v) => !v);
            }}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
          >
            <img
              src={userData.photoURL || "/avatar.png"}
              alt="avatar"
              className="w-7 h-7 rounded-full border border-white/50"
            />
            <span className="font-medium text-sm">
              {userData.isGuest ? "Guest" : userData.name}
            </span>
          </button>
          {showAccountMenu && (
            <div
              className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl z-50 overflow-hidden border border-gray-100"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-4 bg-gray-50 border-b">
                <p className="text-xs text-gray-500 uppercase font-bold">
                  Wallet Balance
                </p>
                <p className="text-xs text-gray-500 uppercase font-bold">
                  ₹ {userData.balance.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => navigate("/transactions")}
                className="text-xs text-gray-500 uppercase font-bold"
              >
                📄 History
              </button>
              <button
                onClick={() => setShowRecharge(true)}
                className="text-xs text-gray-500 uppercase font-bold"
              >
                💳 Recharge
              </button>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 uppercase font-bold"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="pt-28 p-4 max-w-lg mx-auto space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => onFileChange(e, "image")}
        />

        <div className="bg-gradient-to-br from-blue-700 to-blue-500 rounded-3xl p-6 text-white shadow-xl shadow-blue-100">
          <p className="text-blue-100 text-sm font-medium">Available Balance</p>
          <div className="flex justify-between items-end">
            <h2 className="text-3xl font-bold">
              ₹ {userData.balance.toFixed(2)}
            </h2>
            <button
              onClick={() => setShowRecharge(true)}
              className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg text-sm font-bold backdrop-blur-md transition-all"
            >
              + Add Money
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest px-1">
            1. Select File Type
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <label
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all bg-white cursor-pointer ${
                file && !isImageFile
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 hover:border-blue-400"
              }`}
            >
              <input
                type="file"
                accept=".pdf"
                hidden
                onChange={(e) => onFileChange(e, "pdf")}
              />
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  file && !isImageFile
                    ? "bg-green-500 text-white"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {file && !isImageFile ? "✓" : "📄"}
              </div>
              <p className="font-bold text-gray-700">PDF Document</p>
            </label>

            <div
              onClick={() => setShowPhotoSourceChoice(true)}
              className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 transition-all bg-white cursor-pointer ${
                file && isImageFile
                  ? "border-green-400 bg-green-50"
                  : "border-gray-200 hover:border-purple-400"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                  file && isImageFile
                    ? "bg-green-500 text-white"
                    : "bg-purple-50 text-purple-500"
                }`}
              >
                {file && isImageFile ? "✓" : "🖼️"}
              </div>
              <p className="font-bold text-gray-700">Photo / Image</p>
            </div>
          </div>

          {file && (
            <div className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="text-xl">{isImageFile ? "🖼️" : "📄"}</span>
                <p className="text-sm font-semibold text-gray-700 truncate">
                  {file.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setShowChoice(false);
                  setShowQuickSettings(false);
                  setPrintSettings({ pages: 0, copies: 1, layout: "single", duplex: false });
                }}
                className="text-red-500 text-xs font-bold px-2"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* This menu ONLY shows for PDFs now */}
        {file && !isImageFile && showChoice && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 animate-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4">
              2. Printing Options
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowQuickSettings(true);
                  setShowChoice(false);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-50 hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <div className="text-2xl mb-1">⚡</div>
                <span className="font-bold text-gray-800">Use Original</span>
              </button>
              <button
                onClick={() => {
                  setShowChoice(false);
                  setShowEditor(true);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-50 hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <div className="text-2xl mb-1">🎨</div>
                <span className="font-bold text-gray-800">Customize</span>
              </button>
            </div>
          </div>
        )}

        {/* FINAL REVIEW / QUICK SETTINGS SECTION */}
        {showQuickSettings && (
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">
                3. Final Review
              </h3>
              <button
                onClick={() => {
                   if(isImageFile) {
                     setShowImageEditor(true);
                     setShowQuickSettings(false);
                   } else {
                     setShowChoice(true);
                     setShowQuickSettings(false);
                   }
                }}
                className="text-blue-600 text-xs font-bold"
              >
                Edit Settings
              </button>
            </div>

            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-2xl">
              <span className="font-bold text-gray-700">Copies</span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    setPrintSettings((s) => ({
                      ...s,
                      copies: Math.max(1, s.copies - 1),
                    }))
                  }
                  className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl font-black text-blue-600"
                >
                  −
                </button>
                <span className="text-lg font-black w-4 text-center">
                  {printSettings.copies}
                </span>
                <button
                  onClick={() =>
                    setPrintSettings((s) => ({ ...s, copies: s.copies + 1 }))
                  }
                  className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl font-black text-blue-600"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() =>
                setPrintSettings((s) => ({ ...s, duplex: !s.duplex }))
              }
              className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                printSettings.duplex
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-100 bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">
                  {printSettings.duplex ? "📖" : "📄"}
                </span>
                <div className="text-left">
                  <span className="block font-bold text-gray-700">
                    Two-Sided Printing
                  </span>
                  <span className="block text-[10px] text-blue-600 font-bold uppercase">
                    Save Money: ₹3/sheet
                  </span>
                </div>
              </div>
              <div
                className={`w-12 h-6 rounded-full relative transition-colors ${
                  printSettings.duplex ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <div
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                    printSettings.duplex ? "right-1" : "left-1"
                  }`}
                />
              </div>
            </button>

            <div className="pt-4 border-t border-dashed border-gray-200">
              <div className="flex justify-between items-center mb-4 px-2">
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase">
                    Total Bill
                  </p>
                  <p className="text-3xl font-black text-gray-900">
                    ₹ {totalCost.toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 font-bold uppercase">
                    Physical Sheets
                  </p>
                  <p className="text-lg font-bold text-gray-700">
                    {printSettings.duplex
                      ? Math.ceil((printSettings.pages * printSettings.copies) / 2)
                      : printSettings.pages * printSettings.copies}
                  </p>
                </div>
              </div>

              <button
                onClick={initiatePrintRequest}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-lg shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <span>🚀</span> Send Print Request
              </button>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {showCameraScanner && (
        <CameraPhotoDetection
          key="camera-modal"
          onCapture={handleCameraCapture}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

      {showEditor && !isImageFile && file && (
      <PdfEditorModal
        file={file}
        onClose={() => {
          setShowEditor(false);
          setShowChoice(true);
        }}
        onConfirm={(data) => {
          // 1. UPDATE THE FILE: This is the missing piece!
          // 'data.file' contains the new PDF with multiple pages per sheet.
          if (data.file) {
            setFile(data.file);
          }

          // 2. Update the settings (pages should now reflect the new sheet count)
          setPrintSettings({
            pages: Number(data.pages),
            copies: Number(data.copies || 1),
            layout: data.layout || "single",
            duplex: !!data.duplex,
          });

          setShowEditor(false);
          setShowQuickSettings(true);
        }}
      />
    )}

      {showImageEditor && file && (
        <ImageEditorModal
          file={file}
          onClose={() => {
            setShowImageEditor(false);
            // If user cancels, we just go back to the main view
            setFile(null); 
          }}
          onLaunchCamera={() => setShowCameraScanner(true)}
          onConfirm={(data) => {
            if (data.file) setFile(data.file);
            setPrintSettings({
              pages: Number(data.pages),
              copies: Number(data.copies || 1),
              layout: data.layout || "portrait",
              duplex: !!data.duplex,
            });
            setShowImageEditor(false);
            setShowQuickSettings(true);
          }}
        />
      )}

      {showQrScanner && (
      <QrScanModal
        key={printSessionRef.current}   // 🔥 session-bound
        onClose={() => setShowQrScanner(false)}
        onScan={handlePrinterScan}
      />
    )}


      {showRecharge && (
        <RechargeModal
          user={user}
          defaultAmount={autoRechargeAmount}
          autoStart={autoRechargeAmount > 0}
          onClose={() => {
            setShowRecharge(false);
            setAutoRechargeAmount(0);
          }}
        />
      )}

      {showPhotoSourceChoice && (
        <div
          className="fixed inset-0 bg-black/50 flex justify-center items-end modal-safe"
          onClick={() => setShowPhotoSourceChoice(false)}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-in slide-in-from-bottom-full duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-4 text-center">Capture or Upload</h3>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setShowPhotoSourceChoice(false);
                  setShowCameraScanner(true);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-50 border-2 border-blue-100 active:scale-95 transition-transform"
              >
                <span className="text-3xl">📸</span>
                <span className="font-bold text-blue-700 text-sm">Live Camera</span>
              </button>
              <button
                onClick={() => {
                  setShowPhotoSourceChoice(false);
                  fileInputRef.current.click();
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-purple-50 border-2 border-purple-100 active:scale-95 transition-transform"
              >
                <span className="text-3xl">📁</span>
                <span className="font-bold text-purple-700 text-sm">Gallery</span>
              </button>
            </div>
            <button
              onClick={() => setShowPhotoSourceChoice(false)}
              className="w-full mt-4 py-3 font-bold text-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}