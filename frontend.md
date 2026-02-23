# 🖥️ PRISM Genomics — Frontend Guide

> Detailed walkthrough for building the Next.js frontend — what exists, what's missing, every page, every component, every hook.

---

## 📊 Project Status Overview

### What We HAVE ✅

| Module | Component | Status |
|---|---|---|
| Blockchain | `PatientRegistry.sol` — register, isPatient | ✅ Complete |
| Blockchain | `DataAccess.sol` — upload, request, approve, revoke, get data | ✅ Complete |
| Blockchain | 8 Mocha + Chai tests passing | ✅ Complete |
| Blockchain | Ignition deployment module | ✅ Complete |
| Blockchain | Hardhat v3 config (Sepolia + local) | ✅ Complete |
| Backend | FastAPI server (`POST /analyze`, `GET /health`, `GET /model-info`) | ✅ Complete |
| Backend | VCF processor — parses `.vcf` / `.vcf.gz`, extracts SNPs | ✅ Complete |
| Backend | GWAS data fetcher — fetches from GWAS Catalog | ✅ Complete |
| Backend | PRS engine — calculator + normalizer | ✅ Complete |
| Backend | XGBoost trainer + label simulator | ✅ Complete |
| Backend | Inference engine — VCF → PRS → ML → risk report | ✅ Complete |
| Encryption | AES-256-GCM encrypt/decrypt (`aes256.py`) | ✅ Complete |
| Encryption | BLAKE3 tamper-proof hashing | ✅ Complete |

### What We DON'T HAVE ❌

| Module | Component | Status |
|---|---|---|
| Frontend | **Entire Next.js app** | ❌ Not started |
| IPFS | Upload script (`ipfs/readme.py` is empty) | ❌ Empty |
| IPFS | Download / CID retrieval | ❌ Not done |
| Blockchain | Sepolia testnet deployment | ⏳ Pending |
| Blockchain | DoctorRegistry contract (role verification) | ❌ Not done |
| Blockchain | On-chain encryption key sharing | ❌ Not done |
| Backend | Backend ↔ blockchain integration | ❌ Not done |
| Backend | Encryption key management API | ❌ Not done |
| Encryption | Integration with backend API | ❌ Not done |

### Critical Path to Working Demo

```
Step 1: Deploy contracts to Sepolia
Step 2: Build IPFS upload script
Step 3: Build frontend ← THIS GUIDE
Step 4: Connect all pieces end-to-end
```

---

## 🏗️ Frontend Architecture

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR, file-based routing, React Server Components |
| Language | TypeScript | Type safety for contract interactions |
| Styling | Tailwind CSS | Rapid UI development |
| Wallet | wagmi + viem + ConnectKit | Industry-standard wallet connection |
| State | TanStack React Query | Caching, loading states for API calls |
| Charts | Recharts | Risk visualization (gauges, bell curves) |
| Toasts | Sonner | Transaction notifications |
| Icons | Lucide React | Consistent icon set |

### File Structure

```
frontend/
├── src/
│   ├── app/                              # Next.js App Router pages
│   │   ├── layout.tsx                    # Root layout — wallet provider, navbar
│   │   ├── page.tsx                      # Landing page
│   │   │
│   │   ├── patient/
│   │   │   ├── page.tsx                  # Patient dashboard — overview
│   │   │   ├── upload/page.tsx           # Upload VCF → encrypt → IPFS → chain
│   │   │   ├── results/page.tsx          # AI risk prediction results
│   │   │   └── permissions/page.tsx      # Manage doctor access
│   │   │
│   │   ├── doctor/
│   │   │   ├── page.tsx                  # Doctor dashboard
│   │   │   ├── request/page.tsx          # Request access to patient data
│   │   │   └── view/[address]/page.tsx   # View approved patient data
│   │   │
│   │   └── audit/page.tsx                # On-chain audit trail viewer
│   │
│   ├── components/                       # Reusable UI components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx                # Top nav with wallet button
│   │   │   └── Footer.tsx                # Site footer
│   │   │
│   │   ├── wallet/
│   │   │   └── ConnectButton.tsx         # MetaMask connect button
│   │   │
│   │   ├── patient/
│   │   │   ├── VCFUploader.tsx           # Drag-drop file upload
│   │   │   ├── EncryptionStatus.tsx      # Shows encrypt + hash progress
│   │   │   ├── RiskGauge.tsx             # Circular risk gauge
│   │   │   ├── RiskCategory.tsx          # Low/Moderate/High badge
│   │   │   ├── SNPTable.tsx              # Top contributing SNPs table
│   │   │   ├── PopulationChart.tsx       # Bell curve with patient marker
│   │   │   ├── PendingRequests.tsx       # Incoming doctor requests
│   │   │   └── AccessList.tsx            # Approved doctors + revoke buttons
│   │   │
│   │   ├── doctor/
│   │   │   ├── RequestAccessForm.tsx     # Enter patient address + request
│   │   │   ├── ApprovedPatients.tsx      # List of accessible patients
│   │   │   └── PatientDataViewer.tsx     # View decrypted genomic data
│   │   │
│   │   └── shared/
│   │       ├── TransactionStatus.tsx     # Tx pending/confirmed/failed
│   │       └── LoadingSpinner.tsx        # Loading indicator
│   │
│   ├── hooks/                            # Custom React hooks
│   │   ├── usePatientRegistry.ts         # register(), isPatient()
│   │   ├── useDataAccess.ts              # uploadData, requestAccess, approve, revoke
│   │   └── useAnalyzeVCF.ts              # FastAPI /analyze call
│   │
│   ├── lib/                              # Utility functions
│   │   ├── contracts.ts                  # Contract addresses + ABIs
│   │   ├── api.ts                        # Backend API helper functions
│   │   ├── encryption.ts                 # Browser AES-256 + BLAKE3
│   │   ├── ipfs.ts                       # Pinata upload/download
│   │   └── abi/                          # Contract ABI JSON files
│   │       ├── PatientRegistry.json
│   │       └── DataAccess.json
│   │
│   └── providers/
│       └── Web3Provider.tsx              # wagmi + ConnectKit wrapper
│
├── public/                               # Static assets
├── .env.local                            # Environment variables
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 🔄 User Flows — Detailed

### Flow 1: Patient Registers + Uploads Genomic Data

```
┌─────────────────────────────────────────────────────────────┐
│  1. Patient opens app → clicks "Connect Wallet" (MetaMask)  │
│  2. App checks: isPatient(wallet) on PatientRegistry        │
│     ├── Not registered → show "Register" button             │
│     │   └── Calls PatientRegistry.register()                │
│     └── Already registered → show dashboard                 │
│  3. Patient clicks "Upload VCF"                             │
│  4. Selects .vcf file via drag-drop or file picker          │
│  5. Browser encrypts file (AES-256-GCM)                     │
│     ├── Generates random 256-bit key                        │
│     ├── Encrypts file → encrypted_data                      │
│     └── BLAKE3 hash of encrypted_data → integrity hash      │
│  6. Encrypted file uploaded to IPFS (Pinata) → returns CID  │
│  7. Calls DataAccess.uploadData(CID, blake3Hash) on-chain   │
│  8. Patient sees confirmation with:                         │
│     ├── Transaction hash (link to Etherscan)                │
│     ├── IPFS CID                                            │
│     └── BLAKE3 hash                                         │
│  9. Encryption key stored securely (local or backend)       │
└─────────────────────────────────────────────────────────────┘
```

**Components involved:**
- `ConnectButton.tsx` → `VCFUploader.tsx` → `EncryptionStatus.tsx` → `TransactionStatus.tsx`

**Hooks involved:**
- `useIsPatient()` → `useRegisterPatient()` → `useUploadData()`

### Flow 2: AI Risk Analysis

```
┌─────────────────────────────────────────────────────────────┐
│  1. Patient uploads .vcf file on results page               │
│  2. File sent to FastAPI: POST /api/v1/analyze              │
│  3. Backend processes:                                      │
│     ├── Parse VCF → extract SNPs                            │
│     ├── Compute Polygenic Risk Score (PRS)                  │
│     ├── Normalize against population                        │
│     └── XGBoost ML prediction                               │
│  4. Returns JSON risk report                                │
│  5. Frontend displays:                                      │
│     ├── Risk Gauge (circular) — percentile position         │
│     ├── Risk Category badge — Low / Moderate / High         │
│     ├── ML prediction — "Normal" or "At Risk" + probability │
│     ├── Top 10 Contributing SNPs — bar chart                │
│     ├── Population Bell Curve — patient marker on curve     │
│     └── Disclaimer — "Not a medical diagnosis"              │
└─────────────────────────────────────────────────────────────┘
```

**API Response (from `/api/v1/analyze`):**

```json
{
  "status": "success",
  "risk_assessment": {
    "prs_raw": 0.1234,
    "percentile": 72.5,
    "z_score": 0.5987,
    "risk_category": "Moderate"
  },
  "ml_prediction": {
    "disease_risk_label": "At Risk",
    "disease_probability": 0.6842
  },
  "snp_analysis": {
    "total_gwas_snps": 50,
    "matched_in_upload": 42,
    "top_contributing_snps": [
      {
        "rsid": "rs123",
        "position": 1234567,
        "genotype": 1,
        "beta": 0.15,
        "contribution": 0.15,
        "trait": "Type 2 Diabetes"
      }
    ]
  },
  "population_reference": {
    "reference_dataset": "1000 Genomes Phase 3 (chr1)",
    "reference_samples": 2504,
    "population_mean_prs": 0.0821,
    "population_std_prs": 0.0432
  }
}
```

**Components involved:**
- `VCFUploader.tsx` → `RiskGauge.tsx` + `RiskCategory.tsx` + `SNPTable.tsx` + `PopulationChart.tsx`

### Flow 3: Doctor Requests Access → Patient Approves

```
┌─────────────────────────────────────────────────────────────┐
│  DOCTOR SIDE:                                               │
│  1. Doctor connects wallet                                  │
│  2. Enters patient wallet address                           │
│  3. Calls DataAccess.requestAccess(patientAddress)          │
│  4. Sees "Request Pending" status                           │
│                                                             │
│  PATIENT SIDE:                                              │
│  5. Patient sees new request on permissions page             │
│     Shows: doctor address + timestamp                       │
│  6. Patient clicks "Approve" or "Reject"                    │
│     ├── Approve → DataAccess.approveAccess(doctorAddress)   │
│     └── Reject → (no on-chain action, just ignored)         │
│                                                             │
│  DOCTOR SIDE (after approval):                              │
│  7. Doctor's status changes to "Approved"                   │
│  8. Doctor calls DataAccess.getGenomicData(patientAddress)  │
│     Returns: (IPFS CID, BLAKE3 hash)                       │
│  9. Doctor downloads encrypted file from IPFS               │
│  10. Doctor receives decryption key (via backend/patient)   │
│  11. Doctor decrypts and views genomic data                 │
│                                                             │
│  PATIENT REVOKE:                                            │
│  12. Patient can call revokeAccess(doctorAddress) anytime   │
└─────────────────────────────────────────────────────────────┘
```

**Components involved:**
- Doctor: `RequestAccessForm.tsx` → `ApprovedPatients.tsx` → `PatientDataViewer.tsx`
- Patient: `PendingRequests.tsx` → `AccessList.tsx`

---

## 🔧 Implementation Code — Copy-Paste Ready

### 1. Initialize Project

```bash
cd prism-genomics
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --use-npm
cd frontend
```

### 2. Install Dependencies

```bash
npm install wagmi viem @tanstack/react-query connectkit
npm install recharts sonner lucide-react
npm install blake3 axios
```

### 3. Wallet Provider (`src/providers/Web3Provider.tsx`)

```tsx
"use client";
import { WagmiProvider, createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: { [sepolia.id]: http() },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "",
    appName: "PRISM Genomics",
  })
);

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider theme="midnight">{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 4. Root Layout (`src/app/layout.tsx`)

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Web3Provider } from "@/providers/Web3Provider";
import { Navbar } from "@/components/layout/Navbar";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PRISM Genomics",
  description: "Decentralized AI-Powered Genomic Data Ownership & Risk Intelligence",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Web3Provider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Toaster richColors position="bottom-right" />
        </Web3Provider>
      </body>
    </html>
  );
}
```

### 5. Contract Config (`src/lib/contracts.ts`)

```typescript
import PatientRegistryABI from "./abi/PatientRegistry.json";
import DataAccessABI from "./abi/DataAccess.json";

export const PATIENT_REGISTRY = {
  address: process.env.NEXT_PUBLIC_PATIENT_REGISTRY_ADDRESS as `0x${string}`,
  abi: PatientRegistryABI.abi,
} as const;

export const DATA_ACCESS = {
  address: process.env.NEXT_PUBLIC_DATA_ACCESS_ADDRESS as `0x${string}`,
  abi: DataAccessABI.abi,
} as const;
```

**Copy ABIs after compiling contracts:**

```bash
mkdir -p frontend/src/lib/abi
cp blockchain/artifacts/contracts/PatientRegistry.sol/PatientRegistry.json frontend/src/lib/abi/
cp blockchain/artifacts/contracts/DataAccess.sol/DataAccess.json frontend/src/lib/abi/
```

### 6. Wagmi Hooks (`src/hooks/usePatientRegistry.ts`)

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { PATIENT_REGISTRY } from "@/lib/contracts";

export function useRegisterPatient() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    register: () => writeContract({ ...PATIENT_REGISTRY, functionName: "register" }),
    isPending,
    isSuccess,
    txHash: hash,
  };
}

export function useIsPatient(address?: `0x${string}`) {
  return useReadContract({
    ...PATIENT_REGISTRY,
    functionName: "isPatient",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}
```

### 7. Wagmi Hooks (`src/hooks/useDataAccess.ts`)

```typescript
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { DATA_ACCESS } from "@/lib/contracts";

export function useUploadData() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    upload: (cid: string, blake3Hash: string) =>
      writeContract({
        ...DATA_ACCESS,
        functionName: "uploadData",
        args: [cid, blake3Hash],
      }),
    isPending,
    isSuccess,
    txHash: hash,
  };
}

export function useRequestAccess() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    request: (patient: `0x${string}`) =>
      writeContract({
        ...DATA_ACCESS,
        functionName: "requestAccess",
        args: [patient],
      }),
    isPending,
    isSuccess,
  };
}

export function useApproveAccess() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    approve: (doctor: `0x${string}`) =>
      writeContract({
        ...DATA_ACCESS,
        functionName: "approveAccess",
        args: [doctor],
      }),
    isPending,
    isSuccess,
  };
}

export function useRevokeAccess() {
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({ hash });

  return {
    revoke: (doctor: `0x${string}`) =>
      writeContract({
        ...DATA_ACCESS,
        functionName: "revokeAccess",
        args: [doctor],
      }),
    isPending,
    isSuccess,
  };
}

export function useCheckAccess(patient?: `0x${string}`, doctor?: `0x${string}`) {
  return useReadContract({
    ...DATA_ACCESS,
    functionName: "checkAccess",
    args: patient && doctor ? [patient, doctor] : undefined,
    query: { enabled: !!patient && !!doctor },
  });
}

export function useGetGenomicData(patient?: `0x${string}`) {
  return useReadContract({
    ...DATA_ACCESS,
    functionName: "getGenomicData",
    args: patient ? [patient] : undefined,
    query: { enabled: !!patient },
  });
}
```

### 8. API Helper (`src/lib/api.ts`)

```typescript
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
```

### 9. Browser Encryption (`src/lib/encryption.ts`)

```typescript
export async function encryptFile(fileBuffer: ArrayBuffer) {
  // Generate AES-256 key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Generate 12-byte nonce
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // Final payload: nonce + ciphertext (same format as Python aes256.py)
  const payload = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);

  // Export key for sharing
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return {
    encryptedPayload: payload,
    keyHex: Array.from(new Uint8Array(rawKey))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
  };
}

export async function decryptFile(
  encryptedPayload: Uint8Array,
  keyHex: string
): Promise<ArrayBuffer> {
  const keyBytes = new Uint8Array(
    keyHex.match(/.{2}/g)!.map((h) => parseInt(h, 16))
  );

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const iv = encryptedPayload.slice(0, 12);
  const ciphertext = encryptedPayload.slice(12);

  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
```

### 10. BLAKE3 Hashing (`src/lib/hashing.ts`)

```typescript
import { hash } from "blake3";

export function computeBlake3Hash(data: Uint8Array): string {
  return hash(data).toString("hex");
}
```

### 11. IPFS Upload (`src/lib/ipfs.ts`)

```typescript
import axios from "axios";

const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function uploadToIPFS(
  encryptedData: Uint8Array,
  filename: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([encryptedData], { type: "application/octet-stream" });
  formData.append("file", blob, `${filename}.enc`);

  formData.append(
    "pinataMetadata",
    JSON.stringify({ name: `prism-genomics-${filename}` })
  );

  const res = await axios.post(PINATA_API_URL, formData, {
    headers: {
      pinata_api_key: process.env.NEXT_PUBLIC_PINATA_API_KEY!,
      pinata_secret_api_key: process.env.NEXT_PUBLIC_PINATA_SECRET!,
    },
  });

  return res.data.IpfsHash; // This is the CID
}

export function getIPFSUrl(cid: string): string {
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/";
  return `${gateway}${cid}`;
}
```

---

## 🔑 Environment Variables (`frontend/.env.local`)

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# Smart contract addresses (fill in after deployment)
NEXT_PUBLIC_PATIENT_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_DATA_ACCESS_ADDRESS=0x...

# Ethereum chain
NEXT_PUBLIC_CHAIN_ID=11155111

# WalletConnect project ID (from cloud.walletconnect.com)
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id

# IPFS / Pinata (from app.pinata.cloud)
NEXT_PUBLIC_PINATA_API_KEY=your_pinata_api_key
NEXT_PUBLIC_PINATA_SECRET=your_pinata_secret
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
```

---

## 🏃 How to Run

```bash
# Terminal 1 — Backend
cd backend
uv run uvicorn src.api.server:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

---

## 📋 Build Order (Priority)

| Step | What | Est. Time | Depends On |
|---|---|---|---|
| 1 | Project init + wallet provider + layout | 1-2 hrs | Nothing |
| 2 | Landing page (hero + features + CTA) | 2-3 hrs | Step 1 |
| 3 | Patient registration flow | 1-2 hrs | Step 1 + deployed contracts |
| 4 | VCF upload → AI analysis → results page | 3-4 hrs | Step 1 + running backend |
| 5 | Client-side encryption + IPFS upload + on-chain | 4-5 hrs | Step 3 + Pinata account |
| 6 | Doctor request + patient approve/revoke | 3-4 hrs | Step 3 |
| 7 | Audit trail page | 2-3 hrs | Step 3 |
| 8 | Polish — animations, responsive, error states | 2-3 hrs | All above |

---

## 📝 Smart Contract Quick Reference

| Action | Contract | Function | Caller |
|---|---|---|---|
| Register as patient | PatientRegistry | `register()` | Patient |
| Check if registered | PatientRegistry | `isPatient(address)` | Anyone |
| Upload data hashes | DataAccess | `uploadData(cid, blake3Hash)` | Patient |
| Request data access | DataAccess | `requestAccess(patientAddr)` | Doctor |
| Approve a request | DataAccess | `approveAccess(doctorAddr)` | Patient |
| Revoke access | DataAccess | `revokeAccess(doctorAddr)` | Patient |
| Get genomic data | DataAccess | `getGenomicData(patientAddr)` | Patient or approved Doctor |
| Check access status | DataAccess | `checkAccess(patient, doctor)` | Anyone |

### On-Chain Events (for Audit Trail)

| Event | Fields | When |
|---|---|---|
| `PatientRegistered` | patientAddress, timestamp | New patient registers |
| `DataUploaded` | patient, ipfsCid, blake3Hash | Patient uploads data |
| `AccessRequested` | doctor, patient | Doctor requests access |
| `AccessApproved` | patient, doctor | Patient approves |
| `AccessRevoked` | patient, doctor | Patient revokes |
