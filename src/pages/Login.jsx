import { auth, provider, db } from "../services/firebase";
import {
  signInWithPopup,
  signInAnonymously,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  /* =====================
     GOOGLE LOGIN
  ===================== */
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // Create user only on first login
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          balance: 0,
          isGuest: false,
          createdAt: serverTimestamp(),
        });
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Google login failed:", error);
      alert("Login failed. Please try again.");
    }
  };

  /* =====================
     GUEST LOGIN
  ===================== */
  const handleGuestLogin = async () => {
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      // Create guest user doc if first time
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          name: "Guest User",
          email: null,
          photoURL: null,
          balance: 0,
          isGuest: true,
          createdAt: serverTimestamp(),
        });
      }

      navigate("/dashboard");
    } catch (error) {
      console.error("Guest login failed:", error);
      alert("Guest login failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-100">
      <h1 className="text-3xl font-bold">Printingsol</h1>

      {/* Google Login */}
      <button
        onClick={handleGoogleLogin}
        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 w-64"
      >
        Continue with Google
      </button>

      {/* Guest Login */}
      <button
        onClick={handleGuestLogin}
        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 w-64"
      >
        Continue as Guest
      </button>
    </div>
  );
}
