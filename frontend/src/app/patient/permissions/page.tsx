"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { PendingRequests } from "@/components/patient/PendingRequests";
import { AccessList } from "@/components/patient/AccessList";

export default function PermissionsPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey((prev) => prev + 1);
  return (
    <div className="container mx-auto px-6 py-12">
      <Link
        href="/patient"
        className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Link>

      <div className="max-w-7xl mx-auto">
        <div className="mb-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center border border-emerald-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              Access Permissions
            </h1>
            <p className="text-gray-400 mt-1">
              Manage which healthcare providers can decrypt and view your
              genomic data.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          <section className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6 text-yellow-500 border-b border-gray-800 pb-4">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-xl font-bold text-white">Pending Requests</h2>
            </div>
            <PendingRequests
              refreshKey={refreshKey}
              onAction={triggerRefresh}
            />
          </section>

          <section className="bg-gray-900/20 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6 text-emerald-500 border-b border-gray-800 pb-4">
              <ShieldCheck className="w-5 h-5" />
              <h2 className="text-xl font-bold text-white">
                Approved Providers
              </h2>
            </div>
            <AccessList refreshKey={refreshKey} onAction={triggerRefresh} />
          </section>
        </div>
      </div>
    </div>
  );
}
