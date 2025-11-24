"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DeviceStatus {
  connected: boolean;
  status: string;
  provisioned: boolean;
  eeprom_available: boolean;
  time_sync: boolean;
  user_id?: string;
}

const SetupPage = () => {
  const [userid, setUserid] = useState("");
  const [password, setPassword] = useState("");
  const [genHash, setGenHash] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [setupStatus, setSetupStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    checkDeviceStatus();
    const interval = setInterval(checkDeviceStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkDeviceStatus = async () => {
    try {
      const res = await fetch("/api/bridge/device");
      if (res.ok) {
        const data = await res.json();
        setDeviceStatus(data);
      }
    } catch (error) {
      console.error("Failed to check device:", error);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSetupStatus(null);

    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userid, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setGenHash(data.passwordHash);
        setTotpSecret(data.totpSecret);
        setQrCode(data.qrCodeUrl);
        setSetupStatus({
          success: true,
          message: "✓ Credentials generated successfully!",
        });
      } else {
        setSetupStatus({
          success: false,
          message: data.message || "Failed to generate credentials",
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      setSetupStatus({
        success: false,
        message: "Failed to connect to server",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSetupStatus(null);

    try {
      // Store in database
      const res = await fetch("/api/auth/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userid,
          passwordHash: genHash,
          totpSecret,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSetupStatus({
          success: true,
          message: "✓ Credentials stored! Device provisioned successfully.",
        });

        // Clear form after success
        setTimeout(() => {
          setUserid("");
          setPassword("");
          setGenHash("");
          setTotpSecret("");
          setQrCode("");
          checkDeviceStatus(); // Refresh device status
        }, 3000);
      } else {
        setSetupStatus({
          success: false,
          message: data.message || "Failed to store credentials",
        });
      }
    } catch (error) {
      console.error("Storage error:", error);
      setSetupStatus({
        success: false,
        message: "Failed to store credentials",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  return (
    <div className="max-w-5xl mx-auto min-h-screen pb-10">
      {/* Header */}
      <div className="flex justify-between items-center p-10 text-3xl font-semibold font-mono bg-cyan-200 border-2 border-cyan-500 rounded-b-2xl hover:shadow-lg hover:shadow-cyan-400 transition duration-300">
        <Link href="/" className="text-base hover:underline">
          ← Home
        </Link>
        <span>Setup | HST</span>
        <div className="w-20"></div>
      </div>

      {/* Device Status Banner */}
      <div className="max-w-3xl mx-auto mt-10">
        <div
          className={`p-4 rounded-xl border-2 ${
            deviceStatus?.connected
              ? "bg-green-100 border-green-500"
              : "bg-red-100 border-red-500"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-lg">
                {deviceStatus?.connected ? "✓ Device Connected" : "✗ Device Disconnected"}
              </div>
              {deviceStatus && (
                <div className="text-sm mt-1 space-x-4">
                  <span>Status: {deviceStatus.status}</span>
                  <span>EEPROM: {deviceStatus.eeprom_available ? "✓" : "✗"}</span>
                  <span>Time Sync: {deviceStatus.time_sync ? "✓" : "✗"}</span>
                  {deviceStatus.user_id && <span>User: {deviceStatus.user_id}</span>}
                </div>
              )}
            </div>
            {deviceStatus?.provisioned && (
              <div className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Already Provisioned
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Setup Form */}
      <div className="max-w-3xl mx-auto mt-10 space-y-6">
        {/* Step 1: Generate Credentials */}
        <div className="bg-cyan-500/75 p-8 rounded-3xl border-8 border-cyan-700">
          <h2 className="text-2xl font-bold mb-6 text-cyan-100">
            Step 1: Generate Credentials
          </h2>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div>
              <label htmlFor="userid" className="block text-lg font-semibold mb-2">
                User ID
              </label>
              <input
                id="userid"
                type="text"
                placeholder="Enter User ID (min 3 characters)"
                value={userid}
                onChange={(e) => setUserid(e.target.value)}
                required
                minLength={3}
                className="w-full bg-cyan-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-800 placeholder:text-neutral-500 text-cyan-900 font-semibold rounded"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-lg font-semibold mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-cyan-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-800 placeholder:text-neutral-500 text-cyan-900 font-semibold rounded"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !userid || !password}
              className="w-full bg-cyan-200/80 p-4 rounded-xl text-cyan-900 hover:bg-cyan-900 hover:text-cyan-200/80 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
            >
              {loading ? "Generating..." : "🔐 Generate TOTP Secret"}
            </button>
          </form>
        </div>

        {/* Step 2: Review Generated Data */}
        {genHash && (
          <div className="bg-cyan-500/75 p-8 rounded-3xl border-8 border-cyan-700">
            <h2 className="text-2xl font-bold mb-6 text-cyan-100">
              Step 2: Review Generated Data
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block mb-2 text-cyan-100 font-semibold">
                  Password Hash
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={genHash.substring(0, 50) + "..."}
                    readOnly
                    className="flex-1 bg-cyan-200 px-4 py-2 outline-none text-cyan-900 font-mono text-sm rounded"
                  />
                  <button
                    onClick={() => copyToClipboard(genHash)}
                    className="bg-cyan-700 text-cyan-200 px-4 py-2 rounded hover:bg-cyan-800"
                  >
                    📋
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-cyan-100 font-semibold">
                  TOTP Secret (Hex)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={totpSecret}
                    readOnly
                    className="flex-1 bg-cyan-200 px-4 py-2 outline-none text-cyan-900 font-mono text-sm rounded"
                  />
                  <button
                    onClick={() => copyToClipboard(totpSecret)}
                    className="bg-cyan-700 text-cyan-200 px-4 py-2 rounded hover:bg-cyan-800"
                  >
                    📋
                  </button>
                </div>
                <p className="text-xs text-cyan-100 mt-1">
                  This secret will be stored in both database and ESP32 EEPROM
                </p>
              </div>

              {qrCode && (
                <div className="flex flex-col items-center gap-2 bg-white p-4 rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48" />
                  <p className="text-sm text-gray-600 text-center">
                    Scan with Google Authenticator for testing
                    <br />
                    <span className="text-xs">(Hardware token is primary method)</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Store & Provision */}
        {genHash && (
          <div className="bg-cyan-500/75 p-8 rounded-3xl border-8 border-cyan-700">
            <h2 className="text-2xl font-bold mb-6 text-cyan-100">
              Step 3: Store & Provision Device
            </h2>

            <div className="bg-cyan-600/50 p-4 rounded-lg mb-4">
              <p className="text-cyan-100 text-sm">
                This will:
              </p>
              <ul className="list-disc list-inside text-cyan-100 text-sm mt-2 space-y-1">
                <li>Save credentials to Supabase database</li>
                <li>Provision ESP32 hardware token via bridge</li>
                <li>Store TOTP secret in ESP32 EEPROM</li>
                <li>Enable hardware-based authentication</li>
              </ul>
            </div>

            <button
              onClick={handleStore}
              disabled={loading || !deviceStatus?.connected || !deviceStatus?.eeprom_available}
              className="w-full bg-cyan-200/80 p-4 rounded-xl text-cyan-900 hover:bg-cyan-900 hover:text-cyan-200/80 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
            >
              {loading
                ? "Storing..."
                : !deviceStatus?.connected
                ? "⚠️ Device Not Connected"
                : !deviceStatus?.eeprom_available
                ? "⚠️ EEPROM Not Available"
                : "💾 Store & Provision Device"}
            </button>

            {!deviceStatus?.connected && (
              <p className="text-red-200 text-sm mt-2 text-center">
                Please connect your hardware token and ensure bridge is running
              </p>
            )}
            {!deviceStatus?.eeprom_available && deviceStatus?.connected && (
              <p className="text-yellow-200 text-sm mt-2 text-center">
                EEPROM module not detected. Please check wiring.
              </p>
            )}
          </div>
        )}

        {/* Status Message */}
        {setupStatus && (
          <div
            className={`p-6 rounded-xl text-center font-semibold text-lg ${
              setupStatus.success
                ? "bg-green-200 text-green-800"
                : "bg-red-200 text-red-800"
            }`}
          >
            {setupStatus.message}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-cyan-100 rounded-xl border-2 border-cyan-300">
        <h3 className="font-bold text-lg mb-3">📝 Setup Instructions:</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Ensure hardware token is connected and EEPROM is detected</li>
          <li>Enter your desired User ID (min 3 characters) and Password</li>
          <li>Click Generate to create password hash and TOTP secret</li>
          <li>Review the generated credentials (optionally scan QR code for testing)</li>
          <li>Click Store & Provision to save to database and ESP32 EEPROM</li>
          <li>Navigate to Verify page to test authentication</li>
        </ol>
        <div className="mt-4 p-3 bg-blue-100 border border-blue-400 rounded text-xs">
          <strong>🔐 Security Note:</strong> The TOTP secret is stored encrypted in both
          the database and ESP32 EEPROM. Each OTP is time-based (30s window) and can only
          be used once.
        </div>
      </div>
    </div>
  );
};

export default SetupPage;