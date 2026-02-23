import { VCFUploader } from "@/components/patient/VCFUploader";
import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";

export default function UploadPage() {
  return (
    <div className="container mx-auto px-6 py-12">
      <Link
        href="/patient"
        className="inline-flex items-center text-gray-400 hover:text-white mb-8 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
      </Link>

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Secure Data Upload
          </h1>
          <p className="text-gray-400 text-lg">
            Your VCF files are securely encrypted locally on your device. The
            raw genetic data never reaches our servers and only you control the
            decryption key.
          </p>
        </div>

        <VCFUploader />
      </div>
    </div>
  );
}
