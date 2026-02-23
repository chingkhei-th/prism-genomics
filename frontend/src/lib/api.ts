const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface RiskReport {
  status: string;
  risk_assessment: {
    prs_raw: number;
    percentile: number;
    z_score: number;
    risk_category: "Low" | "Moderate" | "High";
  };
  ml_prediction: {
    disease_risk_label: string;
    disease_probability: number;
  };
  snp_analysis: {
    total_gwas_snps: number;
    matched_in_upload: number;
    top_contributing_snps: Array<{
      rsid: string;
      position: number;
      genotype: number;
      beta: number;
      contribution: number;
      trait: string;
    }>;
  };
  population_reference: {
    reference_dataset: string;
    reference_samples: number;
    population_mean_prs: number;
    population_std_prs: number;
  };
  processing_time_seconds: number;
}

export async function analyzeVCF(file: File): Promise<RiskReport> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/v1/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
    throw new Error(err.detail || "Analysis failed");
  }
  return res.json();
}

export async function healthCheck() {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  return res.json();
}

export async function getModelInfo() {
  const res = await fetch(`${API_BASE}/api/v1/model-info`);
  return res.json();
}
