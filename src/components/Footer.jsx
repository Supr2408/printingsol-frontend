export default function Footer() {
  return (
    <footer className="bg-[#0f1b3d] text-gray-300 text-xs py-6 mt-10">
      <div className="flex flex-wrap justify-center gap-4 px-4 text-center">
        <a href="/about" className="hover:underline">About Us</a>
        <a href="/privacy-policy" className="hover:underline">Privacy Policy</a>
        <a href="/terms" className="hover:underline">Terms and Condition</a>
        <a href="/contact" className="hover:underline">Contact Us</a>
        <a href="/refund" className="hover:underline">Cancellation and Refund</a>
        <a href="/shipping" className="hover:underline">Shipping and Delivery</a>
      </div>

      <p className="text-center mt-3 text-gray-400">
        © 2025 Printingsol. All rights reserved.
      </p>
    </footer>
  );
}
