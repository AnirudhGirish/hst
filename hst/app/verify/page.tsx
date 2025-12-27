/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

const VerifyPage = () => {
  const [userid, setUserid] = useState("");
  // ❌ REMOVED: const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpFromDevice, setOtpFromDevice] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  // Check device status on mount
  useEffect(() => {
    checkDeviceStatus();
    const interval = setInterval(checkDeviceStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Update OTP expiry countdown
  useEffect(() => {
    if (!expiresIn) return;
    
    const interval = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev === null || prev <= 1) {
          setOtpFromDevice("");
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresIn]);

  const checkDeviceStatus = async () => {
    try {
      const res = await fetch("/api/bridge/device");
      if (res.ok) {
        const data = await res.json();
        setDeviceStatus(data);
      } else {
        setDeviceStatus(null);
      }
    } catch (error) {
      console.error("Failed to check device:", error);
      setDeviceStatus(null);
    }
  };

  const fetchOTPFromDevice = async () => {
    try {
      setResult(null);
      const res = await fetch("/api/bridge/otp?consume=false");
      
      if (!res.ok) {
        const error = await res.json();
        setResult({
          success: false,
          message: error.error || "No OTP available. Press button on device.",
        });
        return;
      }

      const data = await res.json();
      setOtpFromDevice(data.otp);
      setOtp(data.otp);
      setExpiresIn(data.expires_in);
      setResult({
        success: true,
        message: `OTP received: ${data.otp}`,
      });
    } catch (error) {
      console.error("Failed to fetch OTP:", error);
      setResult({
        success: false,
        message: "Failed to connect to bridge server. Is it running?",
      });
    }
  };

  const clearOTPCache = async () => {
    try {
      setResult(null);
      const res = await fetch("/api/bridge/flush", {
        method: "POST",
      });

      if (res.ok) {
        setOtpFromDevice("");
        setOtp("");
        setExpiresIn(null);
        setResult({
          success: true,
          message: "Cache cleared! Press button on device for new OTP.",
        });
      } else {
        setResult({
          success: false,
          message: "Failed to clear cache",
        });
      }
    } catch (error) {
      console.error("Failed to clear cache:", error);
      setResult({
        success: false,
        message: "Failed to connect to bridge server",
      });
    }
  };

  const handleVerify = async (e: any) => {
    e.preventDefault();
    setVerifying(true);
    setResult(null);

    try {
      // 🔥 FIX: Only send userid and otp (NO PASSWORD)
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid,
          otp,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({
          success: true,
          message: "✓ Authentication successful!",
        });
        
        // Clear OTP fields for next authentication
        setOtpFromDevice("");
        setOtp("");
        setExpiresIn(null);
      } else if (res.status === 410) {
        // 🔥 FIX: Handle OTP already consumed
        setResult({
          success: false,
          message: "⚠️ OTP already used. Press button on device for new OTP.",
        });
        setOtpFromDevice("");
        setOtp("");
        setExpiresIn(null);
      } else {
        setResult({
          success: false,
          message: data.message || "Authentication failed",
        });
      }
    } catch (error) {
      console.error("Verification error:", error);
      setResult({
        success: false,
        message: "Verification failed. Please try again.",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center p-10 text-3xl font-semibold font-mono bg-cyan-200 border-2 border-cyan-500 rounded-b-2xl hover:shadow-lg hover:shadow-cyan-400 transition duration-300">
        <Link href="/" className="text-base hover:underline">
          ← Home
        </Link>
        <span>Verify | HST</span>
        <div className="w-20"></div>
      </div>

      {/* Device Status */}
      <div className="max-w-3xl mx-auto mt-10">
        <div
          className={`p-4 rounded-xl border-2 text-center font-semibold ${
            deviceStatus?.connected
              ? "bg-green-100 border-green-500 text-green-800"
              : "bg-red-100 border-red-500 text-red-800"
          }`}
        >
          {deviceStatus?.connected
            ? `✓ Hardware Token Connected (${deviceStatus.device?.port})`
            : "✗ Hardware Token Not Connected"}
        </div>
      </div>

      {/* Main Form */}
      <div className="max-w-3xl flex flex-col gap-5 bg-cyan-500/75 mx-auto p-10 rounded-3xl border-8 border-cyan-700 mt-10 text-xl font-bold">
        <form onSubmit={handleVerify}>
          {/* Credentials Section */}
          <div className="flex flex-col gap-5 mb-6">
            <div className="flex items-center gap-4">
              <label htmlFor="userid" className="w-32">
                User ID
              </label>
              <input
                id="userid"
                type="text"
                placeholder="Enter User ID"
                value={userid}
                onChange={(e) => setUserid(e.target.value)}
                required
                className="flex-1 bg-cyan-200 px-4 py-2 outline-none focus:ring-2 focus:ring-cyan-800 placeholder:text-neutral-500 text-cyan-900 font-semibold rounded"
              />
            </div>

            {/* ❌ REMOVED: Password input field */}
          </div>

          {/* Hardware OTP Section */}
          <div className="border-t-2 border-cyan-700 pt-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <label htmlFor="otp" className="w-32">
                Hardware OTP
              </label>
              <input
                id="otp"
                type="text"
                placeholder="Press 'Fetch OTP' button"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                disabled={true} // 🔥 FIX: Always disabled - no manual input
                className="flex-1 bg-gray-200 px-4 py-2 outline-none placeholder:text-neutral-500 text-cyan-900 font-semibold rounded text-center text-2xl tracking-widest cursor-not-allowed"
              />
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={fetchOTPFromDevice}
                disabled={!deviceStatus?.connected}
                className="flex-1 bg-cyan-700 text-cyan-200 p-3 rounded-xl hover:bg-cyan-800 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔄 Fetch OTP from Device
              </button>
              <button
                type="button"
                onClick={clearOTPCache}
                className="bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition duration-300"
              >
                🗑️ Clear Cache
              </button>
            </div>

            {otpFromDevice && expiresIn !== null && (
              <div className="mt-4 text-center text-sm bg-cyan-200 p-2 rounded">
                OTP expires in: <strong>{expiresIn}s</strong>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={verifying || !userid || !otp}
            className="w-full bg-cyan-200 p-4 rounded-xl text-cyan-900 hover:bg-cyan-900 hover:text-cyan-200 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
          >
            {verifying ? "Verifying..." : "🔐 Verify Credentials"}
          </button>
        </form>

        {/* Result Message */}
        {result && (
          <div
            className={`p-4 rounded-xl text-center font-semibold ${
              result.success
                ? "bg-green-200 text-green-800"
                : "bg-red-200 text-red-800"
            }`}
          >
            {result.message}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-cyan-100 rounded-xl border-2 border-cyan-300">
        <h3 className="font-bold text-lg mb-2">📝 Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Ensure hardware token is connected (check status above)</li>
          <li>Enter your User ID</li>
          <li>Press the button on your hardware token</li>
          <li>Click &quot;Fetch OTP from Device&quot; to retrieve the code</li>
          <li>Click &quot;Verify Credentials&quot; to authenticate</li>
          <li>⚠️ Each OTP can only be used once - generate new OTP for each login</li>
        </ol>
      </div>
    </div>
  );
};

export default VerifyPage;