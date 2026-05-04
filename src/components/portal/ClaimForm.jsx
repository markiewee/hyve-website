import { useState } from "react";
import { useClaims } from "../../hooks/useClaims";

const CATEGORIES = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "CLEANING_SUPPLIES", label: "Cleaning supplies" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "OTHER", label: "Other" },
];

export default function ClaimForm({ propertyId, propertyName, prefill, onSuccess }) {
  const { submitClaim } = useClaims({ scope: "none" });
  const [category, setCategory] = useState(prefill?.category ?? "PLUMBING");
  const [amount, setAmount] = useState(prefill?.amount ?? "");
  const [description, setDescription] = useState(prefill?.description ?? "");
  const [receiptFile, setReceiptFile] = useState(null);
  const [itemFile, setItemFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!receiptFile || !itemFile) {
      setError("Both receipt and item photos are required.");
      return;
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const claim = await submitClaim({
        propertyId, category, amount: numAmount, description,
        receiptFile, itemFile,
      });
      onSuccess?.(claim);
    } catch (err) {
      setError(err.message ?? "Failed to submit claim.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Property</label>
        <input
          type="text"
          value={propertyName ?? ""}
          readOnly
          className="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Amount (SGD)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">What was this for?</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="e.g. Replaced kitchen sink trap, was leaking"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Receipt photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Item photo</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          onChange={(e) => setItemFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 text-white py-2 font-medium disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit claim"}
      </button>
    </form>
  );
}
