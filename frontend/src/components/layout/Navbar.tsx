"use client";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import {
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
  Stethoscope,
  HeartPulse,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export function Navbar() {
  const pathname = usePathname();
  const { user, logout, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4 w-full pointer-events-none">
      <nav className="pointer-events-auto bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl shadow-[0_0_30px_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-bold text-lg tracking-tight text-white flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-[#cc99fd]">PRISM</span> Genomics
          </Link>

          {/* Nav links based on role */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {user.role === "patient" && (
                <>
                  <Link
                    href="/patient"
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      pathname === "/patient"
                        ? "bg-white text-black"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/patient/upload"
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      pathname === "/patient/upload"
                        ? "bg-white text-black"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Upload
                  </Link>
                  <Link
                    href="/patient/permissions"
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      pathname === "/patient/permissions"
                        ? "bg-white text-black"
                        : "text-gray-300 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    Permissions
                  </Link>
                </>
              )}
              {user.role === "doctor" && (
                <Link
                  href="/doctor"
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    pathname === "/doctor"
                      ? "bg-white text-black"
                      : "text-gray-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  Doctor Portal
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Right side: auth buttons or user menu */}
        <div className="flex items-center gap-2 ml-4">
          {isLoading ? (
            <div className="w-20 h-8 bg-white/10 rounded-full animate-pulse" />
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm"
              >
                <span className="text-gray-200 hidden sm:inline max-w-[100px] truncate font-medium">
                  {user.name?.split(" ")[0] || "User"}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                    <p className="text-sm font-medium text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  {/* Mobile nav links */}
                  <div className="md:hidden border-b border-white/5 py-1">
                    {user.role === "patient" && (
                      <>
                        <Link
                          href="/patient"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          Dashboard
                        </Link>
                        <Link
                          href="/patient/upload"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          Upload
                        </Link>
                        <Link
                          href="/patient/permissions"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          Permissions
                        </Link>
                      </>
                    )}
                    {user.role === "doctor" && (
                      <Link
                        href="/doctor"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                      >
                        Doctor Portal
                      </Link>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className={`px-4 py-1.5 text-sm font-medium transition-all rounded-full ${
                  pathname === "/login"
                    ? "bg-white text-black"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`px-4 py-1.5 text-sm font-medium transition-all rounded-full ${
                  pathname === "/signup"
                    ? "bg-white text-black shadow-lg"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
