import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer"> {/* Use the class from layout.css */}
      <div className="flex flex-wrap justify-center gap-4 px-4 text-center">
        <Link to="/about" className="hover:underline">About Us</Link>
        <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:underline">Terms and Condition</Link>
        <Link to="/contact" className="hover:underline">Contact Us</Link>
        <Link to="/refund" className="hover:underline">Cancellation and Refund</Link>
        <Link to="/shipping" className="hover:underline">Shipping and Delivery</Link>
      </div>
      <p className="mt-3 opacity-70">© 2026 Printingsol. All rights reserved.</p>
    </footer>
  );
}