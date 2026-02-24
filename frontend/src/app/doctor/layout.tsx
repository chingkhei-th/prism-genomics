"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

export default function DoctorLayout({
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
      } else if (user.role !== "doctor") {
        router.push("/patient");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== "doctor") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center animate-pulse text-gray-400">
        Loading...
      </div>
    );
  }

  return <div className="pt-28">{children}</div>;
}
