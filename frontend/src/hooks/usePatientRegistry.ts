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
