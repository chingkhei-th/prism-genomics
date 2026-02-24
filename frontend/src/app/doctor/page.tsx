"use client";
import { UserCog, Activity, History } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { RequestAccessForm } from "@/components/doctor/RequestAccessForm";
import { ApprovedPatients } from "@/components/doctor/ApprovedPatients";

export default function DoctorDashboard() {
  const { user } = useAuth();

  if (!user) {
    return null; // Redirecting...
  }

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <UserCog className="w-10 h-10 text-blue-500" /> Provider Portal
        </h1>
        <p className="text-gray-400">
          Request access to patient genomic records and analyze clinical risk
          data.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        <section className="bg-gray-900/30 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" /> Request Access
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            Enter a patient&apos;s email address to request access to their
            genomic data.
          </p>
          <RequestAccessForm />
        </section>

        <section className="bg-gray-900/30 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" /> Approved Patients
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            Patients who have authorized you to decrypt and view their VCF
            records.
          </p>
          <ApprovedPatients />
        </section>
      </div>
    </div>
  );
}
