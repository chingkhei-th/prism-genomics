# ⛓️ PRISM Genomics — Blockchain Module

> Smart contract layer for patient-owned genomic data access control on Ethereum.

**Stack:** Solidity 0.8.28 · Hardhat v3 · Viem · Mocha + Chai · OpenZeppelin · Hardhat Ignition

---

## 📁 Directory Structure

```
blockchain/
├── contracts/
│   ├── PatientRegistry.sol        # Patient identity & registration
│   └── DataAccess.sol             # Data upload, access control, audit trail
├── test/
│   ├── PatientRegistry.test.ts    # Registration tests — Mocha + Chai (3 cases)
│   └── DataAccess.test.ts         # Upload + access control tests — Mocha + Chai (5 cases)
├── ignition/
│   └── modules/
│       └── Deploy.ts              # Deployment module (PatientRegistry → DataAccess)
├── scripts/
│   └── send-op-tx.ts              # OP Stack L2 transaction example
├── hardhat.config.ts              # Hardhat v3 configuration
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### Install Dependencies

```bash
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

### Run All Tests

```bash
npx hardhat test
```

Run only Mocha or Solidity tests separately:

```bash
npx hardhat test mocha
npx hardhat test solidity
```

### Current Test Results

```
  DataAccess
    Uploading Data
      ✔ Should allow a registered patient to upload data
      ✔ Should prevent non-patients from uploading data
    Access Requests
      ✔ Should allow doctors to request access and patients to approve
      ✔ Should not let unauthorized users view data
      ✔ Should let patients revoke access

  PatientRegistry
    Registration
      ✔ Should allow a patient to register
      ✔ Should not allow dual registration
      ✔ Should correctly report unregistered patients

  8 passing ✅
```

---

## 📜 Smart Contract Details

### 1. `PatientRegistry.sol`

Handles patient identity on-chain. Only registered patients can upload genomic data.

#### Data Structures

```solidity
struct Patient {
    bool isRegistered;
    uint256 registeredAt;
}

mapping(address => Patient) public patients;
```

#### Functions

| Function | Access | Description |
|---|---|---|
| `register()` | Anyone (once) | Self-register as a patient. Reverts if already registered. |
| `isPatient(address)` | View | Returns `true` if the address is a registered patient. |

#### Events

| Event | Parameters | Emitted When |
|---|---|---|
| `PatientRegistered` | `patientAddress`, `timestamp` | A new patient registers |

#### Modifiers

| Modifier | Description |
|---|---|
| `onlyRegistered` | Restricts access to registered patients only |

---

### 2. `DataAccess.sol`

Core contract — manages encrypted genomic data references, doctor access requests, and patient-controlled permissions. **No raw genome data is stored on-chain**, only IPFS CIDs and BLAKE3 hashes.

#### Data Structures

```solidity
enum AccessStatus { None, Requested, Approved, Revoked }

struct GenomicData {
    string ipfsCid;        // IPFS Content Identifier of the encrypted file
    string blake3Hash;     // BLAKE3 hash for tamper-proof integrity verification
    bool exists;
}

struct AccessRequest {
    AccessStatus status;
    uint256 timestamp;
}

// Patient => Doctor => AccessRequest
mapping(address => mapping(address => AccessRequest)) public permissions;

// Patient => GenomicData
mapping(address => GenomicData) public patientData;
```

#### Functions

| Function | Access | Description |
|---|---|---|
| `uploadData(cid, blake3Hash)` | Registered patients only | Store IPFS CID + BLAKE3 hash on-chain |
| `requestAccess(patient)` | Any address (doctors) | Request permission to view a patient's data |
| `approveAccess(doctor)` | Patient only | Approve a pending access request from a doctor |
| `revokeAccess(doctor)` | Patient only | Revoke a previously approved doctor's access |
| `checkAccess(patient, doctor)` | View | Returns `true` if the doctor has approved access |
| `getGenomicData(patient)` | Patient or approved doctor | Returns `(ipfsCid, blake3Hash)`. Reverts if unauthorized. |

#### Events (Audit Trail)

Every state change emits an event, creating an **immutable on-chain audit log**:

| Event | Parameters | Emitted When |
|---|---|---|
| `DataUploaded` | `patient`, `ipfsCid`, `blake3Hash` | Patient uploads data hashes |
| `AccessRequested` | `doctor`, `patient` | Doctor requests access |
| `AccessApproved` | `patient`, `doctor` | Patient approves a request |
| `AccessRevoked` | `patient`, `doctor` | Patient revokes access |

#### Access Control Flow

```
┌──────────┐    register()     ┌──────────────────┐
│  Patient  │ ───────────────► │  PatientRegistry  │
└──────────┘                   └──────────────────┘
      │
      │  uploadData(cid, hash)
      ▼
┌──────────────┐
│  DataAccess   │◄──── requestAccess(patient) ──── Doctor
└──────────────┘
      │
      │  approveAccess(doctor)  ←  Patient decision
      │  revokeAccess(doctor)   ←  Patient decision
      │
      ▼
  getGenomicData(patient)  →  Returns (CID, Hash) if authorized
```

#### Permission State Machine

```
  None ──► Requested ──► Approved ──► Revoked
                             │            │
                             └────────────┘
                           (can re-request)
```

---

## 🌐 Network Configuration

Defined in `hardhat.config.ts`:

| Network | Type | Chain | Usage |
|---|---|---|---|
| `hardhatMainnet` | `edr-simulated` | L1 | Local testing (default) |
| `hardhatOp` | `edr-simulated` | OP | OP Stack L2 simulation |
| `sepolia` | `http` | L1 | Testnet deployment |

### Config Variables

| Variable | Purpose |
|---|---|
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint (e.g. Alchemy, Infura) |
| `SEPOLIA_PRIVATE_KEY` | Deployer wallet private key |

Set config variables using the keystore:

```bash
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
npx hardhat keystore set SEPOLIA_RPC_URL
```

---

## 🚢 Deployment

The project uses **Hardhat Ignition** for deployments. The deployment module in `ignition/modules/Deploy.ts` deploys both contracts in the correct order:

1. Deploys `PatientRegistry`
2. Deploys `DataAccess` with the `PatientRegistry` address as constructor argument

### Deploy Locally

```bash
npx hardhat ignition deploy ignition/modules/Deploy.ts
```

### Deploy to Sepolia

```bash
npx hardhat ignition deploy --network sepolia ignition/modules/Deploy.ts
```

---

## 🧪 Testing Guide

Tests use **Mocha + Chai** (via `@nomicfoundation/hardhat-mocha`) + **Viem** for blockchain interaction.

### Key Pattern (Hardhat v3)

In Hardhat v3, viem helpers are accessed through the **network connection**, not directly on `hre`:

```typescript
import { expect } from "chai";
import hre from "hardhat";

// ✅ Correct (Hardhat v3)
const connection = await hre.network.connect();
const [owner, patient1] = await connection.viem.getWalletClients();
const contract = await connection.viem.deployContract("PatientRegistry");

// ❌ Wrong (Hardhat v2 style — will fail)
// const [owner] = await hre.ethers.getSigners();
// const contract = await hre.viem.deployContract("...");
```

### Viem Contract Interaction

```typescript
// Write (state-changing)
const hash = await contract.write.register({ account: patient1.account });
await publicClient.waitForTransactionReceipt({ hash });

// Read + Chai assertion
const isRegistered = await contract.read.isPatient([patient1.account.address]);
expect(isRegistered).to.be.true;

// Write with arguments
await contract.write.uploadData([cid, blake3Hash], { account: patient1.account });

// Expect revert
try {
  await contract.write.register({ account: patient1.account });
  expect.fail("Should have reverted");
} catch (error: any) {
  expect(error.message).to.include("Patient already registered");
}
```

---

## 📦 Dependencies

| Package | Version | Purpose |
|---|---|---|
| `hardhat` | ^3.1.9 | Development framework |
| `@nomicfoundation/hardhat-toolbox-viem` | ^5.0.2 | Viem integration bundle |
| `@nomicfoundation/hardhat-viem` | ^3.0.2 | Viem helpers for Hardhat |
| `@nomicfoundation/hardhat-mocha` | ^3.0.10 | Mocha test runner for Hardhat v3 |
| `@nomicfoundation/hardhat-ignition` | ^3.0.7 | Declarative deployment system |
| `@nomicfoundation/hardhat-network-helpers` | ^3.0.3 | Test utilities (time, mining) |
| `chai` | latest | BDD assertion library |
| `viem` | ^2.46.2 | TypeScript Ethereum library |
| `@openzeppelin/contracts` | ^5.4.0 | Battle-tested Solidity libraries |
| `typescript` | ~5.8.0 | TypeScript compiler |

---

