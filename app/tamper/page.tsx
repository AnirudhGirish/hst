"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

interface TamperStatus {
  detected: boolean;
  locked: boolean;
  count: number;
  timestamp: string | null;
}

interface DeviceStatus {
  connected: boolean;
  status: string;
  tamper: TamperStatus;
}

const TamperManagementPage = () => {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [adminPin, setAdminPin] = useState("");
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPinInput, setShowPinInput] = useState(false);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bridge/status");
      if (res.ok) {
        const data = await res.json();
        setDeviceStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    setResult(null);

    try {
      // Send reset command to bridge
      const res = await fetch("/api/bridge/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: adminPin }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          success: true,
          message: "✓ Device unlocked successfully!",
        });
        setAdminPin("");
        setShowPinInput(false);

        // Log tamper reset event
        try {
          await fetch("/api/tamper/log", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventType: "RESET",
              tamperCount: deviceStatus?.tamper.count,
              userId: "admin",
              details: { method: "admin_pin" },
            }),
          });
        } catch (logError) {
          console.error("Failed to log event:", logError);
        }

        // Refresh status
        setTimeout(fetchStatus, 1000);
      } else {
        setResult({
          success: false,
          message: data.error || "Invalid PIN or reset failed",
        });
      }
    } catch (error) {
      console.error("Reset error:", error);
      setResult({
        success: false,
        message: "Failed to connect to device",
      });
    } finally {
      setResetting(false);
    }
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getTamperStatusColor = () => {
    if (!deviceStatus) return "bg-gray-100 border-gray-500";
    if (deviceStatus.tamper.locked) return "bg-red-100 border-red-500";
    if (deviceStatus.tamper.detected) return "bg-yellow-100 border-yellow-500";
    return "bg-green-100 border-green-500";
  };

  const getTamperStatusIcon = () => {
    if (!deviceStatus) return "❓";
    if (deviceStatus.tamper.locked) return "🔒";
    if (deviceStatus.tamper.detected) return "⚠️";
    return "✅";
  };

  const getTamperStatusText = () => {
    if (!deviceStatus) return "Unknown";
    if (deviceStatus.tamper.locked) return "DEVICE LOCKED";
    if (deviceStatus.tamper.detected) return "TAMPER DETECTED";
    return "DEVICE SECURE";
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto min-h-screen flex items-center justify-center">
        <div className="text-2xl font-semibold">Loading tamper status...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto min-h-screen pb-10">
      {/* Header */}
      <div className="flex justify-between items-center p-10 text-3xl font-semibold font-mono bg-cyan-200 border-2 border-cyan-500 rounded-b-2xl hover:shadow-lg hover:shadow-cyan-400 transition duration-300">
        <Link href="/" className="text-base hover:underline">
          ← Home
        </Link>
        <span>Tamper Protection | HST</span>
        <div className="w-20"></div>
      </div>

      {/* Device Connection Status */}
      {!deviceStatus?.connected && (
        <div className="max-w-3xl mx-auto mt-10 bg-red-100 border-2 border-red-500 rounded-xl p-6">
          <div className="text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-xl font-bold text-red-800 mb-2">
              Device Not Connected
            </div>
            <p className="text-red-700">
              Please connect your hardware token and ensure the bridge server is running.
            </p>
          </div>
        </div>
      )}

      {/* Tamper Status Card */}
      <div className="max-w-3xl mx-auto mt-10">
        <div className={`p-8 rounded-2xl border-4 ${getTamperStatusColor()}`}>
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">{getTamperStatusIcon()}</div>
            <h2 className="text-3xl font-bold">{getTamperStatusText()}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Device Status</div>
              <div className="font-bold text-lg">
                {deviceStatus?.tamper.locked ? "🔒 LOCKED" : "✓ OPERATIONAL"}
              </div>
            </div>

            <div className="bg-white/50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Tamper Events</div>
              <div className="font-bold text-lg">{deviceStatus?.tamper.count || 0}</div>
            </div>

            <div className="bg-white/50 p-4 rounded-lg col-span-2">
              <div className="text-sm text-gray-600 mb-1">Last Tamper Event</div>
              <div className="font-bold">
                {formatTimestamp(deviceStatus?.tamper.timestamp || null)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Reset Section */}
      {deviceStatus?.tamper.locked && (
        <div className="max-w-3xl mx-auto mt-10">
          <div className="bg-cyan-500/75 p-10 rounded-3xl border-8 border-cyan-700">
            <h2 className="text-2xl font-bold mb-6 text-center text-cyan-100">
              Admin Reset Required
            </h2>

            {!showPinInput ? (
              <div className="text-center">
                <p className="text-cyan-100 mb-6">
                  The device has been locked due to tamper detection. 
                  An administrator must unlock it using the admin PIN.
                </p>
                <button
                  onClick={() => setShowPinInput(true)}
                  className="bg-cyan-200 px-8 py-4 rounded-xl text-cyan-900 hover:bg-cyan-900 hover:text-cyan-200 transition duration-300 font-bold text-xl"
                >
                  🔓 Unlock Device
                </button>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-6">
                <div>
                  <label
                    htmlFor="adminPin"
                    className="block text-lg font-semibold mb-2 text-cyan-100"
                  >
                    Admin PIN
                  </label>
                  <input
                    id="adminPin"
                    type="password"
                    placeholder="Enter 6-digit admin PIN"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    maxLength={6}
                    className="w-full bg-cyan-200 px-4 py-3 outline-none focus:ring-2 focus:ring-cyan-800 placeholder:text-neutral-500 text-cyan-900 font-semibold rounded text-center text-2xl tracking-widest"
                  />
                  <p className="text-cyan-100 text-sm mt-2">
                    Default PIN: 123456 (change in production!)
                  </p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={resetting || adminPin.length !== 6}
                    className="flex-1 bg-cyan-200 p-4 rounded-xl text-cyan-900 hover:bg-cyan-900 hover:text-cyan-200 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xl"
                  >
                    {resetting ? "Resetting..." : "🔓 Unlock Device"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinInput(false);
                      setAdminPin("");
                      setResult(null);
                    }}
                    className="bg-gray-500 text-white px-6 py-4 rounded-xl hover:bg-gray-600 transition duration-300 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {result && (
              <div
                className={`mt-6 p-4 rounded-xl text-center font-semibold ${
                  result.success
                    ? "bg-green-200 text-green-800"
                    : "bg-red-200 text-red-800"
                }`}
              >
                {result.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tamper Detection Info */}
      <div className="max-w-3xl mx-auto mt-10 p-6 bg-cyan-100 rounded-xl border-2 border-cyan-300">
        <h3 className="font-bold text-lg mb-3">🛡️ Tamper Protection System:</h3>
        <div className="text-sm space-y-2">
          <p>
            <strong>Physical Security:</strong> The tamper switch detects when the device 
            enclosure is opened or physically compromised.
          </p>
          <p>
            <strong>Automatic Lockout:</strong> When tampering is detected, the device 
            immediately locks and stops generating OTPs until reset by an administrator.
          </p>
          <p>
            <strong>Persistent State:</strong> Tamper state is stored in both internal 
            EEPROM and the database, surviving power cycles.
          </p>
          <p>
            <strong>Audit Trail:</strong> All tamper events and reset actions are logged 
            to the database for security auditing.
          </p>
          <p>
            <strong>Admin Reset:</strong> Only authorized administrators with the correct 
            PIN can unlock the device after tamper detection.
          </p>
        </div>

        {!deviceStatus?.tamper.locked && (
          <div className="mt-4 p-3 bg-green-100 border border-green-400 rounded text-xs">
            <strong>✓ Device Secure:</strong> No tampering detected. The device is 
            operating normally and ready to generate OTPs.
          </div>
        )}

        {deviceStatus?.tamper.locked && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 rounded text-xs">
            <strong>⚠️ Security Alert:</strong> Device has been physically compromised. 
            Contact your security administrator immediately.
          </div>
        )}
      </div>

      {/* Hardware Setup Info */}
      <div className="max-w-3xl mx-auto mt-6 p-6 bg-blue-50 rounded-xl border-2 border-blue-300">
        <h3 className="font-bold text-lg mb-3">🔧 Hardware Configuration:</h3>
        <div className="text-sm space-y-2">
          <div>
            <strong>Tamper Switch:</strong> NC (Normally Closed) connected to GPIO 19
          </div>
          <div>
            <strong>Detection Method:</strong> Circuit break on case opening
          </div>
          <div>
            <strong>Debounce Time:</strong> 500ms to prevent false positives
          </div>
          <div>
            <strong>Response Time:</strong> Instant lockout upon detection
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="max-w-3xl mx-auto mt-6 flex gap-4 justify-center">
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-cyan-700 text-cyan-200 rounded-xl hover:bg-cyan-800 transition duration-300 font-semibold"
        >
          📊 Dashboard
        </Link>
        <Link
          href="/verify"
          className="px-6 py-3 bg-cyan-700 text-cyan-200 rounded-xl hover:bg-cyan-800 transition duration-300 font-semibold"
        >
          ✓ Verify
        </Link>
        <button
          onClick={fetchStatus}
          className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition duration-300 font-semibold"
        >
          🔄 Refresh
        </button>
      </div>
    </div>
  );
};

export default TamperManagementPage;