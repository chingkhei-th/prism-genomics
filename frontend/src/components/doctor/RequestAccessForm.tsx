"use client";
import { useState } from "react";
import { doctorRequest } from "@/lib/api";
import { Send, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

export function RequestAccessForm() {
  const [patientEmail, setPatientEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsPending(true);
    setIsSuccess(false);
    try {
      await doctorRequest(patientEmail);
      setIsSuccess(true);
      toast.success("Access request sent successfully!");
      setPatientEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send access request");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleRequest} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-400 mb-2">
          Patient Email Address
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="email"
              placeholder="patient@example.com"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !patientEmail}
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
