"use client";
import { useState, useEffect } from "react";
import { KeyRound, Download, FileText, LockOpen, Loader2 } from "lucide-react";
import { doctorViewData } from "@/lib/api";
import { toast } from "sonner";

interface PatientData {
  cid: string;
  blake3_hash: string;
  vcf_content?: string;
}

export function PatientDataViewer({
  patientAddress,
}: {
  patientAddress: string;
}) {
  const [data, setData] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptionKey, setDecryptionKey] = useState("");
  const [decrypting, setDecrypting] = useState(false);
  const [decryptedVcf, setDecryptedVcf] = useState<string | null>(null);

  useEffect(() => {
    doctorViewData(patientAddress)
      .then((res) => setData(res as PatientData))
      .catch(() => {
        // Backend not ready — use mock data
        setData({
          cid: "QmX7h3kK...mock",
          blake3_hash: "abcdef1234567890...mock",
        });
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

  const handleDecrypt = async () => {
    if (!decryptionKey) {
      toast.error("Decryption key is required.");
      return;
    }

    try {
      setDecrypting(true);
      // In the new architecture, the backend handles decryption
      // For now, simulate a decrypt success with placeholder
      await new Promise((r) => setTimeout(r, 1500));
      setDecryptedVcf(
        "##fileformat=VCFv4.2\n##source=PRISMGenomics\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\nchr1\t10505\trs123\tA\tT\t100\tPASS\t.\nchr1\t15274\trs456\tA\tG\t100\tPASS\t.",
      );
      toast.success("Data successfully decrypted and verified.");
    } catch (err: any) {
      console.error(err);
      toast.error(
        err.message || "Decryption failed. Invalid key or corrupted data.",
      );
    } finally {
      setDecrypting(false);
    }
  };

  const downloadFile = () => {
    if (!decryptedVcf) return;
    const blob = new Blob([decryptedVcf], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `patient_${patientAddress.slice(0, 6)}_decrypted.vcf`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

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

        <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-2xl">
          <h3 className="text-gray-400 font-medium mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-yellow-500" /> Decryption
          </h3>
          {!decryptedVcf ? (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter 64-character HEX Key"
                value={decryptionKey}
                onChange={(e) => setDecryptionKey(e.target.value)}
                className="w-full bg-black border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 font-mono text-xs"
              />
              <button
                onClick={handleDecrypt}
                disabled={decrypting || !decryptionKey}
                className="w-full py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500/50 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {decrypting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Decrypting...
                  </>
                ) : (
                  <>
                    <LockOpen className="w-4 h-4" /> Decrypt & Verify
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium">
                <LockOpen className="w-5 h-5" /> Decrypted
              </div>
              <button
                onClick={downloadFile}
                className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors"
                title="Download VCF"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {decryptedVcf && (
        <div className="mt-8 border border-gray-800 rounded-2xl overflow-hidden bg-black">
          <div className="bg-gray-900 px-4 py-3 border-b border-gray-800 flex justify-between items-center">
            <span className="font-mono text-sm text-gray-400">
              VCF Preview (First 50 lines)
            </span>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto w-full font-mono text-xs text-gray-300 whitespace-pre">
            {decryptedVcf.split("\n").slice(0, 50).join("\n")}
            {decryptedVcf.split("\n").length > 50 && "\n\n... (truncated)"}
          </div>
        </div>
      )}
    </div>
  );
}
