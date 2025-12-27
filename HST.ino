/*
 * Hardware Secure Tokeniser - ESP32 Firmware v5.3
 * FIXED: OTP LED timeout + Time sync issues
 */

#include <Wire.h>
#include <EEPROM.h>
#include "mbedtls/md.h"

// ==================== PIN CONFIGURATION ====================
const int BUTTON_PIN = 23;
const int LED_PIN = 2;
const int STATUS_LED_PIN = 25;
const int TAMPER_PIN = 19;
const int SDA_PIN = 21;
const int SCL_PIN = 22;

// ==================== EXTERNAL LED PINS ====================
const int OTP_ACTIVE_LED = 18;      // Blue - OTP lifecycle
const int EEPROM_LED = 5;           // Yellow - EEPROM activity
const int SYSTEM_READY_PIN = 4;     // Output to AND gate → Green LED

// ==================== EEPROM CONFIGURATION ====================
const uint8_t EEPROM_I2C_ADDR = 0x50;
const uint16_t EXT_ADDR_TOTP_SECRET = 0;
const uint16_t EXT_ADDR_USER_ID = 32;
const uint8_t TOTP_SECRET_LENGTH = 20;

const int INTERNAL_EEPROM_SIZE = 512;
const int ADDR_DEVICE_PROVISIONED = 0;
const int ADDR_TAMPER_STATE = 4;
const int ADDR_TAMPER_COUNT = 8;
const int ADDR_DEVICE_LOCKED = 12;
const int ADDR_UNIX_TIME_OFFSET = 16;

// ==================== TOTP CONFIGURATION ====================
const uint32_t TIME_STEP = 30;
const uint8_t TOTP_DIGITS = 6;

// ==================== TIMING ====================
const unsigned long SERIAL_BAUD = 115200;
const unsigned long DEBOUNCE_DELAY = 50;
const unsigned long MIN_PRESS_INTERVAL = 1000;
const unsigned long TAMPER_CHECK_INTERVAL = 100;
const unsigned long TAMPER_DEBOUNCE = 500;
const unsigned long HEARTBEAT_INTERVAL = 5000;
const unsigned long OTP_LIFETIME = 90000; // 90 seconds (3 time windows)

// ==================== GLOBAL STATE ====================
unsigned long lastDebounceTime = 0;
unsigned long lastOTPGenerationTime = 0;
unsigned long lastTamperCheck = 0;
unsigned long tamperDetectedTime = 0;
unsigned long otpGeneratedTime = 0;  // Track OTP generation time
int lastButtonState = HIGH;
int buttonState = HIGH;
int lastTamperState = HIGH;
int tamperState = HIGH;

bool deviceLocked = false;
bool tamperDetected = false;
bool tamperAlertActive = false;
bool deviceProvisioned = false;
bool eepromAvailable = false;
bool timeSync = false;
bool otpActive = false;  // Track if OTP is currently active

unsigned long otpCounter = 0;
unsigned long tamperCount = 0;

uint8_t totpSecret[TOTP_SECRET_LENGTH] = {0};
char userId[32] = {0};
int64_t unixTimeOffset = 0;

// ==================== LED HELPER FUNCTIONS ====================

void flashEEPROMLED() {
  digitalWrite(EEPROM_LED, HIGH);
  delay(100);
  digitalWrite(EEPROM_LED, LOW);
}

void updateSystemReadyPin() {
  bool systemReady = deviceProvisioned && eepromAvailable && timeSync && !deviceLocked;
  digitalWrite(SYSTEM_READY_PIN, systemReady ? HIGH : LOW);
}

void checkOTPTimeout() {
  // Check if OTP has expired
  if (otpActive) {
    unsigned long otpAge = millis() - otpGeneratedTime;
    if (otpAge > OTP_LIFETIME) {
      otpActive = false;
      digitalWrite(OTP_ACTIVE_LED, LOW);
      Serial.println("[LED] OTP expired - LED turned OFF");
    }
  }
}

// ==================== EEPROM FUNCTIONS ====================

bool checkEEPROM() {
  Wire.beginTransmission(EEPROM_I2C_ADDR);
  byte error = Wire.endTransmission();
  return (error == 0);
}

void writeEEPROMByte(uint16_t address, uint8_t data) {
  Wire.beginTransmission(EEPROM_I2C_ADDR);
  Wire.write((uint8_t)(address >> 8));
  Wire.write((uint8_t)(address & 0xFF));
  Wire.write(data);
  Wire.endTransmission();
  delay(5);
}

uint8_t readEEPROMByte(uint16_t address) {
  Wire.beginTransmission(EEPROM_I2C_ADDR);
  Wire.write((uint8_t)(address >> 8));
  Wire.write((uint8_t)(address & 0xFF));
  Wire.endTransmission();
  
  Wire.requestFrom(EEPROM_I2C_ADDR, (uint8_t)1);
  if (Wire.available()) {
    return Wire.read();
  }
  return 0xFF;
}

void writeEEPROMBuffer(uint16_t address, const uint8_t* data, uint16_t length) {
  flashEEPROMLED();
  for (uint16_t i = 0; i < length; i++) {
    writeEEPROMByte(address + i, data[i]);
  }
}

void readEEPROMBuffer(uint16_t address, uint8_t* buffer, uint16_t length) {
  flashEEPROMLED();
  for (uint16_t i = 0; i < length; i++) {
    buffer[i] = readEEPROMByte(address + i);
  }
}

void saveTOTPSecret() {
  if (!eepromAvailable) return;
  writeEEPROMBuffer(EXT_ADDR_TOTP_SECRET, totpSecret, TOTP_SECRET_LENGTH);
  Serial.println("[EEPROM] Secret saved");
}

void loadTOTPSecret() {
  if (!eepromAvailable) return;
  readEEPROMBuffer(EXT_ADDR_TOTP_SECRET, totpSecret, TOTP_SECRET_LENGTH);
  Serial.println("[EEPROM] Secret loaded");
}

void saveUserId() {
  if (!eepromAvailable) return;
  writeEEPROMBuffer(EXT_ADDR_USER_ID, (uint8_t*)userId, 32);
  Serial.println("[EEPROM] User ID saved");
}

void loadUserId() {
  if (!eepromAvailable) return;
  readEEPROMBuffer(EXT_ADDR_USER_ID, (uint8_t*)userId, 32);
  userId[31] = '\0';
  Serial.println("[EEPROM] User ID loaded");
}

// ==================== INTERNAL EEPROM ====================

void initInternalEEPROM() {
  EEPROM.begin(INTERNAL_EEPROM_SIZE);
  
  byte savedState = EEPROM.read(ADDR_TAMPER_STATE);
  
  if (savedState == 0xFF) {
    Serial.println("[EEPROM] First boot - initializing");
    EEPROM.write(ADDR_DEVICE_PROVISIONED, 0);
    EEPROM.write(ADDR_TAMPER_STATE, 0);
    EEPROM.write(ADDR_DEVICE_LOCKED, 0);
    EEPROM.put(ADDR_TAMPER_COUNT, 0UL);
    EEPROM.put(ADDR_UNIX_TIME_OFFSET, (int64_t)0);
    EEPROM.commit();
    
    tamperCount = 0;
    deviceLocked = false;
    deviceProvisioned = false;
    unixTimeOffset = 0;
  } else {
    deviceProvisioned = EEPROM.read(ADDR_DEVICE_PROVISIONED) == 1;
    deviceLocked = EEPROM.read(ADDR_DEVICE_LOCKED) == 1;
    EEPROM.get(ADDR_TAMPER_COUNT, tamperCount);
    EEPROM.get(ADDR_UNIX_TIME_OFFSET, unixTimeOffset);
    
    if (tamperCount > 10000) {
      tamperCount = 0;
      EEPROM.put(ADDR_TAMPER_COUNT, 0UL);
      EEPROM.commit();
    }
    
    if (savedState == 1 && deviceLocked) {
      tamperDetected = true;
      tamperAlertActive = true;
    }
    
    if (unixTimeOffset != 0) {
      timeSync = true;
    }
  }
}

void saveInternalEEPROM() {
  EEPROM.write(ADDR_TAMPER_STATE, tamperDetected ? 1 : 0);
  EEPROM.write(ADDR_DEVICE_LOCKED, deviceLocked ? 1 : 0);
  EEPROM.write(ADDR_DEVICE_PROVISIONED, deviceProvisioned ? 1 : 0);
  EEPROM.put(ADDR_TAMPER_COUNT, tamperCount);
  EEPROM.put(ADDR_UNIX_TIME_OFFSET, unixTimeOffset);
  EEPROM.commit();
}

// ==================== TOTP FUNCTIONS ====================

uint64_t getCurrentUnixTime() {
  if (!timeSync) return 0;
  return (millis() / 1000) + unixTimeOffset;
}

uint32_t getCurrentTimeStep() {
  if (!timeSync) return 0;
  return (uint32_t)(getCurrentUnixTime() / TIME_STEP);
}

void hmacSha1(const uint8_t* key, size_t keyLen, const uint8_t* data, size_t dataLen, uint8_t* output) {
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA1;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, key, keyLen);
  mbedtls_md_hmac_update(&ctx, data, dataLen);
  mbedtls_md_hmac_finish(&ctx, output);
  mbedtls_md_free(&ctx);
}

uint32_t generateTOTP() {
  if (!deviceProvisioned || !timeSync) return 0;
  
  uint32_t timeStep = getCurrentTimeStep();
  if (timeStep == 0) return 0;
  
  uint8_t timeBytes[8] = {0};
  for (int i = 7; i >= 0; i--) {
    timeBytes[i] = (uint8_t)(timeStep & 0xFF);
    timeStep >>= 8;
  }
  
  uint8_t hash[20];
  hmacSha1(totpSecret, TOTP_SECRET_LENGTH, timeBytes, 8, hash);
  
  uint8_t offset = hash[19] & 0x0F;
  uint32_t truncatedHash = 
    ((hash[offset] & 0x7F) << 24) |
    ((hash[offset + 1] & 0xFF) << 16) |
    ((hash[offset + 2] & 0xFF) << 8) |
    (hash[offset + 3] & 0xFF);
  
  return truncatedHash % 1000000;
}

// ==================== SETUP ====================

void setup() {
  Serial.begin(SERIAL_BAUD);
  unsigned long startTime = millis();
  while (!Serial && (millis() - startTime < 3000)) {
    delay(10);
  }
  
  Serial.println("\n\n[BOOT] Starting HST v5.3...");
  
  // Initialize I2C
  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  Serial.println("[I2C] Initialized at 100kHz");
  delay(500);
  
  // Check EEPROM with retries
  Serial.println("[I2C] Scanning for EEPROM at 0x50...");
  bool eepromFound = false;
  
  for (int attempt = 0; attempt < 5; attempt++) {
    Serial.print("[I2C] Attempt ");
    Serial.print(attempt + 1);
    Serial.print("/5: ");
    
    if (checkEEPROM()) {
      Serial.println("✓ EEPROM FOUND!");
      eepromFound = true;
      eepromAvailable = true;
      break;
    } else {
      Serial.println("✗ Not found");
    }
    
    delay(200);
  }
  
  if (!eepromFound) {
    Serial.println("[!] EEPROM NOT DETECTED");
    eepromAvailable = false;
  }
  
  initInternalEEPROM();
  
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(TAMPER_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  digitalWrite(STATUS_LED_PIN, LOW);
  
  // Initialize external LED pins
  pinMode(OTP_ACTIVE_LED, OUTPUT);
  pinMode(EEPROM_LED, OUTPUT);
  pinMode(SYSTEM_READY_PIN, OUTPUT);
  digitalWrite(OTP_ACTIVE_LED, LOW);
  digitalWrite(EEPROM_LED, LOW);
  digitalWrite(SYSTEM_READY_PIN, LOW);
  Serial.println("[LED] External indicators initialized");
  
  lastTamperState = digitalRead(TAMPER_PIN);
  tamperState = lastTamperState;
  
  printStartupBanner();
  
  if (tamperDetected || deviceLocked) {
    Serial.println("[LED] Tamper alert mode");
    tamperAlertBlink();
  } else {
    Serial.println("[LED] Normal startup");
    startupBlink();
    digitalWrite(STATUS_LED_PIN, HIGH);
  }
  
  if (eepromAvailable && deviceProvisioned) {
    loadTOTPSecret();
    loadUserId();
    Serial.print("USER_ID:");
    Serial.println(userId);
  }
  
  updateSystemReadyPin();
  
  Serial.println("Ready. Press button to generate TOTP.");
}

void printStartupBanner() {
  Serial.println("===========================================");
  Serial.println("Hardware Secure Tokeniser v5.3");
  Serial.println("===========================================");
  
  Serial.print("EEPROM:");
  Serial.println(eepromAvailable ? "DETECTED" : "NOT_FOUND");
  
  Serial.print("TIME_SYNC:");
  Serial.println(timeSync ? "YES" : "NO");
  
  if (tamperDetected || deviceLocked) {
    Serial.println("STATUS:TAMPERED");
  } else {
    Serial.println("STATUS:READY");
  }
  
  Serial.print("PROVISIONED:");
  Serial.println(deviceProvisioned ? "YES" : "NO");
  
  Serial.print("TAMPER_COUNT:");
  Serial.println(tamperCount);
}

// ==================== MAIN LOOP ====================

void loop() {
  handleSerialCommand();
  checkTamperSwitch();
  
  if (tamperAlertActive) {
    handleTamperAlert();
  }
  
  if (!deviceLocked) {
    handleButtonPress();
  }
  
  // Check OTP timeout
  checkOTPTimeout();
  
  // Send all status info in heartbeat so UI stays synced
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
    Serial.print("HEARTBEAT:");
    Serial.println(deviceLocked ? "LOCKED" : "READY");
    
    Serial.print("EEPROM:");
    Serial.println(eepromAvailable ? "DETECTED" : "NOT_FOUND");
    
    Serial.print("PROVISIONED:");
    Serial.println(deviceProvisioned ? "YES" : "NO");
    
    Serial.print("TIME_SYNC:");
    Serial.println(timeSync ? "YES" : "NO");
    
    lastHeartbeat = millis();
  }
  
  // Update system ready indicator
  updateSystemReadyPin();
}

// ==================== TAMPER DETECTION ====================

void checkTamperSwitch() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastTamperCheck < TAMPER_CHECK_INTERVAL) return;
  lastTamperCheck = currentTime;
  
  int reading = digitalRead(TAMPER_PIN);
  
  if (reading != lastTamperState) {
    tamperDetectedTime = currentTime;
  }
  
  if ((currentTime - tamperDetectedTime) > TAMPER_DEBOUNCE) {
    if (reading != tamperState) {
      tamperState = reading;
      
      if (tamperState == LOW && !tamperDetected) {
        handleTamperEvent();
      }
    }
  }
  
  lastTamperState = reading;
}

void handleTamperEvent() {
  Serial.println("[TAMPER] Event detected!");
  
  tamperDetected = true;
  deviceLocked = true;
  tamperAlertActive = true;
  tamperCount++;
  otpActive = false;
  
  saveInternalEEPROM();
  
  Serial.println("TAMPER:DETECTED");
  Serial.print("TAMPER_COUNT:");
  Serial.println(tamperCount);
  Serial.println("STATUS:LOCKED");
  
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(OTP_ACTIVE_LED, LOW);
  
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(100);
  }
}

void handleTamperAlert() {
  static unsigned long lastBlink = 0;
  if (millis() - lastBlink > 500) {
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    lastBlink = millis();
  }
}

// ==================== BUTTON & OTP ====================

void handleButtonPress() {
  int reading = digitalRead(BUTTON_PIN);
  
  if (reading != lastButtonState) {
    lastDebounceTime = millis();
  }
  
  if ((millis() - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading != buttonState) {
      buttonState = reading;
      
      if (buttonState == LOW) {
        handleOTPGeneration();
      }
    }
  }
  
  lastButtonState = reading;
}

void handleOTPGeneration() {
  Serial.println("[BUTTON] Pressed");
  
  if (deviceLocked) {
    Serial.println("ERROR:DEVICE_LOCKED");
    blinkError();
    return;
  }
  
  if (!deviceProvisioned) {
    Serial.println("ERROR:NOT_PROVISIONED");
    blinkError();
    return;
  }
  
  if (!eepromAvailable) {
    Serial.println("ERROR:EEPROM_NOT_AVAILABLE");
    blinkError();
    return;
  }
  
  if (!timeSync) {
    Serial.println("ERROR:NO_TIME_SYNC");
    blinkError();
    return;
  }
  
  unsigned long currentTime = millis();
  if (currentTime - lastOTPGenerationTime < MIN_PRESS_INTERVAL) {
    Serial.println("ERROR:TOO_FAST");
    blinkError();
    return;
  }
  lastOTPGenerationTime = currentTime;
  
  uint32_t otp = generateTOTP();
  if (otp == 0) {
    Serial.println("ERROR:TOTP_GENERATION_FAILED");
    blinkError();
    return;
  }
  
  otpCounter++;
  
  char otpString[7];
  sprintf(otpString, "%06lu", (unsigned long)otp);
  
  // Turn on OTP active LED and track time
  otpActive = true;
  otpGeneratedTime = currentTime;
  digitalWrite(OTP_ACTIVE_LED, HIGH);
  Serial.println("[LED] OTP Active LED turned ON");
  
  Serial.print("OTP:");
  Serial.println(otpString);
  Serial.print("TIME_STEP:");
  Serial.println(getCurrentTimeStep());
  Serial.print("USER_ID:");
  Serial.println(userId);
  
  blinkSuccess();
}

// ==================== LED FEEDBACK ====================

void blinkSuccess() {
  Serial.println("[LED] Success blink");
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(100);
  }
  digitalWrite(STATUS_LED_PIN, HIGH);
}

void blinkError() {
  Serial.println("[LED] Error blink");
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    delay(50);
  }
}

void startupBlink() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(200);
  }
}

void tamperAlertBlink() {
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(150);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(150);
  }
}

// ==================== SERIAL COMMANDS ====================

void handleSerialCommand() {
  if (Serial.available() > 0) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    Serial.print("[CMD] Received: ");
    Serial.println(command);
    
    if (command == "STATUS") {
      printDetailedStatus();
    }
    else if (command.startsWith("SYNC_TIME ")) {
      handleTimeSyncCommand(command.substring(10));
    }
    else if (command.startsWith("PROVISION ")) {
      handleProvisionCommand(command.substring(10));
    }
    else if (command.startsWith("RESET ")) {
      handleResetCommand(command.substring(6));
    }
    else if (command == "PING") {
      Serial.println("PONG");
    }
    else if (command == "OTP_CONSUMED") {
      otpActive = false;
      digitalWrite(OTP_ACTIVE_LED, LOW);
      Serial.println("[LED] OTP consumed - LED turned OFF");
    }
  }
}

void printDetailedStatus() {
  Serial.print("STATUS:");
  Serial.println(deviceLocked ? "LOCKED" : "READY");
  Serial.print("PROVISIONED:");
  Serial.println(deviceProvisioned ? "YES" : "NO");
  Serial.print("EEPROM:");
  Serial.println(eepromAvailable ? "DETECTED" : "NOT_FOUND");
  Serial.print("TIME_SYNC:");
  Serial.println(timeSync ? "YES" : "NO");
  Serial.print("TAMPER_COUNT:");
  Serial.println(tamperCount);
  Serial.print("USER_ID:");
  Serial.println(userId);
  Serial.print("CURRENT_TIME:");
  Serial.println((unsigned long)getCurrentUnixTime());
  Serial.print("CURRENT_TIME_STEP:");
  Serial.println(getCurrentTimeStep());
}

void handleTimeSyncCommand(String unixTimeStr) {
  int64_t serverUnixTime = (int64_t)unixTimeStr.toInt();
  uint64_t currentMillis = millis();
  
  unixTimeOffset = serverUnixTime - (currentMillis / 1000);
  timeSync = true;
  saveInternalEEPROM();
  
  Serial.println("TIME_SYNC:SUCCESS");
  Serial.print("[TIME] Synced with offset: ");
  Serial.println((long)unixTimeOffset);
  Serial.print("[TIME] Current Unix time: ");
  Serial.println((unsigned long)getCurrentUnixTime());
  Serial.print("[TIME] Current time step: ");
  Serial.println(getCurrentTimeStep());
  
  updateSystemReadyPin();
}

void handleProvisionCommand(String data) {
  Serial.print("[PROVISION] Received: ");
  Serial.println(data);
  
  if (!eepromAvailable) {
    Serial.println("ERROR:EEPROM_NOT_AVAILABLE");
    return;
  }
  
  int colonPos = data.indexOf(':');
  if (colonPos == -1) {
    Serial.println("ERROR:INVALID_FORMAT");
    return;
  }
  
  String newUserId = data.substring(0, colonPos);
  String secretHex = data.substring(colonPos + 1);
  
  Serial.print("[PROVISION] User: ");
  Serial.println(newUserId);
  Serial.print("[PROVISION] Secret length: ");
  Serial.println(secretHex.length());
  
  if (secretHex.length() != TOTP_SECRET_LENGTH * 2) {
    Serial.println("ERROR:INVALID_SECRET_LENGTH");
    Serial.print("Expected: ");
    Serial.print(TOTP_SECRET_LENGTH * 2);
    Serial.print(" got: ");
    Serial.println(secretHex.length());
    return;
  }
  
  for (int i = 0; i < TOTP_SECRET_LENGTH; i++) {
    String byteStr = secretHex.substring(i * 2, i * 2 + 2);
    totpSecret[i] = (uint8_t)strtol(byteStr.c_str(), NULL, 16);
  }
  
  strncpy(userId, newUserId.c_str(), 31);
  userId[31] = '\0';
  
  saveTOTPSecret();
  saveUserId();
  
  deviceProvisioned = true;
  saveInternalEEPROM();
  
  Serial.println("PROVISIONED:YES");
  Serial.print("USER_ID:");
  Serial.println(userId);
  
  updateSystemReadyPin();
  
  blinkSuccess();
}

void handleResetCommand(String pin) {
  const String ADMIN_PIN = "123456";
  
  Serial.print("[RESET] Attempting with PIN: ");
  Serial.println(pin);
  
  if (pin == ADMIN_PIN) {
    tamperDetected = false;
    deviceLocked = false;
    tamperAlertActive = false;
    otpActive = false;
    saveInternalEEPROM();
    
    Serial.println("RESET:SUCCESS");
    Serial.println("STATUS:READY");
    
    digitalWrite(STATUS_LED_PIN, HIGH);
    digitalWrite(LED_PIN, LOW);
    digitalWrite(OTP_ACTIVE_LED, LOW);
    
    updateSystemReadyPin();
    
    startupBlink();
  } else {
    Serial.println("ERROR:INVALID_PIN");
    blinkError();
  }
}