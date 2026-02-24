"use client";
import { useState, useEffect } from "react";
import { ShieldCheck, XCircle, Loader2 } from "lucide-react";
import { patientPermissions, patientApprove, PermissionEntry } from "@/lib/api";
import { toast } from "sonner";

export function PendingRequests() {
  const [pending, setPending] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    patientPermissions()
      .then((data) => setPending(data.pending))
      .catch((err) => {
        toast.error("Failed to load pending requests");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (doc: PermissionEntry) => {
    setActionLoading(doc.email);
    try {
      await patientApprove(doc.email);
      setPending((prev) => prev.filter((d) => d.email !== doc.email));
      toast.success(`Approved access for ${doc.name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to approve access");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading requests...
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        No pending access requests.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pending.map((doc, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gray-900/40 border border-gray-800 rounded-xl"
        >
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-white truncate">{doc.name}</span>
            <span className="text-sm text-gray-400 truncate">{doc.email}</span>
            <span className="text-xs text-gray-500 mt-1">
              Requested {doc.date}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleApprove(doc)}
              disabled={actionLoading === doc.email}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0"
            >
              {actionLoading === doc.email ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Approve
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 rounded-lg text-sm transition-colors shrink-0">
              <XCircle className="w-4 h-4" /> Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
