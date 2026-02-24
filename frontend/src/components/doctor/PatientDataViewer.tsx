"use client";
import { useState, useEffect } from "react";
import { KeyRound, Download, FileText, LockOpen, Loader2 } from "lucide-react";
import {
  RiskGauge,
  RiskCategory,
} from "@/components/patient/RiskVisualizations";
import { doctorViewData, RiskReport } from "@/lib/api";
import { toast } from "sonner";

interface PatientData extends RiskReport {
  cid: string;
  blake3_hash: string;
}

export function PatientDataViewer({
  patientAddress,
}: {
  patientAddress: string;
}) {
  const [data, setData] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    doctorViewData(patientAddress)
      .then((res) => setData(res as PatientData))
      .catch((err) => {
        console.error(err);
        toast.error("Failed to fetch patient data.");
      })
      .finally(() => setIsLoading(false));
  }, [patientAddress]);

  if (isLoading) {
    return (
      <div className="p-8 text-center animate-pulse text-gray-400 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading authorized genomic data records...
      </div>
    );
  }

  if (!data || !data.cid) {
    return (
      <div className="p-8 bg-red-500/10 border border-red-500/30 rounded-2xl text-center text-red-500">
        No genomic data uploaded by this patient or access was revoked.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" /> On-Chain Record
          </h3>
          <div className="space-y-3 font-mono text-sm break-all">
            <div>
              <span className="text-gray-500 block mb-1">IPFS CID:</span>
              <span className="text-blue-300">{data.cid}</span>
            </div>
            <div>
              <span className="text-gray-500 block mb-1">Integrity Hash:</span>
              <span className="text-purple-300">{data.blake3_hash}</span>
            </div>
          </div>
        </div>

        {/* Display Risk Report Insights */}
        <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl flex flex-col justify-center">
          <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
            <LockOpen className="w-5 h-5 text-emerald-500" /> Authorized AI
            Analysis
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {data.risk_assessment?.risk_level && (
              <RiskCategory category={data.risk_assessment.risk_level} />
            )}
            <RiskGauge
              value={(data.risk_assessment?.disease_probability || 0) * 100}
            />
          </div>
        </div>
      </div>

      {data.variant_analysis?.high_impact_variants &&
        data.variant_analysis.high_impact_variants.length > 0 && (
          <div className="mt-8 p-6 bg-gray-900/40 border border-gray-800 rounded-2xl">
            <h3 className="text-xl font-bold mb-6 text-white text-center">
              High-Impact Pathogenic Variants
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase text-xs border-b border-gray-800">
                    <th className="text-left pb-3 pr-4">rsID</th>
                    <th className="text-left pb-3 pr-4">Chr</th>
                    <th className="text-left pb-3 pr-4">Position</th>
                    <th className="text-left pb-3 pr-4">Genotype</th>
                    <th className="text-left pb-3">Disease</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {data.variant_analysis.high_impact_variants.map((v, i) => (
                    <tr
                      key={i}
                      className="hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 pr-4 font-mono text-blue-400">
                        {v.rsid}
                      </td>
                      <td className="py-3 pr-4 text-gray-300">
                        {v.chromosome}
                      </td>
                      <td className="py-3 pr-4 font-mono text-gray-400">
                        {v.position.toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-xs font-mono">
                          {v.genotype}
                        </span>
                      </td>
                      <td className="py-3 text-gray-300 text-xs">
                        {v.disease}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}
