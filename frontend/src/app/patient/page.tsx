"use client";

import Link from "next/link";
import { Upload, Activity, ShieldCheck, Clock } from "lucide-react";
import { useIsPatient } from "@/hooks/usePatientRegistry";
import { useAccount } from "wagmi";

export default function PatientDashboard() {
  const { address } = useAccount();
  const { data: isRegistered, isLoading } = useIsPatient(address);

  // In a real app, this would be fetched from IPFS/Backend status
  const recentActivities = [
    {
      id: 1,
      action: "VCF Data Uploaded",
      date: "2 Hours ago",
      status: "Encrypted",
    },
    {
      id: 2,
      action: "Risk Analysis Completed",
      date: "1 Hour ago",
      status: "View Results",
    },
  ];

  if (!address) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Connect Wallet Required</h2>
        <p className="text-gray-400">
          Please connect your MetaMask wallet to access the Patient Portal.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center animate-pulse">
        Checking registration status...
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Patient Dashboard
          </h1>
          <p className="text-gray-400">
            Manage your genomic data, view risks, and control access
            permissions.
          </p>
        </div>
        {!isRegistered && (
          <div className="px-4 py-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-lg text-sm">
            Not Registered
          </div>
        )}
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
          href="/patient/results"
          className="p-6 rounded-2xl bg-purple-900/10 border border-purple-900/30 hover:bg-purple-900/20 hover:border-purple-500/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Activity className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Risk Results</h3>
          <p className="text-sm text-gray-400">
            View your Polygenic Risk Scores (PRS).
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

        <Link
          href="/audit"
          className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800 hover:bg-gray-800/60 hover:border-gray-600 transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Audit Trail</h3>
          <p className="text-sm text-gray-400">View on-chain access logs.</p>
        </Link>
      </div>

      <div className="p-8 rounded-2xl bg-gray-900/30 border border-gray-800">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Recent Activity
        </h2>

        <div className="space-y-4">
          {recentActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-gray-900/50 border border-gray-800/50"
            >
              <div className="mb-2 sm:mb-0">
                <p className="font-medium text-gray-200">{activity.action}</p>
                <p className="text-sm text-gray-500">{activity.date}</p>
              </div>
              <div className="text-blue-400 text-sm font-medium px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                {activity.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
