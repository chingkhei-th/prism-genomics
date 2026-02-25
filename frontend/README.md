# PRISM-Genomics Frontend

**Polygenic Risk Intelligence for Secure Medicine** — The user-facing dashboard for encrypted genomic data upload, MetaMask authentication, and disease risk visualization.

## Overview

The PRISM-Genomics frontend is built using **Next.js (App Router)**. It provides a clean, responsive, and secure interface for patients and doctors to interact with the broader Web3 and AI infrastructure.

### Key Features & Technologies
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS v4 for rapid, utility-first UI design.
- **Authentication**: Web3 Wallet Integration for decentralized identity login.
- **Visualization**: Recharts is used to render interactive, dynamic risk probability charts returned from the AI pipeline.
- **Cryptography**: Integrates `@noble/ciphers` and `hash-wasm` to handle AES-256 encryption and BLAKE3 hashing completely client-side. Raw genomic data never leaves the browser unencrypted.

---

## 🚀 Local Development

### Prerequisites
- Node.js v18.0 or higher
- npm (Node Package Manager)

### 1. Install Dependencies

Navigate to the `frontend` directory and install the necessary npm packages:

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

The application requires environment variables to connect to Supabase, the Backend API, and Web3 endpoints.

Copy the template file:
```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase URL, Anon Key, and other required credentials.

### 3. Start the Development Server

Run the following command:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. The application supports Hot Module Replacement (HMR), so it will automatically update as you modify files in the `src/` directory.

---

## 📁 Project Structure

All source code is located within the `src/` directory to keep the root clean.

- `src/app/`: Next.js App Router pages and layout configurations.
- `src/components/`: Reusable React components (buttons, layout wrappers, charts, wallet connectors).
- `src/lib/`: Core libraries (client initialization, Web3 integration scripts, formatting utilities).
- `src/utils/`: Generic helper functions.
- `src/providers/`: React Context providers (e.g., Theme, Wallet State).

---

## 🐳 Docker Deployment

The frontend is fully containerized. To run it alongside the backend via Docker Compose from the **root directory** of the project:

```bash
cd ..
docker-compose up --build frontend
```
