"use client";
import Link from "next/link";
import { ArrowLeft, UserSquare2 } from "lucide-react";
import { PatientDataViewer } from "@/components/doctor/PatientDataViewer";
import { use } from "react";

export default function ViewPatientPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);

  return (
    <div className="container mx-auto px-6 py-12">
      <Link
        href="/doctor"
        className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Link>

      <div className="max-w-5xl mx-auto">
        <div className="mb-10 flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20">
            <UserSquare2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">
              Patient Records
            </h1>
            <p className="font-mono text-gray-400 text-sm bg-gray-900 inline-block px-3 py-1 rounded border border-gray-800">
              {address}
            </p>
          </div>
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <PatientDataViewer patientAddress={address} />
        </div>
      </div>
    </div>
  );
}
