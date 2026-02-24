"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { doctorPatients, ApprovedPatient } from "@/lib/api";

export function ApprovedPatients() {
  const [patients, setPatients] = useState<ApprovedPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    doctorPatients()
      .then((data) => setPatients(data.patients))
      .catch((error) => {
        console.error("Failed to fetch patients", error);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500 animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        Loading patients...
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        You don&apos;t have access to any patient data yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {patients.map((patient, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
        >
          <div className="flex flex-col">
            <span className="font-medium text-white">{patient.name}</span>
            <span className="text-sm text-gray-400">{patient.email}</span>
            {patient.risk_category && (
              <span className="text-xs text-blue-400/70 mt-1">
                Risk: {patient.risk_category}{" "}
                {patient.risk_score && `(${patient.risk_score}%)`}
              </span>
            )}
            <span className="text-xs text-emerald-500/70 mt-0.5">
              Approved {patient.approved_date}
            </span>
          </div>
          <Link
            href={`/doctor/view/${patient.address}`}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-sm transition-colors"
          >
            <Eye className="w-4 h-4" /> View Data
          </Link>
        </div>
      ))}
    </div>
  );
}
