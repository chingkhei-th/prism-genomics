import { ConnectButton } from "@/components/wallet/ConnectButton";

export function Navbar() {
  return (
    <nav className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/95 backdrop-blur-md sticky top-0 z-50">
      <div className="font-bold text-2xl tracking-tight text-white flex items-center gap-2">
        <span className="text-blue-500">PRISM</span> Genomics
      </div>
      <div>
        <ConnectButton />
      </div>
    </nav>
  );
}
