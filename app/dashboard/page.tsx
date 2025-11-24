"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";

interface FullDeviceStatus {
  device: {
    port: string;
    baud: number;
    connected_at: string;
  } | null;
  connected: boolean;
  status: string;
  provisioned: boolean;
  eeprom_available: boolean;
  time_sync: boolean;
  user_id: string | null;
  tamper: {
    detected: boolean;
    locked: boolean;
    count: number;
    timestamp: string | null;
  };
  otp_available: boolean;
  otp_consumed: boolean;
}

const DashboardPage = () => {
  const [deviceStatus, setDeviceStatus] = useState<FullDeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/bridge/status");
      if (res.ok) {
        const data = await res.json();
        setDeviceStatus(data);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    } finally {
      setLoading(false);
    }
  };

  const getOverallHealthStatus = () => {
    if (!deviceStatus?.connected) return { status: "critical", label: "Disconnected", color: "bg-red-500" };
    if (deviceStatus.tamper.locked) return { status: "critical", label: "Tampered", color: "bg-red-500" };
    if (!deviceStatus.provisioned) return { status: "warning", label: "Not Provisioned", color: "bg-yellow-500" };
    if (!deviceStatus.time_sync) return { status: "warning", label: "No Time Sync", color: "bg-yellow-500" };
    if (!deviceStatus.eeprom_available) return { status: "warning", label: "EEPROM Issue", color: "bg-yellow-500" };
    return { status: "healthy", label: "Operational", color: "bg-green-500" };
  };

  const health = getOverallHealthStatus();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto min-h-screen flex items-center justify-center">
        <div className="text-2xl font-semibold">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto min-h-screen pb-10">
      {/* Header */}
      <div className="flex justify-between items-center p-10 text-3xl font-semibold font-mono bg-cyan-200 border-2 border-cyan-500 rounded-b-2xl hover:shadow-lg hover:shadow-cyan-400 transition duration-300">
        <Link href="/" className="text-base hover:underline">
          ← Home
        </Link>
        <span>Dashboard | HST</span>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`text-sm px-4 py-2 rounded ${
            autoRefresh ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
          }`}
        >
          {autoRefresh ? "🔄 Auto" : "⏸️ Paused"}
        </button>
      </div>

      {/* Overall Health Status */}
      <div className="mt-10 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 border-4 border-cyan-500">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">System Health</h2>
              <p className="text-gray-600 text-sm mt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
              </p>
            </div>
            <div className={`${health.color} text-white px-8 py-4 rounded-xl text-2xl font-bold shadow-lg`}>
              {health.label}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="mt-6 px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Connection Status */}
        <div className="bg-white rounded-xl shadow p-6 border-2 border-cyan-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">Connection</h3>
            <span className="text-2xl">
              {deviceStatus?.connected ? "✓" : "✗"}
            </span>
          </div>
          <div className={`text-2xl font-bold ${deviceStatus?.connected ? "text-green-600" : "text-red-600"}`}>
            {deviceStatus?.connected ? "Connected" : "Disconnected"}
          </div>
          {deviceStatus?.device && (
            <div className="text-xs text-gray-500 mt-2">
              Port: {deviceStatus.device.port}
            </div>
          )}
        </div>

        {/* Provisioned Status */}
        <div className="bg-white rounded-xl shadow p-6 border-2 border-cyan-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">Provisioned</h3>
            <span className="text-2xl">
              {deviceStatus?.provisioned ? "✓" : "✗"}
            </span>
          </div>
          <div className={`text-2xl font-bold ${deviceStatus?.provisioned ? "text-green-600" : "text-yellow-600"}`}>
            {deviceStatus?.provisioned ? "Yes" : "No"}
          </div>
          {deviceStatus?.user_id && (
            <div className="text-xs text-gray-500 mt-2">
              User: {deviceStatus.user_id}
            </div>
          )}
        </div>

        {/* EEPROM Status */}
        <div className="bg-white rounded-xl shadow p-6 border-2 border-cyan-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">EEPROM</h3>
            <span className="text-2xl">💾</span>
          </div>
          <div className={`text-2xl font-bold ${deviceStatus?.eeprom_available ? "text-green-600" : "text-red-600"}`}>
            {deviceStatus?.eeprom_available ? "Available" : "Not Found"}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            AT24C256 (32KB)
          </div>
        </div>

        {/* Time Sync Status */}
        <div className="bg-white rounded-xl shadow p-6 border-2 border-cyan-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-700">Time Sync</h3>
            <span className="text-2xl">⏰</span>
          </div>
          <div className={`text-2xl font-bold ${deviceStatus?.time_sync ? "text-green-600" : "text-yellow-600"}`}>
            {deviceStatus?.time_sync ? "Synced" : "Not Synced"}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            RFC 6238 TOTP
          </div>
        </div>
      </div>

      {/* Device Details */}
      <div className="mt-6 px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-cyan-300">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Device Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Device Status</div>
              <div className="font-bold text-lg">{deviceStatus?.status || "Unknown"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Connection Port</div>
              <div className="font-bold text-lg">{deviceStatus?.device?.port || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Baud Rate</div>
              <div className="font-bold text-lg">{deviceStatus?.device?.baud || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Connected Since</div>
              <div className="font-bold text-sm">
                {deviceStatus?.device?.connected_at 
                  ? new Date(deviceStatus.device.connected_at).toLocaleString()
                  : "N/A"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">User ID</div>
              <div className="font-bold text-lg">{deviceStatus?.user_id || "Not provisioned"}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">OTP Status</div>
              <div className="font-bold text-lg">
                {deviceStatus?.otp_available ? (
                  <span className="text-green-600">
                    Available {deviceStatus.otp_consumed && "(Consumed)"}
                  </span>
                ) : (
                  <span className="text-gray-400">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tamper Status */}
      <div className="mt-6 px-4">
        <div className={`rounded-xl shadow-lg p-6 border-4 ${
          deviceStatus?.tamper.locked 
            ? "bg-red-100 border-red-500" 
            : deviceStatus?.tamper.detected
            ? "bg-yellow-100 border-yellow-500"
            : "bg-green-100 border-green-500"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">Security Status</h3>
            <Link
              href="/tamper"
              className="bg-cyan-700 text-white px-4 py-2 rounded-lg hover:bg-cyan-800 transition"
            >
              Manage →
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Tamper Detected</div>
              <div className="font-bold text-2xl">
                {deviceStatus?.tamper.detected ? "⚠️ YES" : "✓ NO"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Device Locked</div>
              <div className="font-bold text-2xl">
                {deviceStatus?.tamper.locked ? "🔒 YES" : "✓ NO"}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Tamper Count</div>
              <div className="font-bold text-2xl">{deviceStatus?.tamper.count || 0}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Last Event</div>
              <div className="font-bold text-sm">
                {deviceStatus?.tamper.timestamp 
                  ? new Date(deviceStatus.tamper.timestamp).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>

          {deviceStatus?.tamper.locked && (
            <div className="mt-4 p-4 bg-red-200 rounded-lg border-2 border-red-400">
              <p className="font-semibold text-red-800">
                ⚠️ Device is currently locked due to tamper detection. 
                Please visit the Tamper Management page to reset.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 px-4">
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-cyan-300">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/setup"
              className="bg-cyan-600 text-white p-4 rounded-xl hover:bg-cyan-700 transition text-center font-semibold"
            >
              🔐 Setup
            </Link>
            <Link
              href="/verify"
              className="bg-cyan-600 text-white p-4 rounded-xl hover:bg-cyan-700 transition text-center font-semibold"
            >
              ✓ Verify
            </Link>
            <Link
              href="/tamper"
              className="bg-red-600 text-white p-4 rounded-xl hover:bg-red-700 transition text-center font-semibold"
            >
              🛡️ Tamper
            </Link>
            <button
              onClick={fetchStatus}
              className="bg-gray-600 text-white p-4 rounded-xl hover:bg-gray-700 transition text-center font-semibold"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* System Requirements */}
      <div className="mt-6 px-4">
        <div className="bg-cyan-50 rounded-xl p-6 border-2 border-cyan-300">
          <h3 className="text-lg font-bold mb-3">📋 System Requirements Checklist</h3>
          <div className="space-y-2 text-sm">
            <div className={deviceStatus?.connected ? "text-green-600" : "text-red-600"}>
              {deviceStatus?.connected ? "✓" : "✗"} Hardware token connected via USB
            </div>
            <div className={deviceStatus?.eeprom_available ? "text-green-600" : "text-yellow-600"}>
              {deviceStatus?.eeprom_available ? "✓" : "⚠️"} External EEPROM (AT24C256) detected
            </div>
            <div className={deviceStatus?.time_sync ? "text-green-600" : "text-yellow-600"}>
              {deviceStatus?.time_sync ? "✓" : "⚠️"} Time synchronized with server
            </div>
            <div className={deviceStatus?.provisioned ? "text-green-600" : "text-yellow-600"}>
              {deviceStatus?.provisioned ? "✓" : "⚠️"} Device provisioned with TOTP secret
            </div>
            <div className={!deviceStatus?.tamper.locked ? "text-green-600" : "text-red-600"}>
              {!deviceStatus?.tamper.locked ? "✓" : "✗"} No tamper lockout active
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;