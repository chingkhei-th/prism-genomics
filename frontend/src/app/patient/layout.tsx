"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "patient") {
        router.push("/doctor");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "patient") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center animate-pulse text-gray-400">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
