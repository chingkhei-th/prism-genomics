"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, CheckCircle2, Loader2 } from "lucide-react";
import { patientUpload, analyzeVCF, RiskReport } from "@/lib/api";
import { toast } from "sonner";

export function VCFUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "analyzing" | "success" | "error"
  >("idle");
  const [report, setReport] = useState<RiskReport | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      setReport(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/vcard": [".vcf"],
      "application/gzip": [".vcf.gz"],
    },
    maxFiles: 1,
  });

  const handleUpload = async () => {
    if (!file) return;
    try {
      setStatus("uploading");
      // Backend handles: encrypt → IPFS → on-chain
      await patientUpload(file);
      toast.success("Genomic data encrypted and secured on-chain!");

      setStatus("analyzing");
      const result = await analyzeVCF(file);
      setReport(result);

      setStatus("success");
      toast.success("Risk analysis complete!");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      toast.error(err.message || "An error occurred during processing.");
    }
  };

  const handleAnalyzeOnly = async () => {
    if (!file) return;
    try {
      setStatus("analyzing");
      const result = await analyzeVCF(file);
      setReport(result);
      setStatus("success");
      toast.success("Risk analysis complete!");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      toast.error(err.message || "Analysis failed.");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div
        {...getRootProps()}
        className={`p-10 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-500/10"
            : "border-gray-700 bg-gray-900/50 hover:bg-gray-800/80 hover:border-gray-600"
        } ${status !== "idle" && status !== "error" ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <Upload className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold mb-2">
          {isDragActive
            ? "Drop the VCF file here..."
            : "Select or Drop VCF File"}
        </h3>
        <p className="text-gray-400 text-sm">
          Supports .vcf and .vcf.gz formats directly from standard sequencing
          providers.
        </p>
      </div>

      {file && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <File className="w-8 h-8 text-blue-500" />
            <div>
              <p className="font-medium text-gray-200">{file.name}</p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          {status === "idle" || status === "error" ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnalyzeOnly}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors text-sm"
              >
                🔬 Analyze Risk
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
              >
                🔐 Encrypt & Store
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-blue-400">
              {status === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              <span className="text-sm font-medium capitalize">
                {status === "uploading"
                  ? "Encrypting & uploading..."
                  : status === "analyzing"
                    ? "Running AI analysis..."
                    : status}
              </span>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <h4 className="font-bold text-emerald-400 mb-3">Analysis Results</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Risk Category</p>
              <p className="text-lg font-bold text-white">
                {report.risk_assessment.risk_category}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Percentile</p>
              <p className="text-lg font-bold text-white">
                {report.risk_assessment.percentile.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400">ML Prediction</p>
              <p className="text-lg font-bold text-white">
                {report.ml_prediction.disease_risk_label} (
                {(report.ml_prediction.disease_probability * 100).toFixed(1)}%)
              </p>
            </div>
            <div>
              <p className="text-gray-400">SNPs Matched</p>
              <p className="text-lg font-bold text-white">
                {report.snp_analysis.matched_in_upload} /{" "}
                {report.snp_analysis.total_gwas_snps}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <a
              href="/patient/results"
              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
            >
              View Full Report →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
