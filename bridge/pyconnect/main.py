#!/usr/bin/env python3
"""
Hardware Secure Tokeniser - Bridge Server v5.2 FINAL FIX
FIXED: Robust EEPROM parsing with debug output
"""

from flask import Flask, jsonify, request # type: ignore
from flask_cors import CORS # type: ignore
import serial # type: ignore
import serial.tools.list_ports # type: ignore
import threading
import time
import re
from datetime import datetime

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
SERIAL_BAUD = 115200
OTP_TTL_SECONDS = 90
RECONNECT_DELAY = 3

# State
device_state = {
    'otp': None,
    'timestamp': None,
    'consumed': False,
    'time_step': None,
    'user_id': None,
    'device_info': None,
    'status': 'UNKNOWN',
    'provisioned': False,
    'eeprom_available': False,  # THIS NEEDS TO BE TRUE
    'time_sync': False,
    'tamper': {
        'detected': False,
        'count': 0,
        'timestamp': None,
        'locked': False
    }
}

serial_connection = None
state_lock = threading.Lock()


def find_esp32_port():
    """Auto-detect ESP32 device on USB"""
    ports = serial.tools.list_ports.comports()
    
    for port in ports:
        if any(keyword in port.description.lower() for keyword in ['cp210', 'ch340', 'uart', 'usb', 'serial']):
            return port.device
    
    if ports:
        return ports[0].device
    
    return None


def connect_serial():
    """Establish serial connection to ESP32"""
    global serial_connection
    
    while True:
        try:
            port = find_esp32_port()
            
            if not port:
                print("[!] No USB device found. Retrying in {}s...".format(RECONNECT_DELAY))
                time.sleep(RECONNECT_DELAY)
                continue
            
            print(f"[+] Connecting to {port}...")
            serial_connection = serial.Serial(port, SERIAL_BAUD, timeout=1)
            time.sleep(2)
            
            with state_lock:
                device_state['device_info'] = {
                    'port': port,
                    'baud': SERIAL_BAUD,
                    'connected_at': datetime.now().isoformat()
                }
            
            print(f"[✓] Connected to {port}")
            
            # Sync time on connection
            sync_time_with_device()
            
            return serial_connection
            
        except serial.SerialException as e:
            print(f"[!] Connection failed: {e}. Retrying in {RECONNECT_DELAY}s...")
            time.sleep(RECONNECT_DELAY)


def sync_time_with_device():
    """Sync Unix time with ESP32"""
    try:
        if serial_connection and serial_connection.is_open:
            unix_time = int(time.time())
            command = f"SYNC_TIME {unix_time}\n"
            serial_connection.write(command.encode())
            print(f"[→] Time sync sent: {unix_time}")
            time.sleep(0.5)
    except Exception as e:
        print(f"[!] Time sync error: {e}")


def read_serial_loop():
    """Background thread to continuously read serial data"""
    global serial_connection
    
    while True:
        try:
            if not serial_connection or not serial_connection.is_open:
                serial_connection = connect_serial()
            
            if serial_connection.in_waiting > 0:
                line = serial_connection.readline().decode('utf-8', errors='ignore').strip()
                
                if line:
                    print(f"[←] RAW: '{line}'")  # Debug: show raw line
                    parse_serial_line(line)
        
        except serial.SerialException as e:
            print(f"[!] Serial error: {e}. Reconnecting...")
            serial_connection = None
            time.sleep(RECONNECT_DELAY)
        
        except Exception as e:
            print(f"[!] Unexpected error: {e}")
            time.sleep(1)


def parse_serial_line(line):
    """Parse incoming serial data and update state"""
    # Remove any whitespace/control characters
    line = line.strip()
    
    with state_lock:
        # OTP
        if line.startswith('OTP:'):
            otp_val = line.split(':', 1)[1].strip()
            device_state['otp'] = otp_val
            device_state['timestamp'] = datetime.now()
            device_state['consumed'] = False
            print(f"[✓] OTP cached: {device_state['otp']}")
        
        # TIME_STEP
        elif line.startswith('TIME_STEP:'):
            val = line.split(':', 1)[1].strip()
            try:
                device_state['time_step'] = int(val)
            except:
                pass
        
        # USER_ID
        elif line.startswith('USER_ID:'):
            val = line.split(':', 1)[1].strip()
            device_state['user_id'] = val
        
        # STATUS
        elif line.startswith('STATUS:'):
            status_val = line.split(':', 1)[1].strip()
            device_state['status'] = status_val
            device_state['tamper']['locked'] = (status_val in ['LOCKED', 'TAMPERED'])
        
        # PROVISIONED
        elif line.startswith('PROVISIONED:'):
            val = line.split(':', 1)[1].strip()
            device_state['provisioned'] = (val == 'YES')
        
        # EEPROM - MAIN FIX
        elif line.startswith('EEPROM:'):
            eeprom_val = line.split(':', 1)[1].strip()
            # CRITICAL: Check for exact matches
            is_available = eeprom_val in ['DETECTED', 'AVAILABLE', 'FOUND', 'OK']
            device_state['eeprom_available'] = is_available
            
            print(f"[DEBUG] EEPROM line: '{line}'")
            print(f"[DEBUG] Extracted value: '{eeprom_val}'")
            print(f"[DEBUG] eeprom_available set to: {is_available}")
        
        # TIME_SYNC
        elif line.startswith('TIME_SYNC:'):
            sync_val = line.split(':', 1)[1].strip()
            is_synced = sync_val in ['SUCCESS', 'YES', 'OK']
            device_state['time_sync'] = is_synced
        
        # TAMPER_COUNT
        elif line.startswith('TAMPER_COUNT:'):
            val = line.split(':', 1)[1].strip()
            try:
                device_state['tamper']['count'] = int(val)
            except:
                pass
        
        # TAMPER:DETECTED
        elif 'TAMPER:DETECTED' in line or 'TAMPER ALERT' in line:
            device_state['tamper']['detected'] = True
            device_state['tamper']['timestamp'] = datetime.now().isoformat()
            device_state['tamper']['locked'] = True
        
        # RESET:SUCCESS
        elif 'RESET:SUCCESS' in line:
            device_state['tamper']['detected'] = False
            device_state['tamper']['locked'] = False
        
        # HEARTBEAT
        elif line.startswith('HEARTBEAT:'):
            heartbeat_val = line.split(':', 1)[1].strip()
            if heartbeat_val == 'LOCKED':
                device_state['status'] = 'LOCKED'
                device_state['tamper']['locked'] = True
            elif heartbeat_val == 'READY':
                device_state['status'] = 'READY'


def is_otp_valid():
    """Check if cached OTP is still valid"""
    if not device_state['otp'] or not device_state['timestamp']:
        return False
    
    age = (datetime.now() - device_state['timestamp']).total_seconds()
    return age <= OTP_TTL_SECONDS


# ==================== HTTP ENDPOINTS ====================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'service': 'hardware-token-bridge',
        'version': '5.2',
        'timestamp': datetime.now().isoformat()
    })


@app.route('/device', methods=['GET'])
def device_info():
    """Get comprehensive device information"""
    with state_lock:
        if not device_state['device_info']:
            return jsonify({'error': 'No device connected'}), 503
        
        return jsonify({
            'device': device_state['device_info'],
            'connected': serial_connection.is_open if serial_connection else False,
            'status': device_state['status'],
            'provisioned': device_state['provisioned'],
            'eeprom_available': device_state['eeprom_available'],
            'time_sync': device_state['time_sync'],
            'tamper_locked': device_state['tamper']['locked'],
            'user_id': device_state['user_id']
        })


@app.route('/otp', methods=['GET'])
def get_otp():
    """Get current OTP with metadata"""
    consume = request.args.get('consume', 'false').lower() == 'true'
    
    with state_lock:
        if device_state['tamper']['locked']:
            return jsonify({
                'error': 'Device is locked due to tamper detection',
                'message': 'Reset device to generate OTPs'
            }), 423
        
        if not is_otp_valid():
            return jsonify({
                'error': 'No valid OTP available',
                'message': 'Press button on hardware token to generate OTP'
            }), 404
        
        if consume and device_state['consumed']:
            return jsonify({
                'error': 'OTP already consumed',
                'message': 'Generate new OTP on hardware token'
            }), 410
        
        otp_data = {
            'otp': device_state['otp'],
            'generated_at': device_state['timestamp'].isoformat(),
            'expires_in': max(0, OTP_TTL_SECONDS - int((datetime.now() - device_state['timestamp']).total_seconds())),
            'consumed': device_state['consumed'],
            'time_step': device_state['time_step'],
            'user_id': device_state['user_id']
        }
        
        if consume:
            device_state['consumed'] = True
            print(f"[✓] OTP {device_state['otp']} consumed")
        
        return jsonify(otp_data)


@app.route('/flush', methods=['POST'])
def flush_otp():
    """Clear cached OTP"""
    with state_lock:
        old_otp = device_state['otp']
        device_state['otp'] = None
        device_state['timestamp'] = None
        device_state['consumed'] = False
        device_state['time_step'] = None
    
    print(f"[→] OTP cache flushed")
    return jsonify({
        'message': 'OTP cache flushed',
        'flushed_otp': old_otp
    })


@app.route('/tamper', methods=['GET'])
def get_tamper_status():
    """Get tamper detection status"""
    with state_lock:
        return jsonify(device_state['tamper'])


@app.route('/status', methods=['GET'])
def get_full_status():
    """Get complete device status"""
    with state_lock:
        return jsonify({
            'device': device_state['device_info'],
            'connected': serial_connection.is_open if serial_connection else False,
            'status': device_state['status'],
            'provisioned': device_state['provisioned'],
            'eeprom_available': device_state['eeprom_available'],
            'time_sync': device_state['time_sync'],
            'user_id': device_state['user_id'],
            'tamper': device_state['tamper'],
            'otp_available': is_otp_valid(),
            'otp_consumed': device_state['consumed']
        })


@app.route('/provision', methods=['POST'])
def provision_device():
    """Provision device with user ID and TOTP secret"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    user_id = data.get('user_id')
    secret_hex = data.get('secret_hex')
    
    if not user_id or not secret_hex:
        return jsonify({'error': 'user_id and secret_hex required'}), 400
    
    if serial_connection and serial_connection.is_open:
        try:
            command = f"PROVISION {user_id}:{secret_hex}\n"
            serial_connection.write(command.encode())
            print(f"[→] Provisioning: {user_id}")
            
            time.sleep(1)
            
            with state_lock:
                if device_state['provisioned']:
                    return jsonify({
                        'success': True,
                        'message': 'Device provisioned successfully',
                        'user_id': user_id
                    })
            
            return jsonify({'error': 'Provisioning failed'}), 500
            
        except Exception as e:
            print(f"[!] Provision error: {e}")
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Device not connected'}), 503


@app.route('/reset', methods=['POST'])
def reset_device():
    """Reset tamper lockout with admin PIN"""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    pin = data.get('pin', '')
    
    if not pin:
        return jsonify({'error': 'PIN required'}), 400
    
    if serial_connection and serial_connection.is_open:
        try:
            command = f"RESET {pin}\n"
            serial_connection.write(command.encode())
            print(f"[→] Reset command sent")
            
            time.sleep(1)
            
            with state_lock:
                if not device_state['tamper']['locked']:
                    device_state['tamper']['detected'] = False
                    return jsonify({
                        'message': 'Device reset successful',
                        'locked': False
                    })
            
            return jsonify({'error': 'Invalid PIN or reset failed'}), 401
            
        except Exception as e:
            print(f"[!] Reset error: {e}")
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Device not connected'}), 503


@app.route('/sync_time', methods=['POST'])
def sync_time():
    """Manually trigger time synchronization"""
    try:
        sync_time_with_device()
        return jsonify({'message': 'Time sync sent to device'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("Hardware Secure Tokeniser - Bridge Server v5.2")
    print("=" * 60)
    
    serial_thread = threading.Thread(target=read_serial_loop, daemon=True)
    serial_thread.start()
    
    print("[+] Serial reader thread started")
    print("[+] Starting HTTP server on http://127.0.0.1:5000")
    print("[+] Press Ctrl+C to stop")
    print("=" * 60)

    print("[+] Available endpoints:")
    print("    GET  /health       - Health check")
    print("    GET  /device       - Device info")
    print("    GET  /status       - Full device status")
    print("    GET  /otp          - Get OTP")
    print("    POST /flush        - Clear OTP cache")
    print("    GET  /tamper       - Tamper status")
    print("    POST /reset        - Reset device")
    print("    POST /provision    - Provision device")
    print("    POST /sync_time    - Sync time")
    print("[+] Press Ctrl+C to stop")
    print("=" * 60)
    
    app.run(host='127.0.0.1', port=5000, debug=False)