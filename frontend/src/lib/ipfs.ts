import axios from "axios";

const PINATA_API_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

export async function uploadToIPFS(
  encryptedData: Uint8Array,
  filename: string
): Promise<string> {
  const formData = new FormData();
  const blob = new Blob([encryptedData.buffer as ArrayBuffer], { type: "application/octet-stream" });
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
