"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";

export default function LoginForm({ onSubmit }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const handleFormSubmit = async (data) => {
    setLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Mobile Logo */}
      <div className="lg:hidden font-syne font-extrabold text-xl text-[#1D9E75] mb-10">
        Aqua<span className="text-[#e8f4f0]">Connect</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h1 className="font-syne text-3xl font-extrabold tracking-tight mb-2">
          Welcome back
        </h1>
        <p className="text-sm text-[rgba(232,244,240,0.4)] font-light">
          Sign in to your admin dashboard
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-xs text-[rgba(232,244,240,0.5)] font-medium mb-2 tracking-wide">
            Email address
          </label>
          <div className="relative group">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.2)] group-focus-within:text-[#1D9E75] transition-colors text-sm">
              ✉
            </span>
            <input
              type="email"
              placeholder="admin@aquaconnect.com"
              suppressHydrationWarning
              {...register("email", {
                required: "Email is required.",
                pattern: {
                  value: /\S+@\S+\.\S+/,
                  message: "Enter a valid email address.",
                },
              })}
              className={`w-full bg-[rgba(29,158,117,0.04)] border rounded-xl pl-10 pr-4 py-3.5 text-sm
                text-[#e8f4f0] placeholder-[rgba(232,244,240,0.2)] outline-none transition-all
                ${
                  errors.email
                    ? "border-[rgba(240,149,149,0.5)] focus:border-[rgba(240,149,149,0.7)]"
                    : "border-[rgba(29,158,117,0.12)] focus:border-[rgba(29,158,117,0.5)] focus:bg-[rgba(29,158,117,0.07)]"
                }`}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-[#f09595] mt-1.5 pl-0.5">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs text-[rgba(232,244,240,0.5)] font-medium mb-2 tracking-wide">
            Password
          </label>
          <div className="relative group">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.2)] group-focus-within:text-[#1D9E75] transition-colors text-sm">
              🔒
            </span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              suppressHydrationWarning
              {...register("password", {
                required: "Password is required.",
              })}
              className={`w-full bg-[rgba(29,158,117,0.04)] border rounded-xl pl-10 pr-12 py-3.5 text-sm
                text-[#e8f4f0] placeholder-[rgba(232,244,240,0.2)] outline-none transition-all
                ${
                  errors.password
                    ? "border-[rgba(240,149,149,0.5)] focus:border-[rgba(240,149,149,0.7)]"
                    : "border-[rgba(29,158,117,0.12)] focus:border-[rgba(29,158,117,0.5)] focus:bg-[rgba(29,158,117,0.07)]"
                }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgba(232,244,240,0.25)] hover:text-[rgba(232,244,240,0.6)] transition-colors text-sm"
            >
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-[#f09595] mt-1.5 pl-0.5">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Remember & Forgot */}
        <div className="flex items-center justify-between">
          {/* <label className="flex items-center gap-2 text-xs text-[rgba(232,244,240,0.4)] cursor-pointer">
            <input type="checkbox" className="accent-[#1D9E75] w-3.5 h-3.5" />
            Remember me
          </label> */}
          <Link
            href="/forgot-password"
            className="text-xs text-[#1D9E75] hover:text-[#5DCAA5] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#1D9E75] text-[#020f1a] font-syne font-bold py-3.5 rounded-xl
            hover:bg-[#5DCAA5] transition-all hover:-translate-y-0.5 active:translate-y-0
            disabled:opacity-60 disabled:cursor-not-allowed text-sm tracking-tight"
        >
          {loading ? "Signing in..." : "Sign in to Dashboard"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-7">
        <div className="flex-1 h-px secure-divider-line" />
        <span className="text-xs secure-divider-text tracking-[0.16em] uppercase flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full secure-divider-dot" />
          secured connection
        </span>
        <div className="flex-1 h-px secure-divider-line" />
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-[rgba(232,244,240,0.2)]">
        <div className="w-5 h-5 rounded-full bg-[rgba(29,158,117,0.12)] flex items-center justify-center text-[9px] text-[#1D9E75]">
          🔐
        </div>
        Protected by JWT authentication & OTP verification
      </div>
    </div>
  );
}
