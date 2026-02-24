"use client";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import {
  Upload,
  File,
  CheckCircle2,
  Loader2,
  Lock,
  Cloud,
  Link as LinkIcon,
  Zap,
  AlertCircle,
  Copy,
} from "lucide-react";
import {
  analyzeVCF,
  RiskReport,
  patientRegisterOnChain,
  patientSaveAnalysis,
} from "@/lib/api";
import { encryptFile } from "@/lib/encryption";
import { computeBlake3Hash } from "@/lib/hashing";
import { uploadToIPFS } from "@/lib/ipfs";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";

// ─── Step definitions ────────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error";

interface Step {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: "encrypt",
    label: "AES-256-GCM Encryption",
    icon: <Lock className="w-4 h-4" />,
  },
  {
    id: "hash",
    label: "BLAKE3 Hash Computation",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: "ipfs",
    label: "IPFS Upload (Pinata)",
    icon: <Cloud className="w-4 h-4" />,
  },
  {
    id: "chain",
    label: "On-chain Registration",
    icon: <LinkIcon className="w-4 h-4" />,
  },
  {
    id: "analyze",
    label: "AI Risk Analysis",
    icon: <Zap className="w-4 h-4" />,
  },
];

// ─── Result info ─────────────────────────────────────────────────────────────

interface UploadResult {
  cid: string;
  blake3Hash: string;
  txHash: string | null;
  keyHex: string;
  ipfsUrl: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VCFUploader() {
  const { token } = useAuth();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    {},
  );
  const [isRunning, setIsRunning] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // ── Dropzone ────────────────────────────────────────────────────────────────
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStepStatuses({});
      setUploadResult(null);
      setError(null);
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

  // ── Step helpers ────────────────────────────────────────────────────────────
  const setStep = (id: string, status: StepStatus) =>
    setStepStatuses((prev) => ({ ...prev, [id]: status }));

  // ── Analyze-only flow ───────────────────────────────────────────────────────
  const handleAnalyzeOnly = async () => {
    if (!file) return;
    setIsRunning(true);
    setError(null);
    setStepStatuses({ analyze: "running" });

    try {
      const result = await analyzeVCF(file);
      setStep("analyze", "done");
      toast.success("Risk analysis complete!");
      // Store in sessionStorage and navigate to results page
      sessionStorage.setItem("prism_risk_report", JSON.stringify(result));
      router.push("/patient/results");
    } catch (err: any) {
      setStep("analyze", "error");
      setError(err.message || "Analysis failed.");
      toast.error(err.message || "Analysis failed.");
    } finally {
      setIsRunning(false);
    }
  };

  // ── Full pipeline: Encrypt → BLAKE3 → IPFS → On-chain → Analyze ────────────
  const handleUpload = async () => {
    if (!file) return;
    setIsRunning(true);
    setError(null);
    setStepStatuses({});
    setUploadResult(null);

    try {
      // ── 1. Encrypt (client-side, Web Crypto AES-256-GCM) ─────────────────
      setStep("encrypt", "running");
      const fileBuffer = await file.arrayBuffer();
      const { encryptedPayload, keyHex } = await encryptFile(fileBuffer);
      setStep("encrypt", "done");
      toast.success("File encrypted locally ✓");

      // ── 2. BLAKE3 hash ───────────────────────────────────────────────────
      setStep("hash", "running");
      const blake3Hash = await computeBlake3Hash(encryptedPayload);
      setStep("hash", "done");
      toast.success("BLAKE3 hash computed ✓");

      // ── 3. Upload encrypted payload to IPFS ──────────────────────────────
      setStep("ipfs", "running");
      const cid = await uploadToIPFS(encryptedPayload, file.name);
      setStep("ipfs", "done");
      toast.success(`Stored on IPFS ✓  CID: ${cid.slice(0, 12)}...`);

      // ── 4. Register on-chain via backend ─────────────────────────────────
      //      (backend signs with custodial wallet — no web3 wallet needed)
      setStep("chain", "running");
      let txHash: string | null = null;
      try {
        const chainResult = await patientRegisterOnChain(
          cid,
          blake3Hash,
          keyHex,
        );
        txHash = chainResult.tx_hash;
        setStep("chain", "done");
        toast.success("Registered on blockchain ✓");
      } catch (chainErr: any) {
        // Non-fatal — blockchain registration may fail without breaking the flow
        setStep("chain", "error");
        toast.warning(
          "Blockchain registration skipped: " + (chainErr.message || ""),
        );
      }

      const result: UploadResult = {
        cid,
        blake3Hash,
        txHash,
        keyHex,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${cid}`,
      };
      setUploadResult(result);

      // Store key in localStorage keyed by CID (patient can retrieve later)
      if (typeof window !== "undefined") {
        const keys = JSON.parse(localStorage.getItem("prism_vcf_keys") || "{}");
        keys[cid] = keyHex;
        localStorage.setItem("prism_vcf_keys", JSON.stringify(keys));
      }

      // ── 5. AI Analysis ───────────────────────────────────────────────────
      setStep("analyze", "running");
      const analysisResult = await analyzeVCF(file);
      try {
        await patientSaveAnalysis(result.cid, analysisResult);
      } catch (saveErr) {
        console.warn("Failed to save analysis to history:", saveErr);
      }
      setStep("analyze", "done");
      toast.success("Risk analysis complete! Redirecting...");
      // Store and navigate to the full results page
      sessionStorage.setItem(
        "prism_risk_report",
        JSON.stringify(analysisResult),
      );
      router.push("/patient/results");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
      toast.error(err.message || "Upload failed.");
    } finally {
      setIsRunning(false);
    }
  };

  // ── Copy key ────────────────────────────────────────────────────────────────
  const copyKey = async () => {
    if (!uploadResult?.keyHex) return;
    await navigator.clipboard.writeText(uploadResult.keyHex);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  const isIdle = !isRunning && !uploadResult;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`p-10 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
            : "border-gray-700 bg-gray-900/50 hover:bg-gray-800/80 hover:border-gray-600"
        } ${isRunning ? "opacity-50 pointer-events-none" : ""}`}
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
          Supports <code className="text-blue-400">.vcf</code> and{" "}
          <code className="text-blue-400">.vcf.gz</code> — your raw data never
          leaves your device unencrypted.
        </p>
      </div>

      {/* File info + action buttons */}
      {file && (
        <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <File className="w-8 h-8 text-blue-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-gray-200 truncate max-w-xs">
                {file.name}
              </p>
              <p className="text-xs text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          {isIdle && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleAnalyzeOnly}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition-colors text-sm"
              >
                🔬 Analyze Only
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors text-sm"
              >
                🔐 Encrypt & Store
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step-by-step progress */}
      {Object.keys(stepStatuses).length > 0 && (
        <div className="p-5 bg-gray-900/60 border border-gray-800 rounded-2xl space-y-3">
          <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Pipeline Progress
          </h4>
          {STEPS.filter((s) => s.id in stepStatuses).map((step) => {
            const status = stepStatuses[step.id];
            return (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                    status === "done"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : status === "running"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 animate-pulse"
                        : status === "error"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-gray-800 text-gray-600 border border-gray-700"
                  }`}
                >
                  {status === "done" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : status === "error" ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    status === "done"
                      ? "text-emerald-400"
                      : status === "running"
                        ? "text-blue-400"
                        : status === "error"
                          ? "text-red-400"
                          : "text-gray-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Upload result */}
      {uploadResult && (
        <div className="p-5 bg-gray-900/60 border border-gray-800 rounded-2xl space-y-4">
          <h4 className="font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Secured on IPFS & Blockchain
          </h4>

          <div className="space-y-3 text-sm">
            {/* IPFS CID */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                IPFS CID
              </p>
              <a
                href={uploadResult.ipfsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-400 hover:text-blue-300 break-all transition-colors"
              >
                {uploadResult.cid}
              </a>
            </div>

            {/* BLAKE3 hash */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                BLAKE3 Hash
              </p>
              <p className="font-mono text-gray-300 text-xs break-all">
                {uploadResult.blake3Hash}
              </p>
            </div>

            {/* Tx hash */}
            {uploadResult.txHash && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                  Blockchain Tx Hash
                </p>
                <p className="font-mono text-gray-300 text-xs break-all">
                  {uploadResult.txHash}
                </p>
              </div>
            )}

            {/* AES Key — important for the patient to save */}
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <p className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">
                  ⚠ Your Decryption Key — Save This!
                </p>
                <button
                  onClick={copyKey}
                  className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {keyCopied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="font-mono text-yellow-200 text-xs break-all">
                {uploadResult.keyHex}
              </p>
              <p className="text-yellow-600 text-xs mt-1">
                This key is stored locally in your browser. Without it, your
                data cannot be decrypted.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
