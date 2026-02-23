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
