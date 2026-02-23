"use client";
import { useAccount } from "wagmi";
import { UserCog, Activity, History } from "lucide-react";
import { RequestAccessForm } from "@/components/doctor/RequestAccessForm";
import { ApprovedPatients } from "@/components/doctor/ApprovedPatients";

export default function DoctorDashboard() {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-3xl font-bold mb-4">Connect Wallet Required</h2>
        <p className="text-gray-400">
          Please connect your MetaMask wallet to access the Provider Portal.
        </p>
      </div>
    );
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

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="bg-gray-900/30 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400" /> Request Access
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            Enter a patient's Ethereum wallet address to issue an on-chain data
            request.
          </p>
          <RequestAccessForm />
        </section>

        <section className="bg-gray-900/30 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <History className="w-6 h-6 text-emerald-400" /> Approved Patients
          </h2>
          <p className="text-gray-500 mb-8 text-sm">
            Patients who have explicitly authorized you to decrypt and view
            their VCF records.
          </p>
          <ApprovedPatients />
        </section>
      </div>
    </div>
  );
}
