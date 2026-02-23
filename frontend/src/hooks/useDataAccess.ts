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
