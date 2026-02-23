"use client";
import { useAccount } from "wagmi";
import { ShieldMinus } from "lucide-react";
import { useRevokeAccess } from "@/hooks/useDataAccess";
import { toast } from "sonner";

export function AccessList() {
  const { address } = useAccount();
  const { revoke, isPending } = useRevokeAccess();

  // Mock approved doctors
  const approvedDoctors = [
    {
      address: "0x8765...4321",
      name: "Dr. Bob Williams",
      approvedDate: "Jan 15, 2024",
    },
  ];

  if (!address || approvedDoctors.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        You haven't granted data access to any doctors.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvedDoctors.map((doc, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl"
        >
          <div className="flex flex-col">
            <span className="font-medium text-white">{doc.name}</span>
            <span className="text-sm font-mono text-gray-400">
              {doc.address}
            </span>
            <span className="text-xs text-blue-400/70 mt-1">
              Approved {doc.approvedDate}
            </span>
          </div>
          <button
            onClick={() => {
              revoke(doc.address as `0x${string}`);
              toast.success("Revocation transaction initiated");
            }}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm transition-colors"
          >
            <ShieldMinus className="w-4 h-4" /> Revoke Access
          </button>
        </div>
      ))}
    </div>
  );
}
