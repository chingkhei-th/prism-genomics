"use client";
import { useState } from "react";
import { useRequestAccess } from "@/hooks/useDataAccess";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function RequestAccessForm() {
  const [patientAddress, setPatientAddress] = useState("");
  const { request, isPending, isSuccess } = useRequestAccess();

  const handleRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientAddress.startsWith("0x") || patientAddress.length !== 42) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }
    request(patientAddress as `0x${string}`);
  };

  return (
    <form onSubmit={handleRequest} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Patient Wallet Address
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="0x..."
            value={patientAddress}
            onChange={(e) => setPatientAddress(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
            required
          />
          <button
            type="submit"
            disabled={isPending || !patientAddress}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Request
          </button>
        </div>
      </div>
      {isSuccess && (
        <div className="p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-sm">
          Access request submitted successfully! Waiting for patient approval.
        </div>
      )}
    </form>
  );
}
