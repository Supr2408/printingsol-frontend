export default function CancellationRefund() {
  return (
    <div className="max-w-4xl mx-auto p-6 text-gray-700">
      <h1 className="text-2xl font-bold mb-4">
        Cancellation & Refund Policy
      </h1>

      <p className="mb-3">
        Once a print order is confirmed and processed, cancellation is not
        possible. Refunds are provided only in cases of payment failure or
        duplicate transactions.
      </p>

      <p>
        For any issues, please contact{" "}
        <a
          href="mailto:printingsolpvtltd@gmail.com"
          className="text-blue-600 underline"
        >
          printingsolpvtltd@gmail.com
        </a>{" "}
        within 24 hours of the transaction.
      </p>
    </div>
  );
}
