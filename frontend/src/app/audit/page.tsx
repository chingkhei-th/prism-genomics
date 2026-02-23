"use client";
import { useState, useEffect } from "react";
import {
  ScrollText,
  ExternalLink,
  Activity,
  ArrowRightLeft,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";

interface AuditEvent {
  eventName: string;
  txHash: string;
  blockNumber: number;
  args: any;
}

export default function AuditTrailPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a production app, we would fetch from a backend audit API
    // or use an indexer like The Graph.
    // Mock data for now:
    const mockEvents: AuditEvent[] = [
      {
        eventName: "DataUploaded",
        txHash: "0x123abc...",
        blockNumber: 5231012,
        args: {
          patient: user?.email || "unknown",
          ipfsCid: "QmX...",
          blake3Hash: "abcd...",
        },
      },
      {
        eventName: "AccessRequested",
        txHash: "0x456def...",
        blockNumber: 5231150,
        args: {
          doctor: "dr.smith@hospital.com",
          patient: user?.email || "unknown",
        },
      },
      {
        eventName: "AccessApproved",
        txHash: "0x789ghi...",
        blockNumber: 5231200,
        args: {
          patient: user?.email || "unknown",
          doctor: "dr.smith@hospital.com",
        },
      },
    ];

    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1500);
  }, [user]);

  const getEventIcon = (name: string) => {
    switch (name) {
      case "DataUploaded":
        return <Activity className="w-5 h-5 text-blue-400" />;
      case "AccessRequested":
        return <ArrowRightLeft className="w-5 h-5 text-yellow-400" />;
      case "AccessApproved":
        return <ScrollText className="w-5 h-5 text-emerald-400" />;
      case "AccessRevoked":
        return <ScrollText className="w-5 h-5 text-red-400" />;
      default:
        return <Activity className="w-5 h-5 text-gray-400" />;
    }
  };

  const getEventColor = (name: string) => {
    switch (name) {
      case "DataUploaded":
        return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "AccessRequested":
        return "text-yellow-400 bg-yellow-500/10 border-yellow-500/20";
      case "AccessApproved":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
      case "AccessRevoked":
        return "text-red-400 bg-red-500/10 border-red-500/20";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/20";
    }
  };

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-gray-900 border border-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
            <ScrollText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Immutable Audit Trail
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Every data upload, access request, approval, and revocation is
            permanently recorded on the Ethereum blockchain.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
            <h2 className="font-semibold text-gray-200">
              Contract Events History
            </h2>
            <span className="text-xs font-mono text-gray-500 bg-black px-3 py-1 rounded">
              Blockchain Verified
            </span>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-gray-800 rounded-xl w-full"
                  ></div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No on-chain events found for your account.
              </div>
            ) : (
              <div className="space-y-4 relative">
                <div className="absolute left-6 top-6 bottom-6 w-px bg-gray-800 z-0"></div>

                {events.map((ev, i) => (
                  <div key={i} className="relative z-10 flex gap-6">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-950 border-2 border-gray-800 flex items-center justify-center -ml-1">
                      {getEventIcon(ev.eventName)}
                    </div>

                    <div className="flex-1 bg-black/50 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <div
                          className={`px-3 py-1 rounded-full text-xs font-bold border ${getEventColor(ev.eventName)}`}
                        >
                          {ev.eventName}
                        </div>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${ev.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-xs text-gray-500 hover:text-blue-400 transition-colors"
                        >
                          View TX <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </div>

                      <div className="p-3 bg-gray-900 rounded-lg text-sm font-mono text-gray-400 break-all border border-gray-800/50">
                        {JSON.stringify(ev.args, null, 2)}
                      </div>

                      <div className="mt-3 text-xs text-gray-600 font-mono">
                        Block: {ev.blockNumber} &bull; TX: {ev.txHash}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
