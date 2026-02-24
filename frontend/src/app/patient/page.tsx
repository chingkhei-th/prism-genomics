"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Upload,
  Activity,
  ShieldCheck,
  Clock,
  Database,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { patientActivity, ActivityItem } from "@/lib/api";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      patientActivity()
        .then((data) => setRecentActivities(data.activities))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [user]);

  if (!user) {
    return null; // Redirecting...
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Patient Dashboard
          </h1>
          <p className="text-gray-400">
            Welcome back, {user.name}! Manage your genomic data, view risks, and
            control access permissions.
          </p>
        </div>
        <div className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-sm">
          🟢 Registered
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <Link
          href="/patient/upload"
          className="p-6 rounded-2xl bg-blue-900/10 border border-blue-900/30 hover:bg-blue-900/20 hover:border-blue-500/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Upload className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Upload Data</h3>
          <p className="text-sm text-gray-400">
            Securely encrypt and upload your VCF file.
          </p>
        </Link>

        <Link
          href="/patient/files"
          className="p-6 rounded-2xl bg-cyan-900/10 border border-cyan-900/30 hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Database className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Data Vault</h3>
          <p className="text-sm text-gray-400">
            View past uploads and AI risk reports.
          </p>
        </Link>

        <Link
          href="/patient/permissions"
          className="p-6 rounded-2xl bg-emerald-900/10 border border-emerald-900/30 hover:bg-emerald-900/20 hover:border-emerald-500/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Manage Access</h3>
          <p className="text-sm text-gray-400">
            Approve or revoke doctor permissions.
          </p>
        </Link>
      </div>

      <div className="p-8 rounded-2xl bg-gray-900/30 border border-gray-800">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Recent Activity
        </h2>

        {isLoading ? (
          <div className="flex justify-center items-center py-8 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading Activity...
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent activity found. Upload some genomic data to get started!
          </div>
        ) : (
          <div className="space-y-4">
            {recentActivities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-900/50 border border-gray-800/50"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium text-gray-200">{activity.action}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(activity.date).toLocaleDateString()}{" "}
                    {new Date(activity.date).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div
                  className={`text-sm font-medium px-3 py-1 rounded-full border ${
                    activity.status === "Approved"
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                      : activity.status === "Revoked"
                        ? "text-red-400 bg-red-500/10 border-red-500/20"
                        : "text-blue-400 bg-blue-500/10 border-blue-500/20"
                  }`}
                >
                  {activity.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
