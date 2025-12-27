<p align="center">
  <img src="https://img.shields.io/badge/ESP32-Hardware%20Token-00979D?style=for-the-badge&logo=espressif&logoColor=white" alt="ESP32"/>
  <img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase"/>
  <img src="https://img.shields.io/badge/Python-Flask-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Flask"/>
  <img src="https://img.shields.io/badge/RFC%206238-TOTP-blue?style=for-the-badge" alt="RFC 6238"/>
</p>

<h1 align="center">Hardware Secure Tokeniser (HST)</h1>

<p align="center">
  <strong>Enterprise-Grade Hardware-Based TOTP Authentication System</strong><br/>
  A comprehensive two-factor authentication solution utilizing ESP32 microcontroller<br/>
  with physical tamper detection and cryptographic OTP generation
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#system-architecture">Architecture</a> •
  <a href="#installation-guide">Installation</a> •
  <a href="#hardware-configuration">Hardware</a> •
  <a href="#api-documentation">API</a> •
  <a href="#security-implementation">Security</a>
</p>

---

## Overview

The Hardware Secure Tokeniser (HST) is a complete authentication system that implements RFC 6238 Time-Based One-Time Password (TOTP) generation using dedicated hardware. Unlike software-based authenticators, HST stores cryptographic secrets in physically isolated hardware with tamper detection capabilities, providing enhanced security for high-assurance environments.

### Key Capabilities

| Capability | Implementation Details |
|------------|------------------------|
| **Hardware TOTP Generation** | RFC 6238 compliant implementation using HMAC-SHA1 algorithm executed on ESP32 microcontroller |
| **Physical Tamper Detection** | Normally-closed switch circuit monitors enclosure integrity with automatic cryptographic lockout |
| **Secure Secret Storage** | TOTP secrets stored in external AT24C256 I2C EEPROM (32KB), isolated from main processor memory |
| **Single-Use Enforcement** | Server-side OTP consumption tracking prevents replay attacks across authentication sessions |
| **Time Synchronization** | Automatic Unix timestamp synchronization between server and hardware ensures TOTP accuracy |
| **Comprehensive Audit Trail** | All authentication attempts, tamper events, and administrative actions logged to PostgreSQL |
| **Real-Time Monitoring** | Next.js 15 web dashboard provides live device status, health metrics, and administrative controls |

### Use Cases

- **Enterprise Authentication**: Secure access to internal systems requiring hardware-backed 2FA
- **Financial Applications**: Transaction signing and authorization with physical security requirements
- **Industrial Control Systems**: Access control for critical infrastructure with tamper evidence
- **Research and Development**: Reference implementation for hardware security token development
- **Educational Purposes**: Demonstration of embedded security concepts and cryptographic protocols

---

## System Architecture

The HST system consists of four primary components that work together to provide secure authentication:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            WEB APPLICATION LAYER                             │
│                         Next.js 15 + TypeScript + React 19                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Dashboard  │  │    Setup    │  │   Verify    │  │  Tamper Management  │  │
│  │  (Status)   │  │(Provisioning│  │(Auth Flow)  │  │  (Security Admin)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API ROUTE LAYER                                 │
│                    /api/auth/*  •  /api/bridge/*  •  /api/tamper/*          │
│                                                                              │
│   Authentication Endpoints:        Bridge Proxy Endpoints:                   │
│   - POST /api/auth/setup          - GET  /api/bridge/status                 │
│   - POST /api/auth/store          - GET  /api/bridge/otp                    │
│   - POST /api/auth/verify         - POST /api/bridge/provision              │
│                                   - POST /api/bridge/reset                   │
└─────────────────────────────────────────────────────────────────────────────┘
                    │                                         │
                    ▼                                         ▼
┌───────────────────────────────┐       ┌─────────────────────────────────────┐
│   SUPABASE POSTGRESQL DATABASE │       │     PYTHON FLASK BRIDGE SERVER      │
│                               │       │        (Serial-to-HTTP Gateway)      │
│   Tables:                     │       │                                      │
│   ┌─────────────────────────┐ │       │   Responsibilities:                  │
│   │ users                   │ │       │   - USB serial communication         │
│   │ - user_id (unique)      │ │       │   - Device state management          │
│   │ - password_hash (PBKDF2)│ │       │   - OTP caching and lifecycle        │
│   │ - totp_secret (hex)     │ │       │   - Time synchronization             │
│   │ - created_at, last_login│ │       │   - Tamper event handling            │
│   └─────────────────────────┘ │       │                                      │
│   ┌─────────────────────────┐ │       │   Endpoints:                         │
│   │ auth_logs               │ │       │   - GET  /health, /device, /status   │
│   │ - success/failure       │ │       │   - GET  /otp, /tamper               │
│   │ - ip_address, user_agent│ │       │   - POST /provision, /reset          │
│   │ - time_delta            │ │       │   - POST /flush, /sync_time          │
│   └─────────────────────────┘ │       │                                      │
│   ┌─────────────────────────┐ │       └──────────────┬──────────────────────┘
│   │ otp_consumed            │ │                      │
│   │ - time_step tracking    │ │                      │ USB Serial (115200 baud)
│   │ - replay prevention     │ │                      │
│   └─────────────────────────┘ │                      ▼
│   ┌─────────────────────────┐ │       ┌─────────────────────────────────────┐
│   │ tamper_events           │ │       │      ESP32 HARDWARE TOKEN            │
│   │ - event_type, count     │ │       │         (Firmware v5.3)              │
│   │ - device_id, details    │ │       │                                      │
│   └─────────────────────────┘ │       │   Components:                        │
└───────────────────────────────┘       │   - ESP32 DevKit (240MHz, 520KB RAM) │
                                        │   - AT24C256 I2C EEPROM (32KB)       │
                                        │   - NC Tamper Switch (GPIO 19)       │
                                        │   - OTP Generation Button (GPIO 23)  │
                                        │   - Status LEDs (GPIO 2, 4, 5, 18)   │
                                        │                                      │
                                        │   Cryptographic Operations:          │
                                        │   - HMAC-SHA1 (mbedTLS library)      │
                                        │   - 160-bit secret storage           │
                                        │   - 30-second time step calculation  │
                                        └─────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Registration**: Web interface generates TOTP secret, stores hash in database, provisions ESP32 via bridge
2. **OTP Generation**: Physical button press triggers HMAC-SHA1 computation on ESP32, result sent via serial
3. **Authentication**: User submits OTP through web interface, server validates against computed value
4. **Tamper Response**: Physical switch breach triggers immediate lockout, event logged to database
5. **Administrative Reset**: Authorized personnel can unlock device using 6-digit PIN via web interface

---

## Installation Guide

### System Requirements

| Component | Minimum Requirement |
|-----------|---------------------|
| Operating System | macOS 10.15+, Windows 10+, Ubuntu 20.04+ |
| Node.js | v18.0.0 or higher |
| Python | v3.8.0 or higher |
| Arduino IDE | v2.0.0 or higher |
| USB Port | USB 2.0 or higher for ESP32 connection |
| Database | Supabase account (free tier sufficient) |

### Prerequisites

Before beginning installation, ensure the following software is installed:

```bash
# Verify Node.js installation
node --version  # Should output v18.x.x or higher

# Verify Python installation
python3 --version  # Should output Python 3.8.x or higher

# Verify pip installation
pip3 --version
```

---

### Step 1: Repository Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/HST.git
cd HST

# Verify directory structure
ls -la
# Expected: HST.ino, bridge/, hst/, README.md, .gitignore
```

---

### Step 2: ESP32 Firmware Installation

The ESP32 firmware handles all cryptographic operations and hardware interfacing.

#### 2.1 Arduino IDE Configuration

1. Download and install [Arduino IDE 2.0+](https://www.arduino.cc/en/software)

2. Configure ESP32 board support:
   - Navigate to **File** → **Preferences**
   - Add the following URL to "Additional Board Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Click **OK** to save

3. Install ESP32 board package:
   - Navigate to **Tools** → **Board** → **Boards Manager**
   - Search for "ESP32"
   - Install **esp32 by Espressif Systems** (version 2.0.0 or higher)

#### 2.2 Driver Installation

Depending on your ESP32 board variant, install the appropriate USB-to-Serial driver:

| Chip | Driver Download |
|------|-----------------|
| CP2102 | [Silicon Labs CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) |
| CH340 | [WCH CH340](http://www.wch-ic.com/downloads/CH341SER_ZIP.html) |

#### 2.3 Firmware Upload

1. Connect ESP32 to computer via USB cable (ensure data-capable cable)

2. Open `HST.ino` in Arduino IDE

3. Configure board settings:
   - **Tools** → **Board** → **ESP32 Dev Module**
   - **Tools** → **Port** → Select appropriate COM/tty port
   - **Tools** → **Upload Speed** → 921600

4. Click **Upload** button (right arrow icon)

5. Wait for compilation and upload to complete (approximately 60 seconds)

#### 2.4 Firmware Verification

Open Serial Monitor (**Tools** → **Serial Monitor**) at 115200 baud:

```
[BOOT] Starting HST v5.3...
[I2C] Initialized at 100kHz
[I2C] Scanning for EEPROM at 0x50...
[I2C] Attempt 1/5: EEPROM FOUND!
===========================================
Hardware Secure Tokeniser v5.3
===========================================
EEPROM:DETECTED
TIME_SYNC:NO
STATUS:READY
PROVISIONED:NO
TAMPER_COUNT:0
Ready. Press button to generate TOTP.
```

**Note**: Close Serial Monitor before proceeding to bridge server setup, as both cannot access the serial port simultaneously.

---

### Step 3: Python Bridge Server Installation

The bridge server provides HTTP-to-Serial translation, enabling the web application to communicate with the hardware token.

#### 3.1 Virtual Environment Setup

```bash
# Navigate to bridge directory
cd bridge

# Create Python virtual environment
python3 -m venv env

# Activate virtual environment
# macOS/Linux:
source env/bin/activate

# Windows (Command Prompt):
env\Scripts\activate.bat

# Windows (PowerShell):
env\Scripts\Activate.ps1
```

#### 3.2 Dependency Installation

```bash
# Install required packages
pip install -r requirements.txt

# Alternatively, install packages individually:
pip install flask==3.0.0 flask-cors==4.0.0 pyserial==3.5
```

#### 3.3 Bridge Server Execution

```bash
# Navigate to server directory
cd pyconnect

# Start the bridge server
python main.py
```

Expected output:

```
============================================================
Hardware Secure Tokeniser - Bridge Server v5.2
============================================================
[+] Serial reader thread started
[+] Starting HTTP server on http://127.0.0.1:5000
[+] Available endpoints:
    GET  /health       - Health check
    GET  /device       - Device info
    GET  /status       - Full device status
    GET  /otp          - Get OTP
    POST /flush        - Clear OTP cache
    GET  /tamper       - Tamper status
    POST /reset        - Reset device
    POST /provision    - Provision device
    POST /sync_time    - Sync time
============================================================
[+] Connecting to /dev/cu.usbserial-XXXXX...
[+] Connected to /dev/cu.usbserial-XXXXX
[->] Time sync sent: 1735333161
```

#### 3.4 Bridge Server Verification

```bash
# Test health endpoint
curl http://127.0.0.1:5000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "hardware-token-bridge",
  "version": "5.2",
  "timestamp": "2024-12-28T12:00:00.000000"
}
```

---

### Step 4: Next.js Web Application Installation

#### 4.1 Dependency Installation

```bash
# Navigate to web application directory
cd hst

# Install Node.js dependencies
npm install
```

#### 4.2 Environment Configuration

Create `.env.local` in the `hst` directory:

```env
# Supabase Database Configuration
# Obtain these values from your Supabase project dashboard
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Bridge Server Configuration
NEXT_PUBLIC_BRIDGE_URL=http://127.0.0.1:5000
```

#### 4.3 Database Schema Creation

Execute the following SQL statements in the Supabase SQL Editor:

```sql
-- =============================================================================
-- Hardware Secure Tokeniser - Database Schema
-- =============================================================================

-- Users table: Stores authentication credentials
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  totp_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE
);

-- Authentication logs: Records all authentication attempts
CREATE TABLE IF NOT EXISTS auth_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  otp_used TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  time_delta INTEGER
);

-- Consumed OTPs: Prevents replay attacks
CREATE TABLE IF NOT EXISTS otp_consumed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  otp TEXT NOT NULL,
  time_step BIGINT NOT NULL,
  consumed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, time_step, otp)
);

-- Tamper events: Security event logging
CREATE TABLE IF NOT EXISTS tamper_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT,
  event_type TEXT NOT NULL,
  tamper_count INTEGER,
  user_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_timestamp ON auth_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_otp_consumed_lookup ON otp_consumed(user_id, time_step);
CREATE INDEX IF NOT EXISTS idx_tamper_events_timestamp ON tamper_events(timestamp DESC);
```

#### 4.4 Development Server Execution

```bash
# Start Next.js development server
npm run dev
```

Access the application at [http://localhost:3000](http://localhost:3000)

---

### Step 5: System Verification

Execute all components simultaneously using separate terminal sessions:

```bash
# Terminal 1: Bridge Server
cd /path/to/HST/bridge
source env/bin/activate
cd pyconnect
python main.py

# Terminal 2: Web Application
cd /path/to/HST/hst
npm run dev
```

Verification checklist:

| Component | Verification Method | Expected Result |
|-----------|---------------------|-----------------|
| ESP32 Firmware | Serial Monitor output | "EEPROM:DETECTED", "STATUS:READY" |
| Bridge Server | `curl localhost:5000/health` | JSON response with "status": "ok" |
| Web Application | Browser at localhost:3000 | Dashboard loads without errors |
| Database | Supabase Table Editor | All four tables visible |

---

## Hardware Configuration

### Bill of Materials

| Component | Part Number | Quantity | Supplier |
|-----------|-------------|----------|----------|
| ESP32 Development Board | ESP32-WROOM-32D DevKit | 1 | Various |
| I2C EEPROM | AT24C256 (32KB) | 1 | Various |
| Normally Closed Switch | Micro limit switch | 1 | Various |
| Momentary Push Button | 6x6mm tactile switch | 1 | Various |
| LED (Blue) | 5mm, 20mA | 1 | Various |
| LED (Yellow) | 5mm, 20mA | 1 | Various |
| LED (Green) | 5mm, 20mA | 1 | Various |
| Resistors | 330Ω, 1/4W | 3 | Various |
| Enclosure | Project box with lid | 1 | Various |

### GPIO Pin Assignments

| GPIO | Function | Configuration | Notes |
|------|----------|---------------|-------|
| 2 | Built-in LED | OUTPUT | Status feedback |
| 4 | System Ready | OUTPUT | Green LED indicator |
| 5 | EEPROM Activity | OUTPUT | Yellow LED indicator |
| 18 | OTP Active | OUTPUT | Blue LED indicator |
| 19 | Tamper Switch | INPUT_PULLUP | NC switch to GND |
| 21 | I2C SDA | I2C | EEPROM data line |
| 22 | I2C SCL | I2C | EEPROM clock line |
| 23 | OTP Button | INPUT_PULLUP | Momentary to GND |
| 25 | Status LED | OUTPUT | Additional feedback |

### Circuit Schematic

```
                                    VCC (3.3V)
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    │              ┌────┴────┐              │
                    │              │ AT24C256 │              │
                    │              │  EEPROM  │              │
                    │              │          │              │
                    │    ┌─────────┤ SDA  VCC ├──────────────┘
                    │    │         │ SCL  GND ├──────────────┐
                    │    │    ┌────┤ A0   WP  ├───┐          │
                    │    │    │ ┌──┤ A1       │   │          │
                    │    │    │ │┌─┤ A2       │   │          │
                    │    │    │ ││ └──────────┘   │          │
                    │    │    │ ││                │          │
                    │    │    └─┴┴────────────────┴──────────┤
                    │    │                                   │
                    │    │                                  GND
                    │    │
          ┌─────────┴────┴───────────────────────────────────────┐
          │                     ESP32 DevKit                      │
          │                                                       │
          │  GPIO 21 ─────────────────────────────── I2C SDA      │
          │  GPIO 22 ─────────────────────────────── I2C SCL      │
          │                                                       │
          │  GPIO 19 ─────── NC Switch ─────────────────── GND    │
          │  GPIO 23 ─────── Push Button ───────────────── GND    │
          │                                                       │
          │  GPIO 18 ─────── 330Ω ─── Blue LED ─────────── GND    │
          │  GPIO 5  ─────── 330Ω ─── Yellow LED ───────── GND    │
          │  GPIO 4  ─────── 330Ω ─── Green LED ────────── GND    │
          │                                                       │
          │  3.3V ────────────────────────────────────── VCC      │
          │  GND ─────────────────────────────────────── GND      │
          └───────────────────────────────────────────────────────┘
```

### EEPROM Address Configuration

The AT24C256 I2C address is determined by pins A0, A1, and A2:

| A0 | A1 | A2 | I2C Address |
|----|----|----|-------------|
| GND | GND | GND | 0x50 |
| VCC | GND | GND | 0x51 |
| GND | VCC | GND | 0x52 |
| VCC | VCC | GND | 0x53 |

**Default configuration**: All address pins connected to GND (address 0x50)

---

## API Documentation

### Bridge Server REST API

Base URL: `http://127.0.0.1:5000`

#### GET /health

Returns server health status.

**Response:**
```json
{
  "status": "ok",
  "service": "hardware-token-bridge",
  "version": "5.2",
  "timestamp": "2024-12-28T12:00:00.000000"
}
```

#### GET /device

Returns hardware device connection information.

**Response (Connected):**
```json
{
  "device": {
    "port": "/dev/cu.usbserial-0001",
    "baud": 115200,
    "connected_at": "2024-12-28T12:00:00.000000"
  },
  "connected": true,
  "status": "READY",
  "provisioned": true,
  "eeprom_available": true,
  "time_sync": true,
  "tamper_locked": false,
  "user_id": "user123"
}
```

#### GET /status

Returns comprehensive device status including tamper state.

**Response:**
```json
{
  "device": { ... },
  "connected": true,
  "status": "READY",
  "provisioned": true,
  "eeprom_available": true,
  "time_sync": true,
  "user_id": "user123",
  "tamper": {
    "detected": false,
    "locked": false,
    "count": 0,
    "timestamp": null
  },
  "otp_available": true,
  "otp_consumed": false
}
```

#### GET /otp

Retrieves the current OTP from hardware token.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| consume | boolean | If true, marks OTP as consumed |

**Response (Success):**
```json
{
  "otp": "123456",
  "generated_at": "2024-12-28T12:00:00.000000",
  "expires_in": 75,
  "consumed": false,
  "time_step": 57844372,
  "user_id": "user123"
}
```

**Response (No OTP):**
```json
{
  "error": "No valid OTP available",
  "message": "Press button on hardware token to generate OTP"
}
```

#### POST /provision

Provisions the hardware token with user credentials.

**Request Body:**
```json
{
  "user_id": "user123",
  "secret_hex": "48656c6c6f576f726c6431323334353637383930"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Device provisioned successfully",
  "user_id": "user123"
}
```

#### POST /reset

Resets tamper lockout with administrative PIN.

**Request Body:**
```json
{
  "pin": "123456"
}
```

**Response (Success):**
```json
{
  "message": "Device reset successful",
  "locked": false
}
```

#### POST /flush

Clears the cached OTP.

**Response:**
```json
{
  "message": "OTP cache flushed",
  "flushed_otp": "123456"
}
```

#### POST /sync_time

Triggers time synchronization with hardware token.

**Response:**
```json
{
  "message": "Time sync sent to device"
}
```

---

## Security Implementation

### Cryptographic Specifications

| Parameter | Value | Standard Reference |
|-----------|-------|-------------------|
| TOTP Algorithm | HMAC-SHA1 | RFC 6238, RFC 4226 |
| Secret Length | 160 bits (20 bytes) | RFC 4226 Section 4 |
| OTP Length | 6 digits | RFC 4226 Section 5.3 |
| Time Step | 30 seconds | RFC 6238 Section 4.1 |
| Time Window | ±1 step (90 seconds total) | RFC 6238 Section 5.2 |
| Password Hash | PBKDF2-SHA512 | RFC 8018 |
| Hash Iterations | 100,000 | OWASP Recommendation |
| Salt Length | 128 bits (16 bytes) | NIST SP 800-132 |

### Authentication Protocol

```
┌────────┐          ┌─────────────┐          ┌────────┐          ┌──────────┐
│  User  │          │   ESP32     │          │ Bridge │          │  Server  │
└───┬────┘          └──────┬──────┘          └───┬────┘          └────┬─────┘
    │                      │                     │                    │
    │  1. Press Button     │                     │                    │
    │─────────────────────>│                     │                    │
    │                      │                     │                    │
    │                      │ 2. Generate TOTP    │                    │
    │                      │ (HMAC-SHA1)         │                    │
    │                      │                     │                    │
    │                      │ 3. Send via Serial  │                    │
    │                      │────────────────────>│                    │
    │                      │                     │                    │
    │                      │                     │ 4. Cache OTP       │
    │                      │                     │                    │
    │ 5. Enter User ID     │                     │                    │
    │────────────────────────────────────────────────────────────────>│
    │                      │                     │                    │
    │ 6. Request OTP       │                     │                    │
    │────────────────────────────────────────────>                    │
    │                      │                     │                    │
    │ 7. Return OTP        │                     │                    │
    │<───────────────────────────────────────────│                    │
    │                      │                     │                    │
    │ 8. Submit (UserID + OTP)                   │                    │
    │────────────────────────────────────────────────────────────────>│
    │                      │                     │                    │
    │                      │                     │    9. Retrieve     │
    │                      │                     │    stored secret   │
    │                      │                     │                    │
    │                      │                     │   10. Compute TOTP │
    │                      │                     │   (server-side)    │
    │                      │                     │                    │
    │                      │                     │   11. Compare OTPs │
    │                      │                     │                    │
    │                      │                     │   12. Check if     │
    │                      │                     │   consumed         │
    │                      │                     │                    │
    │                      │                     │   13. Mark as      │
    │                      │                     │   consumed         │
    │                      │                     │                    │
    │ 14. Authentication Result                  │                    │
    │<───────────────────────────────────────────────────────────────│
    │                      │                     │                    │
```

### Security Controls

| Control | Implementation |
|---------|---------------|
| **Secret Isolation** | TOTP secret stored in external EEPROM, not in ESP32 flash memory |
| **Tamper Detection** | NC switch triggers immediate lockout; state persists across power cycles |
| **Replay Prevention** | OTP/time-step pair recorded in database; reuse rejected |
| **Rate Limiting** | Minimum 1-second interval between OTP generation requests |
| **Audit Logging** | All authentication attempts logged with IP, user agent, timestamp |
| **Secure Transport** | HTTPS required for production deployment |
| **PIN Protection** | Administrative reset requires 6-digit PIN |

### Tamper Response Protocol

1. **Detection**: NC switch opens when enclosure is breached
2. **Immediate Response**: Device sets `deviceLocked = true`
3. **State Persistence**: Lock state written to internal EEPROM
4. **Visual Indication**: LEDs enter rapid blink pattern
5. **Serial Notification**: `TAMPER:DETECTED` and `STATUS:LOCKED` sent to bridge
6. **Database Logging**: Event recorded with timestamp and tamper count
7. **Recovery**: Requires physical access and administrative PIN to unlock

---

## Project Structure

```
HST/
│
├── HST.ino                     # ESP32 Firmware (v5.3)
│                               # - TOTP generation (HMAC-SHA1)
│                               # - EEPROM I2C communication
│                               # - Tamper detection logic
│                               # - Serial command protocol
│
├── hst/                        # Next.js 15 Web Application
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── setup/      # Credential generation
│   │   │   │   ├── store/      # Database storage
│   │   │   │   └── verify/     # OTP validation
│   │   │   ├── bridge/
│   │   │   │   ├── device/     # Device status proxy
│   │   │   │   ├── otp/        # OTP retrieval proxy
│   │   │   │   ├── provision/  # Provisioning proxy
│   │   │   │   ├── reset/      # Reset proxy
│   │   │   │   ├── status/     # Full status proxy
│   │   │   │   └── ...         # Additional endpoints
│   │   │   └── tamper/
│   │   │       └── log/        # Tamper event logging
│   │   ├── dashboard/          # System monitoring UI
│   │   ├── setup/              # User provisioning UI
│   │   ├── verify/             # Authentication UI
│   │   └── tamper/             # Security management UI
│   ├── lib/
│   │   ├── supabase.ts         # Database client configuration
│   │   └── totp.ts             # Server-side TOTP implementation
│   ├── package.json
│   └── tsconfig.json
│
├── bridge/
│   ├── requirements.txt        # Python dependencies
│   └── pyconnect/
│       ├── main.py             # Flask bridge server (v5.2)
│       └── test.sh             # API testing script
│
├── HST.pdf                     # Project documentation
├── Synopsis copy.pdf           # Project synopsis
├── README.md                   # This file
└── .gitignore                  # Git ignore rules
```

---

## Technical Specifications

| Category | Specification | Value |
|----------|--------------|-------|
| **Frontend** | Framework | Next.js 15.5.3 |
| | React Version | 19.1.0 |
| | Language | TypeScript 5.x |
| | Styling | Tailwind CSS 4.x |
| | Build Tool | Turbopack |
| **Backend** | API Routes | Next.js App Router |
| | Bridge Server | Python Flask 3.0.0 |
| | Database | Supabase PostgreSQL 15 |
| **Hardware** | Microcontroller | ESP32-WROOM-32D |
| | Clock Speed | 240 MHz |
| | RAM | 520 KB SRAM |
| | External Storage | AT24C256 (32KB EEPROM) |
| **Communication** | Serial Protocol | UART, 115200 baud |
| | HTTP Port | 5000 (bridge), 3000 (web) |
| **Cryptography** | TOTP Algorithm | HMAC-SHA1 (RFC 6238) |
| | Secret Size | 160 bits |
| | OTP Validity | 90 seconds |
| | Time Step | 30 seconds |
| | Password Hash | PBKDF2-SHA512 (100k iterations) |

---

## Deployment

### Production Deployment (Web Application)

```bash
# Build production bundle
cd hst
npm run build

# Deploy to Vercel
vercel deploy --prod
```

Configure environment variables in Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_BRIDGE_URL`

### Production Deployment (Bridge Server)

The bridge server requires physical USB connection to the hardware token and must run on the same machine.

**Option 1: systemd Service (Linux)**

Create `/etc/systemd/system/hst-bridge.service`:

```ini
[Unit]
Description=HST Bridge Server
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/HST/bridge/pyconnect
Environment="PATH=/path/to/HST/bridge/env/bin"
ExecStart=/path/to/HST/bridge/env/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable hst-bridge
sudo systemctl start hst-bridge
```

**Option 2: PM2 Process Manager**

```bash
npm install -g pm2
pm2 start main.py --name hst-bridge --interpreter python3
pm2 save
pm2 startup
```

---

## Troubleshooting

### ESP32 Issues

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| Device not detected | Charge-only USB cable | Use data-capable USB cable |
| Upload fails | Wrong COM port selected | Verify port in Device Manager |
| EEPROM not found | Wiring error | Check SDA/SCL connections, verify 3.3V power |
| Time sync fails | Serial conflict | Close Arduino Serial Monitor |

### Bridge Server Issues

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| Connection refused | Server not running | Start bridge server with `python main.py` |
| Permission denied | Serial port access | Add user to dialout group (Linux) |
| Port already in use | Another process | Kill conflicting process or change port |

### Web Application Issues

| Problem | Possible Cause | Solution |
|---------|---------------|----------|
| Database errors | Missing environment variables | Verify `.env.local` configuration |
| Bridge timeout | Bridge server not running | Start bridge server |
| CORS errors | Mismatched URLs | Verify `NEXT_PUBLIC_BRIDGE_URL` |

---

## References

- RFC 6238: TOTP: Time-Based One-Time Password Algorithm
- RFC 4226: HOTP: An HMAC-Based One-Time Password Algorithm
- RFC 8018: PKCS #5: Password-Based Cryptography Specification
- NIST SP 800-132: Recommendation for Password-Based Key Derivation
- ESP32 Technical Reference Manual (Espressif Systems)

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Author

**Anirudh Girish**

- Email: [anirudhgirish08@gmail.com](mailto:anirudhgirish08@gmail.com)
- GitHub: [@AnirudhGirish](https://github.com/AnirudhGirish)

---

<p align="center">
  <em>Hardware Secure Tokeniser - Enterprise Authentication Solution</em>
</p>