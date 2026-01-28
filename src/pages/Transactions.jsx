import { useEffect, useState } from "react";
import { auth, db } from "../services/firebase";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";

/* =========================
   SAFE DATE NORMALIZER
========================= */
const normalizeDate = (createdAt) => {
  if (!createdAt) return new Date(0);
  if (createdAt.toDate) return createdAt.toDate();
  if (typeof createdAt === "number") return new Date(createdAt);
  return new Date(createdAt);
};

export default function Transactions() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  /* =========================
     WAIT FOR AUTH
  ========================= */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  /* =========================
     FETCH TRANSACTIONS
  ========================= */
  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "transactions");

    const unsub = onSnapshot(ref, (snapshot) => {
      const list = snapshot.docs
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            _date: normalizeDate(data.createdAt),
          };
        })
        // 🔥 GUARANTEED newest-first ordering
        .sort((a, b) => b._date - a._date);

      setTransactions(list);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        Loading transactions…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-sm"
          >
            ← Back
          </button>

          <h1 className="text-2xl font-bold">
            Transaction History
          </h1>
        </div>

        {transactions.length === 0 && (
          <div className="bg-white p-6 rounded-xl shadow text-center text-gray-500">
            No transactions found.
          </div>
        )}

        <div className="space-y-4">
          {transactions.map((tx) => {
            const isCredit = tx.type === "credit";

            return (
              <div
                key={tx.id}
                className="bg-white p-4 rounded-xl shadow flex justify-between items-center"
              >
                <div>
                  <p
                    className={`font-semibold text-lg ${
                      isCredit ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isCredit ? "+" : "−"} ₹ {tx.amount}
                  </p>

                  <p className="text-sm text-gray-500">
                    {isCredit ? "Wallet Recharge" : "Print Payment"}
                  </p>
                </div>

                <p className="text-sm text-gray-400 text-right">
                  {tx._date.toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
