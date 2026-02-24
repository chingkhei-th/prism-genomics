"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Loader2,
  BrainCircuit,
  AlertTriangle,
} from "lucide-react";
import { analyzeVCF, RiskReport } from "@/lib/api";
import { toast } from "sonner";

// ─── Helper: derive display values from either backend shape ─────────────────

function getRiskLevel(report: RiskReport): string {
  return (
    report.risk_assessment?.risk_level ??
    report.risk_assessment?.risk_category ??
    "Unknown"
  );
}

function getDiseaseProb(report: RiskReport): number | null {
  return (
    report.risk_assessment?.disease_probability ??
    report.ml_prediction?.disease_probability ??
    null
  );
}

function getMatchedSnps(report: RiskReport): string {
  const matched =
    report.variant_analysis?.matched_in_upload ??
    report.snp_analysis?.matched_in_upload;
  const total =
    report.variant_analysis?.total_model_variants ??
    report.snp_analysis?.total_gwas_snps;
  if (matched == null || total == null) return "—";
  return `${matched} / ${total}`;
}

function getCoveragePercent(report: RiskReport): number | null {
  if (report.variant_analysis?.coverage_percent != null)
    return report.variant_analysis.coverage_percent;
  const matched =
    report.variant_analysis?.matched_in_upload ??
    report.snp_analysis?.matched_in_upload;
  const total =
    report.variant_analysis?.total_model_variants ??
    report.snp_analysis?.total_gwas_snps;
  if (matched != null && total != null && total > 0)
    return (matched / total) * 100;
  return null;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    High: "bg-red-500/20 text-red-400 border-red-500/30",
    Moderate: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  const cls =
    colors[level] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30";
  return (
    <div
      className={`inline-flex items-center px-4 py-2 rounded-full border text-lg font-bold ${cls}`}
    >
      {level} Risk
    </div>
  );
}

function ProbabilityBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value > 0.7
      ? "bg-red-500"
      : value > 0.4
        ? "bg-yellow-500"
        : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-gray-400">Disease Probability</span>
        <span
          className={`font-bold ${value > 0.7 ? "text-red-400" : value > 0.4 ? "text-yellow-400" : "text-emerald-400"}`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState<RiskReport | null>(null);

  // Load report passed from VCFUploader via sessionStorage
  useEffect(() => {
    const cached = sessionStorage.getItem("prism_risk_report");
    if (cached) {
      try {
        setReport(JSON.parse(cached));
        sessionStorage.removeItem("prism_risk_report");
      } catch {
        // ignore malformed data
      }
    }
  }, []);

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
            Upload your VCF to calculate Polygenic Risk Scores using our genomic
            ML model.
          </p>
        </div>
      </div>

      {!report ? (
        <div className="max-w-xl mx-auto p-8 rounded-2xl border border-gray-800 bg-gray-900/40 text-center mt-16">
          <Upload className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Analyze VCF File</h3>
          <p className="text-gray-400 text-sm mb-6">
            Select a VCF file to run through our GenomicMLP model. Raw data is
            not stored.
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
          {/* ── Top 3 stat cards ── */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Risk Level */}
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col items-center justify-center gap-4">
              <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">
                Overall Risk Level
              </h3>
              <RiskBadge level={getRiskLevel(report)} />
              {report.risk_assessment?.confidence_note && (
                <p className="text-xs text-gray-500 text-center">
                  {report.risk_assessment.confidence_note}
                </p>
              )}
            </div>

            {/* Disease Probability */}
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800">
              <h3 className="text-gray-400 font-medium mb-6 text-sm uppercase tracking-wider text-center">
                Disease Probability
              </h3>
              {getDiseaseProb(report) != null ? (
                <>
                  <div
                    className={`text-4xl font-extrabold mb-2 text-center ${
                      getDiseaseProb(report)! > 0.5
                        ? "text-red-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {(getDiseaseProb(report)! * 100).toFixed(1)}%
                  </div>
                  <ProbabilityBar value={getDiseaseProb(report)!} />
                </>
              ) : (
                <p className="text-gray-500 text-center">Not available</p>
              )}
            </div>

            {/* SNP Coverage */}
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col items-center justify-center gap-3">
              <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider">
                SNP Coverage
              </h3>
              <p className="text-3xl font-extrabold text-white">
                {getMatchedSnps(report)}
              </p>
              {getCoveragePercent(report) != null && (
                <div className="w-full">
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(getCoveragePercent(report)!, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center mt-1">
                    {getCoveragePercent(report)!.toFixed(1)}% of model variants
                    matched
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── High-impact variants table ── */}
          {(report.variant_analysis?.high_impact_variants?.length ?? 0) > 0 && (
            <div className="p-8 rounded-2xl bg-gray-900/40 border border-gray-800">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
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
                    {report
                      .variant_analysis!.high_impact_variants.slice(0, 10)
                      .map((v, i) => (
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

          {/* ── Top SNPs from legacy mock (if present) ── */}
          {report.snp_analysis?.top_contributing_snps?.length && (
            <div className="p-8 rounded-2xl bg-gray-900/40 border border-gray-800">
              <h3 className="text-xl font-bold mb-6">
                Top Genetic Contributors
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 uppercase text-xs border-b border-gray-800">
                      <th className="text-left pb-3 pr-4">rsID</th>
                      <th className="text-left pb-3 pr-4">Position</th>
                      <th className="text-left pb-3 pr-4">Beta</th>
                      <th className="text-left pb-3">Trait</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {report.snp_analysis.top_contributing_snps.map((s, i) => (
                      <tr
                        key={i}
                        className="hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-3 pr-4 font-mono text-blue-400">
                          {s.rsid}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-400">
                          {s.position.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-gray-300">
                          {s.beta.toFixed(3)}
                        </td>
                        <td className="py-3 text-gray-400 text-xs">
                          {s.trait}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Population reference (mock only) ── */}
          {report.population_reference && (
            <p className="text-center text-sm text-gray-500">
              Reference: {report.population_reference.reference_dataset} (n=
              {report.population_reference.reference_samples})
            </p>
          )}

          {/* ── Model info ── */}
          {report.model_info && (
            <div className="p-4 rounded-xl bg-gray-900/40 border border-gray-800 text-xs text-gray-500 flex flex-wrap gap-4 justify-center">
              <span>
                Architecture:{" "}
                <span className="text-gray-300">
                  {report.model_info.architecture}
                </span>
              </span>
              <span>
                Features:{" "}
                <span className="text-gray-300">
                  {report.model_info.n_features}
                </span>
              </span>
              <span>
                Training samples:{" "}
                <span className="text-gray-300">
                  {report.model_info.n_training_samples}
                </span>
              </span>
              {report.processing_time_seconds && (
                <span>
                  Processed in:{" "}
                  <span className="text-gray-300">
                    {report.processing_time_seconds}s
                  </span>
                </span>
              )}
            </div>
          )}

          <p className="text-center text-sm text-gray-500 max-w-2xl mx-auto pt-4">
            Disclaimer: PRISM Genomics predictions are for informational
            purposes based on ML probability models and do not constitute
            professional medical diagnoses.
          </p>
        </div>
      )}
    </div>
  );
}
