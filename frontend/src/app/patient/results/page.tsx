"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, Loader2, BrainCircuit } from "lucide-react";
import { analyzeVCF, RiskReport } from "@/lib/api";
import {
  RiskCategory,
  RiskGauge,
  SNPTable,
  PopulationChart,
} from "@/components/patient/RiskVisualizations";
import { toast } from "sonner";

export default function ResultsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<RiskReport | null>(null);

  const handleProcess = async () => {
    if (!file) return;
    try {
      setAnalyzing(true);
      const data = await analyzeVCF(file);
      setReport(data);
      toast.success("AI Analysis complete!");
    } catch (err: any) {
      toast.error(err.message || "Failed to analyze VCF file.");
    } finally {
      setAnalyzing(false);
    }
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
        <div className="w-14 h-14 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center border border-purple-500/20">
          <BrainCircuit className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-tight">
            AI Risk Intelligence
          </h1>
          <p className="text-gray-400 mt-1">
            Upload your VCF to securely calculate Polygenic Risk Scores locally
            before data upload.
          </p>
        </div>
      </div>

      {!report ? (
        <div className="max-w-xl mx-auto p-8 rounded-2xl border border-gray-800 bg-gray-900/40 text-center mt-16">
          <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Analyze VCF File</h3>
          <p className="text-gray-400 text-sm mb-6">
            Select a VCF file to pass through our XGBoost models. Your raw data
            is not persisted.
          </p>

          <input
            type="file"
            accept=".vcf,.vcf.gz,text/vcard,application/gzip"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 mb-6 transition-all"
          />

          <button
            onClick={handleProcess}
            disabled={!file || analyzing}
            className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Analyzing
                Sequences...
              </>
            ) : (
              "Run AI Analysis"
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col justify-center">
              <h3 className="text-gray-400 font-medium mb-4 text-center text-sm uppercase tracking-wider">
                Overall Risk Category
              </h3>
              <RiskCategory
                category={
                  report.risk_assessment.risk_category as
                    | "Low"
                    | "Moderate"
                    | "High"
                }
              />
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-gray-400 font-medium mb-4 text-center text-sm uppercase tracking-wider">
                Population Percentile
              </h3>
              <RiskGauge value={report.risk_assessment.percentile} />
            </div>

            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-gray-400 font-medium mb-6 text-center text-sm uppercase tracking-wider">
                Model Prediction
              </h3>
              <div className="text-center">
                <div
                  className={`text-4xl font-extrabold mb-2 ${report.ml_prediction.disease_probability > 0.5 ? "text-red-400" : "text-emerald-400"}`}
                >
                  {(report.ml_prediction.disease_probability * 100).toFixed(1)}%
                </div>
                <div className="text-gray-300 font-medium mb-4">
                  {report.ml_prediction.disease_risk_label}
                </div>
                <div className="px-4 py-2 rounded-lg bg-gray-800 text-xs text-gray-400">
                  {report.snp_analysis.matched_in_upload} out of{" "}
                  {report.snp_analysis.total_gwas_snps} GWAS SNPs identified
                </div>
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-gray-900/40 border border-gray-800">
              <h3 className="text-xl font-bold mb-6">
                Population Distribution
              </h3>
              <PopulationChart
                userPercentile={report.risk_assessment.percentile}
              />
              <p className="text-center text-sm text-gray-500 mt-4">
                Reference: {report.population_reference.reference_dataset} (n=
                {report.population_reference.reference_samples})
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gray-900/40 border border-gray-800">
              <h3 className="text-xl font-bold mb-6">
                Top Genetic Contributors
              </h3>
              <SNPTable snps={report.snp_analysis.top_contributing_snps} />
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 max-w-2xl mx-auto pt-6">
            Disclaimer: PRISM Genomics predictions are made strictly for
            informational purposes based on machine learning probability models
            and do not constitute professional medical diagnoses.
          </p>
        </div>
      )}
    </div>
  );
}
