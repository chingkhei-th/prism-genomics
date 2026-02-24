"use client";
import Link from "next/link";
import { ArrowRight, Shield, Activity, Database } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(user.role === "doctor" ? "/doctor" : "/patient");
    }
  }, [isLoading, user, router]);

  if (isLoading || user) {
    return <div className="min-h-screen bg-black" />;
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-blue-500/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-black pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-8 mt-12">
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Decentralized Genomic Intelligence
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Own Your DNA. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
              Predict Your Future.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            PRISM Genomics combines blockchain security with AI-driven Polygenic
            Risk Scoring to give you full control over your genetic data and
            health insights.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)]"
            >
              Get Started <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 hover:border-gray-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Enterprise-Grade Infrastructure
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Built on Web3 primitives to guarantee privacy, security, and
              immutability for sensitive healthcare data.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">
                Military-Grade Encryption
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Your VCF data is encrypted using AES-256-GCM before it ever
                leaves your device. Only authorized parties can decrypt it.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-500/10 group">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-6 border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Risk Intelligence</h3>
              <p className="text-gray-400 leading-relaxed">
                Our advanced XGBoost model analyzes your SNPs against GWAS
                databases to calculate Polygenic Risk Scores (PRS) for various
                complex traits.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 group">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3">Decentralized Storage</h3>
              <p className="text-gray-400 leading-relaxed">
                Encrypted data is stored immutably on IPFS. Access permissions
                are managed natively by smart contracts on the Ethereum
                blockchain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 relative border-t border-gray-800/50">
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              No crypto wallets. No extensions. Just sign up and go.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20 text-xl font-bold">
                1
              </div>
              <h3 className="font-bold mb-2">Sign Up</h3>
              <p className="text-gray-400 text-sm">
                Create an account with email and password. A blockchain wallet
                is generated automatically for you.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-purple-500/20 text-xl font-bold">
                2
              </div>
              <h3 className="font-bold mb-2">Upload VCF</h3>
              <p className="text-gray-400 text-sm">
                Upload your genomic data. It&apos;s encrypted and stored on IPFS
                — no raw data ever hits our servers.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 text-xl font-bold">
                3
              </div>
              <h3 className="font-bold mb-2">Get Your Report</h3>
              <p className="text-gray-400 text-sm">
                AI analyzes your SNPs and returns Polygenic Risk Scores. Share
                reports with doctors on your terms.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
