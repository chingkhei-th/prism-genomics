"use client";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AlertTriangle, Info, CheckCircle2 } from "lucide-react";

export function RiskGauge({ value }: { value: number }) {
  const data = [
    { name: "Risk", value: value },
    { name: "Remaining", value: 100 - value },
  ];
  const COLORS = ["#ef4444", "#1e293b"]; // Red for risk, gray for remaining

  return (
    <div className="h-48 w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="100%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <div className="text-3xl font-bold">{value.toFixed(1)}%</div>
        <div className="text-sm text-gray-400">Percentile</div>
      </div>
    </div>
  );
}

export function RiskCategory({
  category,
}: {
  category: "Low" | "Moderate" | "High";
}) {
  const colors = {
    Low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    Moderate: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    High: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  const icons = {
    Low: <CheckCircle2 className="w-6 h-6" />,
    Moderate: <Info className="w-6 h-6" />,
    High: <AlertTriangle className="w-6 h-6" />,
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 rounded-xl border ${colors[category]}`}
    >
      <div className="mb-2">{icons[category]}</div>
      <div className="text-2xl font-bold">{category} Risk</div>
    </div>
  );
}

export function SNPTable({ snps }: { snps: any[] }) {
  return (
    <div className="overflow-x-auto w-full rounded-xl border border-gray-800 bg-gray-900/50">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-gray-400 uppercase bg-gray-800/80">
          <tr>
            <th className="px-6 py-4">RSID</th>
            <th className="px-6 py-4">Position</th>
            <th className="px-6 py-4">Genotype</th>
            <th className="px-6 py-4">Trait</th>
            <th className="px-6 py-4">Effect Weight</th>
          </tr>
        </thead>
        <tbody>
          {snps.map((snp, i) => (
            <tr
              key={i}
              className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors"
            >
              <td className="px-6 py-4 font-mono text-blue-400">{snp.rsid}</td>
              <td className="px-6 py-4">{snp.position}</td>
              <td className="px-6 py-4">{snp.genotype}</td>
              <td className="px-6 py-4">{snp.trait}</td>
              <td className="px-6 py-4 text-emerald-400">
                +{snp.contribution.toFixed(4)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PopulationChart({
  userPercentile,
}: {
  userPercentile: number;
}) {
  // Mock bell curve distribution
  const data = Array.from({ length: 100 }, (_, i) => ({
    percentile: i,
    density: Math.exp(-Math.pow(i - 50, 2) / (2 * Math.pow(15, 2))),
    isUser: Math.abs(i - userPercentile) < 1 ? 1 : 0,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#1f2937"
            vertical={false}
          />
          <XAxis
            dataKey="percentile"
            stroke="#4b5563"
            tick={{ fill: "#9ca3af" }}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111827",
              borderColor: "#374151",
              borderRadius: "8px",
            }}
            itemStyle={{ color: "#60a5fa" }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Bar dataKey="density" fill="#3b82f6" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.isUser ? "#ef4444" : "#1e40af"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
