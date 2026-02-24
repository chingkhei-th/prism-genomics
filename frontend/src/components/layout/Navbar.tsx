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
import { useState, useRef, useEffect } from "react";

export function Navbar() {
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
    <nav className="p-4 border-b border-gray-800 flex justify-between items-center bg-black/95 backdrop-blur-md sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link
          href="/"
          className="font-bold text-2xl tracking-tight text-white flex items-center gap-2"
        >
          <span className="text-blue-500">PRISM</span> Genomics
        </Link>

        {/* Nav links based on role */}
        {user && (
          <div className="hidden md:flex items-center gap-1">
            {user.role === "patient" && (
              <>
                <Link
                  href="/patient"
                  className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                >
                  Dashboard
                </Link>
                <Link
                  href="/patient/upload"
                  className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                >
                  Upload
                </Link>
                <Link
                  href="/patient/permissions"
                  className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                >
                  Permissions
                </Link>
              </>
            )}
            {user.role === "doctor" && (
              <Link
                href="/doctor"
                className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
              >
                Doctor Portal
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Right side: auth buttons or user menu */}
      <div className="flex items-center gap-3">
        {isLoading ? (
          <div className="w-24 h-9 bg-gray-800 rounded-lg animate-pulse" />
        ) : user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-all text-sm"
            >
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                {user.role === "doctor" ? (
                  <Stethoscope className="w-4 h-4" />
                ) : (
                  <HeartPulse className="w-4 h-4" />
                )}
              </div>
              <span className="text-gray-300 hidden sm:inline max-w-[150px] truncate">
                {user.name || user.email}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize">
                {user.role}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl shadow-black/50 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-800">
                  <p className="text-sm font-medium text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>

                {/* Mobile nav links */}
                <div className="md:hidden border-b border-gray-800 py-1">
                  {user.role === "patient" && (
                    <>
                      <Link
                        href="/patient"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/patient/upload"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                      >
                        Upload
                      </Link>
                      <Link
                        href="/patient/permissions"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
                      >
                        Permissions
                      </Link>
                    </>
                  )}
                  {user.role === "doctor" && (
                    <Link
                      href="/doctor"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-all"
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
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-2 mt-1"
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
              className="px-4 py-2 text-sm text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <UserPlus className="w-4 h-4" /> Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
