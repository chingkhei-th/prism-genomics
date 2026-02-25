# PRISM Genomics Setup Guide

Welcome to the **PRISM Genomics** platform! This guide will help you set up and run the application locally on your machine. We provide two methods: a quick start using Docker, and a manual setup for development purposes.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Node.js**: v18.0 or higher
- **Python**: v3.12 or higher (We recommend using `uv` for package management)
- **Docker & Docker Compose**: (Required for Method 1)
- **MetaMask**: A Web3 wallet extension for your browser
- **Git**

## Environment Variables

You will need to configure environment variables for the different services. Example files (`.env.example`) are provided in the respective directories.

1. **Backend**: Navigate to `backend/` and copy `.env.example` to `.env`. Fill in the necessary database URLs, secret keys, and Web3 provider info.
2. **Frontend**: Navigate to `frontend/` and copy `.env.example` to `.env`. Add your Supabase keys (if applicable) and backend API URLs.
3. **Blockchain**: Navigate to `blockchain/` and copy `.env.example` to `.env`. Add your private keys and RPC URLs if deploying to testnets/mainnets.
4. **IPFS**: Navigate to `IPFS/` and copy `.env.example` to `.env`. Add your keys for IPFS STORAGE.

---

## Method 1: Quick Start with Docker (Recommended)

The easiest way to get the entire stack (Frontend + Backend) running is by using Docker Compose.

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd prism-genomics
   ```

2. **Set up Environment Variables**:
   Ensure you have created your `.env` files in `backend/` and `frontend/` as described above.

3. **Build and Start Services**:
   Run the following command from the root directory:

   ```bash
   docker-compose up --build
   ```

4. **Access the Application**:
   - **Frontend UI**: Open your browser and navigate to `http://localhost:3000`
   - **Backend API**: The API will be available at `http://localhost:8000`

---

## Method 2: Manual Local Setup (For Developers)

If you are developing or contributing to the project, you may want to run the services individually without Docker.

### 1. Blockchain Setup

1. Navigate to the `blockchain/` directory:

   ```bash
   cd blockchain
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. (Optional) Run a local Hardhat node:

   ```bash
   npx hardhat node
   ```

4. Deploy contracts to your local network (in a new terminal):

   ```bash
   npx hardhat ignition deploy ignition/modules/Deploy.ts --network localhost
   ```

### 2. Backend Setup

1. Navigate to the `backend/` directory:

   ```bash
   cd backend
   ```

2. Install dependencies using `uv` (recommended for speed) or `pip`:

   ```bash
   uv sync
   # OR
   pip install -r requirements.txt # (If generated)
   ```

3. Generate Prisma Client:

   ```bash
   prisma generate
   ```

4. Start the FastAPI server:

   ```bash
   uvicorn src.api.server:app --reload
   ```

   The backend will now be running at `http://localhost:8000`.

### 3. Frontend Setup

1. Navigate to the `frontend/` directory (in a new terminal):

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the Next.js development server:

   ```bash
   npm run dev
   ```

   The frontend will now be running at `http://localhost:3000`.

---

## Deployment: AWS EC2 (t3.micro)

To deploy the PRISM Genomics platform to an AWS EC2 `t3.micro` instance:

1. **Launch Instance**: Create an Ubuntu (or preferred Linux OS) `t3.micro` instance in the AWS Console. Configure Security Groups to allow inbound HTTP (80), HTTPS (443), and custom TCP ports (3000, 8000) if required.
2. **Install Dependencies**: SSH into your instance and install Docker, Docker Compose, and Git.
3. **Clone & Configure**:

   ```bash
   git clone <repository-url>
   cd prism-genomics
   ```

   *Remember to set up your `.env` files, making sure the backend uses your Supabase database URL.*
4. **Run Services**:

   ```bash
   sudo docker-compose up -d --build
   ```

   The `-d` flag runs the containers in detached mode.

---

## Troubleshooting

- **Ports already in use**: If ports 3000 or 8000 are already in use, you can modify the port mappings in `docker-compose.yml` or run the manual setup commands with different port flags.
- **Database connection issues**: Double check that your `DATABASE_URL` in `backend/.env` is correct and pointing to your Supabase instance. If using Docker, ensure the network configuration allows the containers to communicate.

If you encounter any other issues, please refer to the specific directory's README or open an issue on the repository.
