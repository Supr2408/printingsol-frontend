import { useEffect, useRef, useState } from "react";
import { db } from "../../services/firebase";
import {
  doc,
  setDoc,
  increment,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

export default function RechargeModal({
  user,
  onClose,
  defaultAmount = 0,
  autoStart = false,
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const startedRef = useRef(false);

  const startRecharge = () => {
    const value = Number(amount);
    if (!value || value <= 0) return;

    if (!window.Razorpay) {
      alert("Razorpay not loaded");
      return;
    }

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: value * 100,
      currency: "INR",
      name: "Printingsol",
      description: "Wallet Recharge",

      handler: async function (response) {
        try {
          await setDoc(
            doc(db, "users", user.uid),
            { balance: increment(value) },
            { merge: true }
          );

          await addDoc(
            collection(db, "users", user.uid, "transactions"),
            {
              type: "credit",
              amount: value,
              paymentID: response.razorpay_payment_id,
              createdAt: serverTimestamp(),
            }
          );

          alert("Recharge successful 🎉");
        } catch (err) {
          console.error(err);
          alert("Payment done, but wallet update failed");
        }
      },

      prefill: {
        name: user.displayName || "",
        email: user.email || "",
      },

      theme: { color: "#4361ee" },
    };

    onClose(); // 🔥 close modal before opening Razorpay
    new window.Razorpay(options).open();
  };

  // 🔒 auto-start only once
  useEffect(() => {
    if (autoStart && defaultAmount > 0 && !startedRef.current) {
      startedRef.current = true;
      setTimeout(startRecharge, 300);
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div className="editor-overlay">
      <div className="editor-modal max-w-sm">
        <div className="editor-header pt-safe">
          <span>Recharge Wallet</span>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="p-4 space-y-4">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Enter amount (₹)"
          />

          <button
            onClick={startRecharge}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold"
          >
            Pay ₹{amount || 0}
          </button>
        </div>
      </div>
    </div>
  );
}
