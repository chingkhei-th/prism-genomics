"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Loader2,
  BrainCircuit,
  AlertTriangle,
  Info,
  Download,
} from "lucide-react";
import { analyzeVCF, RiskReport } from "@/lib/api";
import { toast } from "sonner";
import {
  RiskCategory,
  RiskGauge,
  CoverageChart,
} from "@/components/patient/RiskVisualizations";

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

// ─── Sub-components are now imported from RiskVisualizations.tsx ────────────

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

  const handleDownloadPdf = async () => {
    if (!report) return;

    const data = {
      date: new Date().toLocaleDateString(),
      riskLevel: getRiskLevel(report),
      confidenceNote: report.risk_assessment?.confidence_note,
      probability:
        getDiseaseProb(report) != null
          ? (getDiseaseProb(report)! * 100).toFixed(1)
          : "-",
      coveragePercent:
        getCoveragePercent(report) != null
          ? getCoveragePercent(report)!.toFixed(1)
          : "-",
      matchedSnps:
        report.variant_analysis?.matched_in_upload ??
        report.snp_analysis?.matched_in_upload ??
        "-",
      totalSnps:
        report.variant_analysis?.total_model_variants ??
        report.snp_analysis?.total_gwas_snps ??
        "-",
      hasVariants:
        (report.variant_analysis?.high_impact_variants?.length ?? 0) > 0,
      variants: report.variant_analysis?.high_impact_variants?.slice(0, 10),
      architecture: report.model_info?.architecture,
      nFeatures: report.model_info?.n_features,
      nTrainingSamples: report.model_info?.n_training_samples,
    };

    const toastId = toast.loading("Generating PDF Report...");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to generate PDF");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "PRISM_Risk_Report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("PDF generated successfully!", { id: toastId });
    } catch (e) {
      toast.error("Error generating PDF", { id: toastId });
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

      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-brand/10 text-brand rounded-2xl flex items-center justify-center border border-brand/20 shrink-0">
            <BrainCircuit className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">
              AI Risk Intelligence
            </h1>
            <p className="text-gray-400 mt-1">
              Upload your VCF to calculate Polygenic Risk Scores using our
              genomic ML model.
            </p>
          </div>
        </div>

        {report && (
          <button
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700 shrink-0"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        )}
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
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-3 file:px-6 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand file:text-black hover:file:bg-brand/80 mb-6 transition-all"
          />

          <button
            onClick={handleProcess}
            disabled={!file || analyzing}
            className="w-full py-4 rounded-xl bg-brand hover:bg-brand/80 text-black font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <RiskCategory category={getRiskLevel(report) as any} />
              {report.risk_assessment?.confidence_note && (
                <p className="text-xs text-gray-500 text-center">
                  {report.risk_assessment.confidence_note}
                </p>
              )}
            </div>

            {/* Disease Probability */}
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col items-center justify-center pt-8">
              <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider text-center w-full mb-2">
                Disease Probability
              </h3>
              {getDiseaseProb(report) != null ? (
                <RiskGauge
                  value={getDiseaseProb(report)! * 100}
                  label="Probability"
                />
              ) : (
                <p className="text-gray-500 text-center w-full">
                  Not available
                </p>
              )}
            </div>

            {/* SNP Coverage */}
            <div className="p-6 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col items-center justify-center pt-8">
              <h3 className="text-gray-400 font-medium text-sm uppercase tracking-wider w-full text-center mb-2">
                SNP Coverage
              </h3>
              {getCoveragePercent(report) != null ? (
                <>
                  <CoverageChart value={getCoveragePercent(report)!} />
                  <p className="text-xs text-gray-500 text-center mt-4">
                    {getMatchedSnps(report)} variants matched
                  </p>
                </>
              ) : (
                <p className="text-gray-500 text-center w-full">
                  Not available
                </p>
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
                          <td className="py-3 pr-4 font-mono text-brand">
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

          {/* ── Legend & Terminology ── */}
          <div className="p-6 rounded-2xl bg-gray-900/40 border border-gray-800 text-sm mt-8 mb-4">
            <h4 className="text-white font-medium mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-brand" />
              Terminology Guide
            </h4>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 text-gray-400">
              <div>
                <strong className="text-gray-200 block mb-1">rsID</strong>{" "}
                Reference SNP cluster ID; a unique label for a specific
                variation in DNA.
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Chr</strong>{" "}
                Chromosome number where the variant is located.
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Position</strong>{" "}
                The exact location (base pair coordinate) on the chromosome.
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Genotype</strong>{" "}
                Your specific allele combination (e.g., 0/1 means heterozygous,
                1/1 means homozygous for the variant).
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">Disease</strong>{" "}
                The clinical condition or trait associated with this specific
                variant.
              </div>
              <div>
                <strong className="text-gray-200 block mb-1">
                  SNP Coverage
                </strong>{" "}
                The total number of variants from your uploaded VCF data that
                successfully matched the AI model's training features.
              </div>
            </div>
          </div>

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
