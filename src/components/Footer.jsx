import { Link } from "react-router-dom"; // Import Link

export default function Footer() {
  return (
    <footer className="bg-[#0f1b3d] text-gray-300 text-xs py-6 mt-10">
      <div className="flex flex-wrap justify-center gap-4 px-4 text-center">
        {/* Replace <a> with <Link> and 'href' with 'to' */}
        <Link to="/about" className="hover:underline">About Us</Link>
        <Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
        <Link to="/terms" className="hover:underline">Terms and Condition</Link>
        <Link to="/contact" className="hover:underline">Contact Us</Link>
        <Link to="/refund" className="hover:underline">Cancellation and Refund</Link>
        <Link to="/shipping" className="hover:underline">Shipping and Delivery</Link>
      </div>

      <p className="text-center mt-3 text-gray-400">
        © 2025 Printingsol. All rights reserved.
      </p>
    </footer>
  );
}