export default function About() {
  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-700 leading-relaxed">
      <h1 className="text-2xl font-bold text-blue-900 mb-4">
        About Printingsol Technologies
      </h1>

      <p className="mb-4">
        <strong>Printingsol</strong> is a next-generation digital printing solution
        designed to make document printing easier, faster, and more affordable
        for students and professionals. Our automated platform integrates cloud
        storage, QR-based uploads, and secure local printing systems to eliminate
        queues, reduce costs, and protect document privacy.
      </p>

      <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-2">
        Our Mission
      </h2>
      <p className="mb-4">
        Our mission is to simplify access to high-quality printing services
        through technology. We aim to provide a <em>fully automated Xerox and
        print experience</em> where users can upload, pay, and print — all in
        seconds — with complete transparency in pricing.
      </p>

      <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-2">
        Our Vision
      </h2>
      <p className="mb-4">
        To bring secure, cost-effective, and eco-friendly printing solutions to
        schools, colleges, and workplaces across India. We envision SmartPrint
        kiosks available on every campus to help students print their work
        instantly and reliably.
      </p>

      <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-2">
        Why Choose SmartPrint?
      </h2>
      <ul className="list-disc pl-6 mb-4">
        <li>Automated QR-based file upload system</li>
        <li>Secure payment via Razorpay integration</li>
        <li>Cost calculated by black pixel density for fair pricing (in progress)</li>
        <li>Local print processing to ensure data confidentiality</li>
        <li>User wallet system for fast repeat transactions</li>
      </ul>

      <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-2">
        Our Story
      </h2>
      <p className="mb-4">
        Printingsol began as a college innovation project to solve a simple
        problem — the daily struggle of finding a working printer or waiting in
        long queues. What started as a prototype for campus use has now evolved
        into a scalable solution that combines IoT hardware (like Raspberry Pi)
        and intelligent software integration to make printing seamless.
      </p>

      <h2 className="text-xl font-semibold text-blue-900 mt-6 mb-2">
        Contact Information
      </h2>
      <p>
        Printingsol<br />
        Email:{" "}
        <a
          href="mailto:printingsolpvtltd@gmail.com"
          className="text-blue-600 underline"
        >
          printingsolpvtltd@gmail.com
        </a>
        <br />
        Phone: +91 99042 27669
        <br />
        Website:{" "}
        <a
          href="https://printingsoltesting.vercel.app"
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline"
        >
          https://printingsoltesting.vercel.app
        </a>
      </p>

      <p className="mt-8 text-sm text-gray-500">
        © 2026 Printingsol. All rights reserved.
      </p>
    </div>
  );
}
