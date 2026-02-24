"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Database,
  ShieldCheck,
  Clock,
  ExternalLink,
} from "lucide-react";
import { GenomicFileRecord, patientGetFiles } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function UploadHistoryPage() {
  const router = useRouter();
  const [files, setFiles] = useState<GenomicFileRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFiles() {
      try {
        const { files: history } = await patientGetFiles();
        setFiles(history);
      } catch (err: any) {
        toast.error("Failed to load upload history.");
      } finally {
        setLoading(false);
      }
    }
    loadFiles();
  }, []);

  const handleViewReport = (record: GenomicFileRecord) => {
    if (!record.analysisJson) {
      toast.error("No analysis report found for this file.");
      return;
    }
    // Set the old report into session storage and navigate to results page
    sessionStorage.setItem("prism_risk_report", record.analysisJson);
    router.push("/patient/results");
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <Link
        href="/patient"
        className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Link>

      <div className="mb-10 flex items-center gap-4">
        <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-500/20">
          <Database className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            Genomic Data Vault
          </h1>
          <p className="text-gray-400 mt-1">
            Your encrypted VCF uploads and historical risk analysis reports.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 animate-pulse">
          <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">
            Decrypting Vault Records...
          </p>
        </div>
      ) : files.length === 0 ? (
        <div className="max-w-xl mx-auto p-10 rounded-2xl border border-gray-800 bg-gray-900/40 text-center mt-12">
          <FileText className="w-16 h-16 text-gray-700 mx-auto mb-6" />
          <h3 className="text-2xl font-bold mb-2">No Genomic Data Found</h3>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            You haven't uploaded any VCF files yet. Upload your genomic data to
            receive an encrypted AI risk profile.
          </p>
          <Link
            href="/patient/upload"
            className="inline-block px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all"
          >
            Upload VCF File
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {files.map((file) => {
            const date = new Date(file.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            // Parse the stored analysis to grab the risk level
            let riskLevel = "Pending";
            let riskColor = "bg-gray-500 text-gray-300";

            if (file.analysisJson) {
              try {
                const analysis = JSON.parse(file.analysisJson);
                const level =
                  analysis.risk_assessment?.risk_level ??
                  analysis.risk_assessment?.risk_category ??
                  "Unknown";
                riskLevel = level + " Risk";

                if (level === "High")
                  riskColor =
                    "bg-red-500/20 text-red-400 border border-red-500/30";
                else if (level === "Moderate")
                  riskColor =
                    "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
                else if (level === "Low")
                  riskColor =
                    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
              } catch {
                riskLevel = "Data Error";
              }
            }

            return (
              <div
                key={file.id}
                className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col md:flex-row items-center gap-6 hover:border-gray-700 transition-colors"
              >
                {/* Status / Date */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${riskColor}`}
                    >
                      {riskLevel}
                    </span>
                    <span className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3 h-3 mr-1" />
                      {date}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-sm font-mono text-gray-400">
                    <p className="flex items-center gap-2">
                      <span className="text-gray-500">IPFS:</span>
                      <a
                        href={file.ipfsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                      >
                        {file.ipfsCid.slice(0, 16)}...{file.ipfsCid.slice(-8)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                    {file.txHash && (
                      <p className="flex items-center gap-2">
                        <span className="text-gray-500">Tx:</span>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${file.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                        >
                          {file.txHash.slice(0, 10)}...{file.txHash.slice(-8)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-3">
                  {file.analysisJson ? (
                    <button
                      onClick={() => handleViewReport(file)}
                      className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                    >
                      View Report
                    </button>
                  ) : (
                    <span className="px-6 py-2 rounded-xl bg-gray-800 text-gray-500 font-medium cursor-not-allowed">
                      Analysis Pending
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
