"use client";
import { useState, useEffect } from "react";
import { ShieldMinus, Loader2 } from "lucide-react";
import { patientPermissions, patientRevoke, PermissionEntry } from "@/lib/api";
import { toast } from "sonner";

export function AccessList({
  refreshKey,
  onAction,
}: {
  refreshKey?: number;
  onAction?: () => void;
}) {
  const [approved, setApproved] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    patientPermissions()
      .then((data) => setApproved(data.approved))
      .catch((err) => {
        toast.error("Failed to load permissions");
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const handleRevoke = async (doc: PermissionEntry) => {
    setActionLoading(doc.email);
    const loadingToastId = toast.loading(
      "Revoking access and updating blockchain. This may take ~15-30s...",
    );
    try {
      await patientRevoke(doc.email);
      setApproved((prev) => prev.filter((d) => d.email !== doc.email));
      if (onAction) onAction();
      toast.success(`Revoked access for ${doc.name}`, { id: loadingToastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke access", {
        id: loadingToastId,
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        Loading...
      </div>
    );
  }

  if (approved.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        You haven&apos;t granted data access to any doctors.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approved.map((doc, i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-blue-900/10 border border-blue-900/30 rounded-xl"
        >
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-white truncate">{doc.name}</span>
            <span className="text-sm text-gray-400 truncate">{doc.email}</span>
            <span className="text-xs text-blue-400/70 mt-1">
              Approved{" "}
              {new Date(doc.date).toLocaleString([], {
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <button
            onClick={() => handleRevoke(doc)}
            disabled={actionLoading === doc.email}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm transition-colors disabled:opacity-50 shrink-0 w-full sm:w-auto"
          >
            {actionLoading === doc.email ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldMinus className="w-4 h-4" />
            )}
            Revoke Access
          </button>
        </div>
      ))}
    </div>
  );
}
