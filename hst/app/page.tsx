import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto min-h-screen pb-10">
      {/* Header */}
      <div className="flex justify-center items-center p-10 text-3xl font-semibold font-mono bg-gradient-to-r from-cyan-200 to-blue-200 border-2 border-cyan-500 rounded-b-2xl hover:shadow-lg hover:shadow-cyan-400 transition duration-300">
        <div className="text-center">
          <div className="text-4xl mb-2">🔐</div>
          <div>Hardware Secure Tokeniser</div>
          <div className="text-sm font-normal text-gray-600 mt-2">
            RFC 6238 TOTP | Hardware-Based Authentication
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="mt-16 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className="group bg-gradient-to-br from-blue-500 to-blue-600 text-white p-8 rounded-2xl hover:from-blue-600 hover:to-blue-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition">📊</div>
            <div className="text-2xl font-bold mb-2">Dashboard</div>
            <div className="text-sm opacity-90">
              System overview & device status monitoring
            </div>
          </Link>

          {/* Setup */}
          <Link
            href="/setup"
            className="group bg-gradient-to-br from-cyan-500 to-cyan-600 text-white p-8 rounded-2xl hover:from-cyan-600 hover:to-cyan-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition">🔐</div>
            <div className="text-2xl font-bold mb-2">Setup</div>
            <div className="text-sm opacity-90">
              Create credentials & provision device
            </div>
          </Link>

          {/* Verify */}
          <Link
            href="/verify"
            className="group bg-gradient-to-br from-green-500 to-green-600 text-white p-8 rounded-2xl hover:from-green-600 hover:to-green-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition">✓</div>
            <div className="text-2xl font-bold mb-2">Verify</div>
            <div className="text-sm opacity-90">
              Authenticate with hardware OTP
            </div>
          </Link>

          {/* Tamper */}
          <Link
            href="/tamper"
            className="group bg-gradient-to-br from-red-500 to-red-600 text-white p-8 rounded-2xl hover:from-red-600 hover:to-red-700 transition duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1 border-4 border-red-700"
          >
            <div className="text-5xl mb-4 group-hover:scale-110 transition">🛡️</div>
            <div className="text-2xl font-bold mb-2">Tamper</div>
            <div className="text-sm opacity-90">
              Security monitoring & device reset
            </div>
          </Link>
        </div>
      </div>

      {/* System Features */}
      <div className="mt-16 px-4 max-w-5xl mx-auto">
        <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-3xl p-8 border-4 border-cyan-500 shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-8 text-gray-800">
            🌟 System Features
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-bold text-lg mb-2">Hardware TOTP</h3>
              <p className="text-sm text-gray-600">
                RFC 6238 compliant time-based OTP generation using ESP32 hardware
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">💾</div>
              <h3 className="font-bold text-lg mb-2">EEPROM Storage</h3>
              <p className="text-sm text-gray-600">
                Secrets stored in external AT24C256 EEPROM (32KB persistent memory)
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">🛡️</div>
              <h3 className="font-bold text-lg mb-2">Tamper Detection</h3>
              <p className="text-sm text-gray-600">
                Physical switch monitors case integrity with automatic lockout
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">⏰</div>
              <h3 className="font-bold text-lg mb-2">Time Sync</h3>
              <p className="text-sm text-gray-600">
                Automatic time synchronization ensures TOTP accuracy
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">🔐</div>
              <h3 className="font-bold text-lg mb-2">Single-Use OTP</h3>
              <p className="text-sm text-gray-600">
                Each OTP can only be used once, prevents replay attacks
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-white p-6 rounded-xl shadow hover:shadow-lg transition">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="font-bold text-lg mb-2">Audit Logging</h3>
              <p className="text-sm text-gray-600">
                Complete authentication logs stored in Supabase database
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Specs */}
      <div className="mt-10 px-4 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl p-8 border-2 border-cyan-300 shadow-lg">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
            📡 Technical Specifications
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-3 text-cyan-700">Hardware</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>ESP32 DevKit (240MHz, WiFi + BT)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>AT24C256 I2C EEPROM (32KB)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>NC Tamper Switch (GPIO 19)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Push Button (GPIO 23)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>USB Serial Communication</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3 text-cyan-700">Software Stack</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Next.js 15 + TypeScript</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Supabase PostgreSQL Database</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Python Flask Bridge Server</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>HMAC-SHA1 TOTP (RFC 6238)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Deployed on Vercel</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3 text-cyan-700">Security Features</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Time-based OTP (30s window)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>PBKDF2 Password Hashing</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>OTP Replay Attack Prevention</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Physical Tamper Detection</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-2">✓</span>
                  <span>Audit Trail Logging</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-lg mb-3 text-cyan-700">Specifications</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>OTP Validity: 90 seconds</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Time Step: 30 seconds</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>OTP Length: 6 digits</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Secret Size: 160 bits (20 bytes)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Bridge Port: 5000 (localhost)</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="mt-10 px-4 max-w-5xl mx-auto">
        <div className="bg-blue-50 rounded-2xl p-8 border-2 border-blue-300">
          <h2 className="text-2xl font-bold text-center mb-6 text-gray-800">
            🚀 Quick Start Guide
          </h2>

          <div className="space-y-4 text-sm max-w-2xl mx-auto">
            <div className="flex items-start">
              <span className="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                1
              </span>
              <div>
                <strong>Connect Hardware:</strong> Plug in your ESP32 with EEPROM and tamper switch via USB
              </div>
            </div>

            <div className="flex items-start">
              <span className="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                2
              </span>
              <div>
                <strong>Start Bridge:</strong> Run <code className="bg-gray-200 px-2 py-1 rounded">python bridge.py</code> on your local machine
              </div>
            </div>

            <div className="flex items-start">
              <span className="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                3
              </span>
              <div>
                <strong>Setup Credentials:</strong> Navigate to Setup page and create your user account
              </div>
            </div>

            <div className="flex items-start">
              <span className="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-4 flex-shrink-0">
                4
              </span>
              <div>
                <strong>Authenticate:</strong> Go to Verify page, press button on device, and login!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-16 text-center text-sm text-gray-600 pb-6">
        <p>Hardware Secure Tokeniser v4.0</p>
        <p className="mt-2">
          Open Source | RFC 6238 Compliant | MIT License
        </p>
      </div>
    </div>
  );
}