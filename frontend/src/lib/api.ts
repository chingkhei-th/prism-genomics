const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Generic fetch helper with JWT injection ────────────────────────────────
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("prism_jwt_token");
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser sets multipart boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

// ─── Auth API ───────────────────────────────────────────────────────────────

export interface SignupData {
  name: string;
  email: string;
  password: string;
  role: "patient" | "doctor";
}

interface AuthResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    name: string;
    role: "patient" | "doctor";
    wallet_address: string;
  };
}

export async function authSignup(data: SignupData): Promise<AuthResponse> {
  return apiFetch("/api/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function authLogin(
  email: string,
  password: string
): Promise<AuthResponse> {
  return apiFetch("/api/v1/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function authMe(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return apiFetch<AuthResponse["user"]>("/api/v1/auth/me", { headers });
}

// ─── Patient API ────────────────────────────────────────────────────────────

export async function patientRegister() {
  return apiFetch("/api/v1/patient/register", { method: "POST" });
}

/** Full server-side upload pipeline (encrypt + IPFS + on-chain done by backend). */
export async function patientUpload(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch<{ cid: string; tx_hash: string }>("/api/v1/patient/upload", {
    method: "POST",
    body: formData,
  });
}

/**
 * Lightweight: frontend already did client-side encrypt + IPFS upload.
 * Backend only signs the on-chain tx and saves to DB.
 */
export async function patientRegisterOnChain(
  cid: string,
  blake3Hash: string,
  keyHex: string
): Promise<{ status: string; tx_hash: string | null; cid: string }> {
  return apiFetch("/api/v1/patient/register-upload", {
    method: "POST",
    body: JSON.stringify({ cid, blake3_hash: blake3Hash, key_hex: keyHex }),
  });
}

export interface GenomicFileRecord {
  id: string;
  ipfsCid: string;
  blake3Hash: string;
  txHash: string | null;
  analysisJson: string | null;
  createdAt: string;
  ipfsUrl: string;
}

export async function patientGetFiles(): Promise<{ files: GenomicFileRecord[] }> {
  return apiFetch("/api/v1/patient/files", { method: "GET" });
}

export async function patientSaveAnalysis(cid: string, analysis: RiskReport): Promise<void> {
  await apiFetch(`/api/v1/patient/files/${cid}/analysis`, {
    method: "PATCH",
    body: JSON.stringify({ analysis }),
  });
}

export interface PermissionEntry {
  address: string;
  email: string;
  name: string;
  date: string;
  status: "pending" | "approved";
}

export async function patientPermissions() {
  return apiFetch<{
    pending: PermissionEntry[];
    approved: PermissionEntry[];
  }>("/api/v1/patient/permissions");
}

export async function patientApprove(doctorEmail: string) {
  return apiFetch("/api/v1/patient/approve", {
    method: "POST",
    body: JSON.stringify({ doctor_email: doctorEmail }),
  });
}

export async function patientRevoke(doctorEmail: string) {
  return apiFetch("/api/v1/patient/revoke", {
    method: "POST",
    body: JSON.stringify({ doctor_email: doctorEmail }),
  });
}

// ─── Doctor API ─────────────────────────────────────────────────────────────

export async function doctorRequest(patientEmail: string) {
  return apiFetch("/api/v1/doctor/request", {
    method: "POST",
    body: JSON.stringify({ patient_email: patientEmail }),
  });
}

export interface ApprovedPatient {
  address: string;
  email: string;
  name: string;
  approved_date: string;
  risk_category?: string;
  risk_score?: number;
}

export async function doctorPatients() {
  return apiFetch<{ patients: ApprovedPatient[] }>("/api/v1/doctor/patients");
}

export async function doctorViewData(patientAddress: string) {
  return apiFetch(`/api/v1/doctor/view/${patientAddress}`);
}

// ─── AI Analysis API (existing — unchanged) ─────────────────────────────────

export interface RiskReport {
  status: string;
  // Real backend shape (InferenceEngine.analyze_vcf)
  risk_assessment: {
    disease_probability?: number;
    risk_level?: "Low" | "Moderate" | "High";
    confidence_note?: string;
    // Legacy / mock fields kept optional
    prs_raw?: number;
    percentile?: number;
    z_score?: number;
    risk_category?: "Low" | "Moderate" | "High";
  };
  // Real backend shape
  variant_analysis?: {
    total_model_variants: number;
    matched_in_upload: number;
    coverage_percent: number;
    high_impact_variants: Array<{
      rsid: string;
      chromosome: string;
      position: number;
      genotype: string;
      clinical_significance: string;
      disease: string;
    }>;
    n_pathogenic_with_alt: number;
  };
  model_info?: {
    architecture: string;
    n_features: number;
    chromosomes: string[];
    n_training_samples: number | string;
  };
  // Legacy / mock fields kept optional
  ml_prediction?: {
    disease_risk_label: string;
    disease_probability: number;
  };
  snp_analysis?: {
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
  population_reference?: {
    reference_dataset: string;
    reference_samples: number;
    population_mean_prs: number;
    population_std_prs: number;
  };
  processing_time_seconds?: number;
}

export async function analyzeVCF(file: File): Promise<RiskReport> {
  const formData = new FormData();
  formData.append("file", file);

  // Calls the actual ML Inference Engine
  return apiFetch<RiskReport>("/api/v1/upload", {
    method: "POST",
    body: formData,
  });
}

export async function healthCheck() {
  return apiFetch("/api/v1/health");
}

export async function getModelInfo() {
  return apiFetch("/api/v1/model-info");
}
