"use client";
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, File, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { encryptFile } from "@/lib/encryption";
import { computeBlake3Hash } from "@/lib/hashing";
import { uploadToIPFS } from "@/lib/ipfs";
import { useUploadData } from "@/hooks/useDataAccess";
import { toast } from "sonner";

export function VCFUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "encrypting" | "uploading" | "onchain" | "success" | "error"
  >("idle");
  const [keyHex, setKeyHex] = useState<string | null>(null);
  const { upload, isPending, isSuccess, txHash } = useUploadData();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setStatus("idle");
      setKeyHex(null);
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

  useEffect(() => {
    if (isSuccess && status === "onchain") {
      setStatus("success");
      toast.success("Genomic data secured on-chain!");
    }
  }, [isSuccess, status]);

  const handleProcess = async () => {
    if (!file) return;
    try {
      setStatus("encrypting");
      const buffer = await file.arrayBuffer();
      const encrypted = await encryptFile(buffer);
      setKeyHex(encrypted.keyHex);

      const hashHex = await computeBlake3Hash(encrypted.encryptedPayload);

      setStatus("uploading");
      const cid = await uploadToIPFS(encrypted.encryptedPayload, file.name);

      setStatus("onchain");
      upload(cid, hashHex);

      toast.success(
        "File encrypted & uploaded to IPFS. Please confirm the transaction in your wallet.",
      );
    } catch (err) {
      console.error(err);
      setStatus("error");
      toast.error("An error occurred during processing.");
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
            <button
              onClick={handleProcess}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Encrypt & Upload
            </button>
          ) : (
            <div className="flex items-center gap-2 text-blue-400">
              {status === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              <span className="text-sm font-medium capitalize">
                {status === "onchain" ? "Waiting for Transaction..." : status}
              </span>
            </div>
          )}
        </div>
      )}

      {keyHex && (
        <div className="p-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0 mt-1" />
            <div>
              <h4 className="font-bold text-yellow-500 mb-2">
                Save Your Decryption Key
              </h4>
              <p className="text-sm text-yellow-500/80 mb-4">
                This key is never stored on our servers. If you lose it, your
                genomic data cannot be decrypted by anyone, including you or
                your doctors.
              </p>
              <div className="flex gap-2 items-center">
                <code className="flex-1 p-3 bg-black/50 border border-yellow-500/20 rounded break-all text-xs font-mono text-gray-300">
                  {keyHex}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(keyHex);
                    toast.success("Key copied to clipboard!");
                  }}
                  className="px-4 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 border border-yellow-500/40 rounded text-sm font-medium transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
