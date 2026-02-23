"use client";
import { useAccount } from "wagmi";
import { ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { useApproveAccess } from "@/hooks/useDataAccess";
import { toast } from "sonner";

export function PendingRequests() {
  const { address } = useAccount();
  const { approve, isPending } = useApproveAccess();

  // In a real app we'd fetch this from the backend indexer / smart contract events
  // using generic mock data here
  const pendingDoctors = [
    { address: "0x1234...5678", name: "Dr. Alice Smith", date: "2 Hours ago" },
  ];

  if (!address || pendingDoctors.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        No pending access requests.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingDoctors.map((doc, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl"
        >
          <div className="flex flex-col">
            <span className="font-medium text-white">{doc.name}</span>
            <span className="text-sm font-mono text-gray-400">
              {doc.address}
            </span>
            <span className="text-xs text-gray-500 mt-1">
              Requested {doc.date}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                approve(doc.address as `0x${string}`);
                toast.success("Approval transaction initiated");
              }}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-sm transition-colors"
            >
              <ShieldCheck className="w-4 h-4" /> Approve
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg text-sm transition-colors">
              <XCircle className="w-4 h-4" /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
