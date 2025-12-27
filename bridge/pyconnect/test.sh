#!/bin/bash

# Hardware Secure Tokeniser - Bridge API Test Script
# Tests all bridge endpoints

BRIDGE_URL="http://127.0.0.1:5000"
COLORS=true

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "HST Bridge API Test Suite"
echo "=========================================="
echo ""

# Test 1: Health Check
echo -e "${BLUE}[TEST 1]${NC} Health Check"
curl -s "$BRIDGE_URL/health" | jq '.'
echo ""
sleep 1

# Test 2: Device Info
echo -e "${BLUE}[TEST 2]${NC} Device Information"
curl -s "$BRIDGE_URL/device" | jq '.'
echo ""
sleep 1

# Test 3: Tamper Status
echo -e "${BLUE}[TEST 3]${NC} Tamper Status"
curl -s "$BRIDGE_URL/tamper" | jq '.'
echo ""
sleep 1

# Test 4: OTP Fetch (should fail if no OTP generated)
echo -e "${BLUE}[TEST 4]${NC} Fetch OTP (may fail if no OTP available)"
echo -e "${YELLOW}Press button on ESP32 now if you want to test OTP fetch${NC}"
sleep 3
curl -s "$BRIDGE_URL/otp?consume=false" | jq '.'
echo ""
sleep 1

# Test 5: Flush OTP Cache
echo -e "${BLUE}[TEST 5]${NC} Flush OTP Cache"
curl -s -X POST "$BRIDGE_URL/flush" | jq '.'
echo ""
sleep 1

# Test 6: OTP with Consume (should fail after flush)
echo -e "${BLUE}[TEST 6]${NC} Fetch OTP with consume=true (should fail)"
curl -s "$BRIDGE_URL/otp?consume=true" | jq '.'
echo ""
sleep 1

# Test 7: Invalid Reset (wrong PIN)
echo -e "${BLUE}[TEST 7]${NC} Reset with Invalid PIN (should fail)"
curl -s -X POST "$BRIDGE_URL/reset" \
  -H "Content-Type: application/json" \
  -d '{"pin":"000000"}' | jq '.'
echo ""
sleep 1

# Test 8: Valid Reset (if device is locked)
echo -e "${BLUE}[TEST 8]${NC} Reset with Valid PIN (default: 123456)"
echo -e "${YELLOW}Note: This will only work if device is tampered/locked${NC}"
curl -s -X POST "$BRIDGE_URL/reset" \
  -H "Content-Type: application/json" \
  -d '{"pin":"123456"}' | jq '.'
echo ""

echo "=========================================="
echo "Test Suite Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Press button on ESP32 to generate OTP"
echo "2. Test OTP fetch: curl '$BRIDGE_URL/otp?consume=false'"
echo "3. Open tamper switch to test tamper detection"
echo "4. Check tamper status: curl '$BRIDGE_URL/tamper'"
echo "5. Reset device: curl -X POST '$BRIDGE_URL/reset' -H 'Content-Type: application/json' -d '{\"pin\":\"123456\"}'"
echo ""c