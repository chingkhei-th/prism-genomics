# 🖥️ PRISM Genomics — Frontend Implementation Plan

> Facebook-style login — user sees email/password, blockchain runs silently behind the scenes.

---

## Architecture Change: No MetaMask

```
USER EXPERIENCE                         BEHIND THE SCENES
──────────────                         ──────────────────
Sign up with email/password    →       Backend creates Ethereum wallet
Click "Upload VCF"             →       Backend encrypts + pins to IPFS
See risk results               →       Backend calls FastAPI AI engine
Click "Approve Doctor"         →       Backend signs tx with custodial wallet
                                       User never sees wallets, gas, or crypto
```

---

## Phase 1: Backend Auth + Wallet Service

> **This is new** — the backend needs user accounts + custodial wallets.

### Step 1.1 — User Database

Add to FastAPI backend: SQLite (dev) / PostgreSQL (prod) with users table.

```
users table:
┌──────────┬─────────────────┬────────────┬──────────────────────┬───────────────────┐
│ id       │ email           │ role       │ wallet_address       │ encrypted_privkey │
├──────────┼─────────────────┼────────────┼──────────────────────┼───────────────────┤
│ 1        │ john@email.com  │ patient    │ 0xf39F...2266        │ (AES encrypted)   │
│ 2        │ dr.smith@h.com  │ doctor     │ 0x7099...79C8        │ (AES encrypted)   │
└──────────┴─────────────────┴────────────┴──────────────────────┴───────────────────┘
```

### Step 1.2 — Auth API Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/auth/signup` | POST | Create account + generate wallet |
| `/api/v1/auth/login` | POST | Authenticate → return JWT |
| `/api/v1/auth/me` | GET | Get current user profile |

### Step 1.3 — Blockchain Service (Server-Side)

Backend uses `web3.py` or `viem` (Python) to call contracts on behalf of users.

| Endpoint | Method | Contract Call |
|---|---|---|
| `/api/v1/patient/register` | POST | `PatientRegistry.register()` |
| `/api/v1/patient/upload` | POST | Encrypt → IPFS → `DataAccess.uploadData()` |
| `/api/v1/patient/permissions` | GET | Read access list from contract events |
| `/api/v1/patient/approve` | POST | `DataAccess.approveAccess(doctor)` |
| `/api/v1/patient/revoke` | POST | `DataAccess.revokeAccess(doctor)` |
| `/api/v1/doctor/request` | POST | `DataAccess.requestAccess(patient)` |
| `/api/v1/doctor/patients` | GET | List approved patients |
| `/api/v1/doctor/view/{addr}` | GET | `DataAccess.getGenomicData()` → decrypt |

### Step 1.4 — Files to Create (Backend)

```
backend/src/
├── auth/
│   ├── models.py              # User SQLAlchemy model
│   ├── schemas.py             # Pydantic request/response schemas
│   ├── routes.py              # /signup, /login, /me
│   ├── jwt.py                 # JWT token creation + validation
│   └── wallet.py              # Generate + encrypt/decrypt Ethereum wallets
├── blockchain/
│   ├── service.py             # Call smart contracts (web3.py)
│   └── routes.py              # /register, /upload, /approve, /revoke, /request
└── database.py                # SQLite/PostgreSQL connection
```

---

## Phase 2: Frontend Setup

### Step 2.1 — Create Next.js Project

```bash
cd prism-genomics
npx create-next-app@latest frontend --typescript --tailwind --app --src-dir --use-npm
cd frontend
npm install sonner lucide-react recharts
```

> **No wagmi, no viem, no connectkit** — all blockchain is server-side now.

### Step 2.2 — Files to Create

```
frontend/src/
├── providers/
│   └── AuthProvider.tsx         # React context for JWT auth state
├── lib/
│   └── api.ts                   # fetch wrapper with JWT headers
├── components/
│   └── layout/
│       ├── Navbar.tsx           # Logo + nav + Login/Signup or user avatar
│       └── Footer.tsx
└── app/
    └── layout.tsx               # Root layout with AuthProvider
```

---

## Phase 3: Auth Pages

### Page 3.1 — Signup (`/signup`)

```
┌─────────────────────────────────────────────┐
│  PRISM Genomics                             │
├─────────────────────────────────────────────┤
│                                              │
│         Create Your Account                  │
│                                              │
│   Full Name:  [________________]             │
│   Email:      [________________]             │
│   Password:   [________________]             │
│   Role:       (●) Patient  (○) Doctor        │
│                                              │
│              [Sign Up]                       │
│                                              │
│   Already have an account? Log in            │
│                                              │
└─────────────────────────────────────────────┘
```

Behind the scenes:
1. Backend creates user in DB
2. Backend generates Ethereum wallet (private key encrypted with server key)
3. Backend calls `PatientRegistry.register()` if role = patient
4. Returns JWT token

### Page 3.2 — Login (`/login`)

```
┌─────────────────────────────────────────────┐
│  PRISM Genomics                             │
├─────────────────────────────────────────────┤
│                                              │
│         Welcome Back                         │
│                                              │
│   Email:      [________________]             │
│   Password:   [________________]             │
│                                              │
│              [Log In]                        │
│                                              │
│   Don't have an account? Sign up             │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Phase 4: Patient Pages

### Page 4.1 — Patient Dashboard (`/patient`)

```
┌─────────────────────────────────────────────┐
│  Dashboard             john@email.com [▼]   │
├─────────────────────────────────────────────┤
│                                              │
│  Welcome back, John!                         │
│  🟢 Registered on Blockchain                 │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │ 🧬 Upload &  │  │ 🔐 Manage   │         │
│  │ Analyze VCF  │  │ Permissions  │         │
│  │  [Go →]      │  │  [Go →]      │         │
│  └──────────────┘  └──────────────┘         │
│                                              │
│  Recent Activity:                            │
│  • VCF uploaded — Feb 23, 2026              │
│  • Dr. Smith approved — Feb 22, 2026        │
└─────────────────────────────────────────────┘
```

### Page 4.2 — Upload + AI Analysis (`/patient/upload`)

```
┌─────────────────────────────────────────────┐
│  Upload & Analyze                           │
├─────────────────────────────────────────────┤
│                                              │
│  ┌─────────────────────────────────┐        │
│  │  📁 Drag & drop your .vcf file  │        │
│  │     or click to browse          │        │
│  └─────────────────────────────────┘        │
│                                              │
│  [🔬 Analyze Risk]   [🔐 Encrypt & Store]   │
│                                              │
│  ── After Analysis ──                        │
│                                              │
│  Risk Score: ████████░░ 72.5%  (Moderate)   │
│  ML Prediction: At Risk (68.4%)              │
│                                              │
│  Top Contributing SNPs:                      │
│  ┌──────┬────────┬───────┬──────────┐       │
│  │ rsID │ Gene   │ Beta  │ Effect   │       │
│  ├──────┼────────┼───────┼──────────┤       │
│  │ rs12 │ chr1   │ 0.15  │ ████     │       │
│  │ rs45 │ chr1   │ 0.12  │ ███      │       │
│  └──────┴────────┴───────┴──────────┘       │
│                                              │
│  Backend handles: encrypt → IPFS → on-chain  │
└─────────────────────────────────────────────┘
```

**API call:** `POST /api/v1/analyze` (AI) + `POST /api/v1/patient/upload` (blockchain)

### Page 4.3 — Permissions (`/patient/permissions`)

```
┌─────────────────────────────────────────────┐
│  Access Permissions                         │
├─────────────────────────────────────────────┤
│                                              │
│  Pending Requests:                           │
│  ┌──────────────────────────────────┐       │
│  │ Dr. Smith (dr.s@h.com)           │       │
│  │ Requested: Feb 23, 2026          │       │
│  │ [✅ Approve]  [❌ Deny]          │       │
│  └──────────────────────────────────┘       │
│                                              │
│  Approved Doctors:                           │
│  ┌──────────────────────────────────┐       │
│  │ Dr. Jones (j@h.com) │ [🔴 Revoke]│       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**API calls:** `GET /api/v1/patient/permissions`, `POST /api/v1/patient/approve`, `POST /api/v1/patient/revoke`

---

## Phase 5: Doctor Page

### Page 5.1 — Doctor Dashboard (`/doctor`)

```
┌─────────────────────────────────────────────┐
│  Doctor Dashboard                           │
├─────────────────────────────────────────────┤
│                                              │
│  Request Patient Data:                       │
│  ┌─────────────────────────────────┐        │
│  │ Patient Email: [_____________] │        │
│  │           [Request Access]      │        │
│  └─────────────────────────────────┘        │
│                                              │
│  My Patients (Approved):                     │
│  ┌──────────────────────────────────┐       │
│  │ John D. (john@email.com)         │       │
│  │ Risk: Moderate (72.5%)           │       │
│  │ [📄 View Report]                 │       │
│  └──────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

**API calls:** `POST /api/v1/doctor/request`, `GET /api/v1/doctor/patients`

---

## Phase 6: Landing Page

### Page 6.1 — Home (`/`)

```
┌─────────────────────────────────────────────┐
│  PRISM Genomics        [Login] [Sign Up]    │
├─────────────────────────────────────────────┤
│                                              │
│   🧬 Own Your Genomic Data                   │
│   AI-Powered Risk Intelligence               │
│   Blockchain-Secured Privacy                 │
│                                              │
│   [Get Started — It's Free]                  │
│                                              │
├─────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ 🤖 AI   │  │ 🔐 AES  │  │ ⛓️ Chain │     │
│  │ Risk    │  │ 256-GCM │  │ Access  │     │
│  │ Predict │  │ Encrypt │  │ Control │     │
│  └─────────┘  └─────────┘  └─────────┘     │
│                                              │
│  How It Works:                               │
│  1. Sign up → 2. Upload VCF → 3. Get Report │
└─────────────────────────────────────────────┘
```

---

## Full File Tree (~25 files)

```
backend/src/                         # NEW backend files
├── auth/
│   ├── models.py                    # User model (email, role, wallet)
│   ├── schemas.py                   # Pydantic schemas
│   ├── routes.py                    # /signup, /login, /me
│   ├── jwt.py                       # JWT create/verify
│   └── wallet.py                    # Custodial wallet management
├── blockchain/
│   ├── service.py                   # web3.py contract calls
│   └── routes.py                    # /register, /upload, /approve, etc.
└── database.py                      # SQLAlchemy setup

frontend/src/                        # NEW frontend files
├── app/
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Landing
│   ├── globals.css                  # Dark theme styles
│   ├── login/page.tsx               # Login form
│   ├── signup/page.tsx              # Signup form
│   ├── patient/
│   │   ├── page.tsx                 # Dashboard
│   │   ├── upload/page.tsx          # Upload + risk results
│   │   └── permissions/page.tsx     # Approve/revoke
│   └── doctor/
│       └── page.tsx                 # Doctor dashboard
├── components/
│   ├── layout/Navbar.tsx
│   ├── patient/VCFUploader.tsx
│   ├── patient/RiskGauge.tsx
│   └── patient/SNPTable.tsx
├── providers/
│   └── AuthProvider.tsx             # JWT auth context
└── lib/
    └── api.ts                       # Fetch wrapper with auth
```

---

## Environment Variables

### Backend (`.env`)
```env
DATABASE_URL=sqlite:///./prism.db
JWT_SECRET=your_jwt_secret_key
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
PATIENT_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
DATA_ACCESS_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
WALLET_ENCRYPTION_KEY=your_32_byte_hex_key
```

### Frontend (`.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

> Frontend only needs the API URL — everything else is server-side!

---

## Build Order

| Step | What | Est. Time |
|---|---|---|
| 1 | Backend: auth (models, JWT, signup/login) | 2-3 hrs |
| 2 | Backend: custodial wallet service | 1-2 hrs |
| 3 | Backend: blockchain routes (register, upload, approve) | 2-3 hrs |
| 4 | Frontend: project setup + auth pages (login/signup) | 2-3 hrs |
| 5 | Frontend: landing page | 1-2 hrs |
| 6 | Frontend: patient dashboard + upload + results | 3-4 hrs |
| 7 | Frontend: permissions page | 1-2 hrs |
| 8 | Frontend: doctor dashboard | 2-3 hrs |

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| No MetaMask | Users don't need crypto knowledge |
| Custodial wallets | Backend manages keys securely |
| JWT auth | Standard session management |
| Email-based identity | Doctors request by email, not wallet address |
| Server-side signing | All blockchain tx happen on backend |
| SQLite for dev | Easy setup, switch to PostgreSQL for prod |
