"use client";
import Link from "next/link";
import { Eye, ShieldAlert } from "lucide-react";

export function ApprovedPatients() {
  // In a real app we'd fetch this from the backend indexer / smart contract events
  // using generic mock data here
  const approvedPatients = [
    {
      address: "0xaaaa...bbbb",
      name: "Patient #428",
      approvedDate: "Just now",
    },
  ];

  if (approvedPatients.length === 0) {
    return (
      <div className="p-8 border-2 border-dashed border-gray-800 rounded-2xl text-center text-gray-500">
        You don't have access to any patient data yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {approvedPatients.map((patient, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 bg-gray-900/40 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
        >
          <div className="flex flex-col">
            <span className="font-medium text-white">{patient.name}</span>
            <span className="text-sm font-mono text-gray-400">
              {patient.address}
            </span>
            <span className="text-xs text-emerald-500/70 mt-1">
              Approved {patient.approvedDate}
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
