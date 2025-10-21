#!/usr/bin/env node

const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";
let accessToken = "";

// Test data
const testUser = {
  fullName: "Nguyễn Văn Test",
  phone: "0123456789",
  email: "test@example.com",
  password: "123456",
};

const testAddress = {
  type: "home",
  name: "Nhà riêng",
  fullAddress: "123 Đường ABC, Quận XYZ",
  ward: "Phường 1",
  district: "Quận 1",
  city: "TP Hồ Chí Minh",
  province: "TP Hồ Chí Minh",
  postalCode: "700000",
  isDefault: true,
  coordinates: {
    lat: 10.7769,
    lng: 106.7009,
  },
};

const testPaymentMethod = {
  provider: "stripe",
  tokenId: "tok_1234567890",
  brand: "Visa",
  last4: "4242",
  isDefault: true,
};

// Helper function to make authenticated requests
const apiCall = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${BASE_URL}${endpoint}`,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    ...(data && { data }),
  };

  try {
    const response = await axios(config);
    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data?.error || error.message,
    };
  }
};

// Test functions
const testSignUp = async () => {
  console.log("🧪 Testing User Signup...");
  const result = await apiCall("POST", "/users/signup", testUser);
  if (result.success) {
    console.log("✅ Signup successful");
  } else {
    console.log("❌ Signup failed:", result.error);
  }
  return result.success;
};

const testSignIn = async () => {
  console.log("🧪 Testing User Signin...");
  const result = await apiCall("POST", "/users/signin", {
    email: testUser.email,
    password: testUser.password,
  });
  if (result.success) {
    accessToken = result.data.accessToken;
    console.log("✅ Signin successful, token saved");
  } else {
    console.log("❌ Signin failed:", result.error);
  }
  return result.success;
};

const testGetProfile = async () => {
  console.log("🧪 Testing Get Profile...");
  const result = await apiCall("GET", "/profiles");
  if (result.success) {
    console.log("✅ Get profile successful");
    console.log("Profile data:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Get profile failed:", result.error);
  }
  return result.success;
};

const testUpdateProfile = async () => {
  console.log("🧪 Testing Update Profile...");
  const result = await apiCall("PUT", "/profiles", {
    fullName: "Nguyễn Văn Test Updated",
    avatarUrl: "https://example.com/avatar.jpg",
  });
  if (result.success) {
    console.log("✅ Update profile successful");
  } else {
    console.log("❌ Update profile failed:", result.error);
  }
  return result.success;
};

const testGetProfileStats = async () => {
  console.log("🧪 Testing Get Profile Stats...");
  const result = await apiCall("GET", "/profiles/stats");
  if (result.success) {
    console.log("✅ Get profile stats successful");
    console.log("Stats:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Get profile stats failed:", result.error);
  }
  return result.success;
};

const testCheckPermissions = async () => {
  console.log("🧪 Testing Check Permissions...");
  const result = await apiCall("GET", "/profiles/permissions");
  if (result.success) {
    console.log("✅ Check permissions successful");
    console.log("Permissions:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Check permissions failed:", result.error);
  }
  return result.success;
};

const testUploadCCCD = async () => {
  console.log("🧪 Testing Upload & Scan CCCD...");
  const result = await apiCall("POST", "/profiles/kyc/scan-cccd", {
    frontImageUrl: "https://example.com/cccd-front.jpg",
    backImageUrl: "https://example.com/cccd-back.jpg",
  });
  if (result.success) {
    console.log("✅ Upload CCCD successful");
    console.log(
      "Scan result:",
      JSON.stringify(result.data.scanResult, null, 2)
    );
  } else {
    console.log("❌ Upload CCCD failed:", result.error);
  }
  return result.success;
};

const testGetKYCInfo = async () => {
  console.log("🧪 Testing Get KYC Info...");
  const result = await apiCall("GET", "/profiles/kyc");
  if (result.success) {
    console.log("✅ Get KYC info successful");
    console.log("KYC info:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Get KYC info failed:", result.error);
  }
  return result.success;
};

const testAddAddress = async () => {
  console.log("🧪 Testing Add Address...");
  const result = await apiCall("POST", "/profiles/addresses", testAddress);
  if (result.success) {
    console.log("✅ Add address successful");
    return result.data.addresses[result.data.addresses.length - 1]._id;
  } else {
    console.log("❌ Add address failed:", result.error);
    return null;
  }
};

const testGetAddresses = async () => {
  console.log("🧪 Testing Get Addresses...");
  const result = await apiCall("GET", "/profiles/addresses");
  if (result.success) {
    console.log("✅ Get addresses successful");
    console.log("Addresses:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Get addresses failed:", result.error);
  }
  return result.success;
};

const testAddPaymentMethod = async () => {
  console.log("🧪 Testing Add Payment Method...");
  const result = await apiCall(
    "POST",
    "/profiles/payment-methods",
    testPaymentMethod
  );
  if (result.success) {
    console.log("✅ Add payment method successful");
    return result.data.paymentMethod._id;
  } else {
    console.log("❌ Add payment method failed:", result.error);
    return null;
  }
};

const testGetPaymentMethods = async () => {
  console.log("🧪 Testing Get Payment Methods...");
  const result = await apiCall("GET", "/profiles/payment-methods");
  if (result.success) {
    console.log("✅ Get payment methods successful");
    console.log("Payment methods:", JSON.stringify(result.data, null, 2));
  } else {
    console.log("❌ Get payment methods failed:", result.error);
  }
  return result.success;
};

// Main test runner
const runTests = async () => {
  console.log("🚀 Starting UC-02 Tests...\n");

  const tests = [
    { name: "Signup", fn: testSignUp },
    { name: "Signin", fn: testSignIn },
    { name: "Get Profile", fn: testGetProfile },
    { name: "Update Profile", fn: testUpdateProfile },
    { name: "Get Profile Stats", fn: testGetProfileStats },
    { name: "Check Permissions", fn: testCheckPermissions },
    { name: "Upload CCCD", fn: testUploadCCCD },
    { name: "Get KYC Info", fn: testGetKYCInfo },
    { name: "Add Address", fn: testAddAddress },
    { name: "Get Addresses", fn: testGetAddresses },
    { name: "Add Payment Method", fn: testAddPaymentMethod },
    { name: "Get Payment Methods", fn: testGetPaymentMethods },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const success = await test.fn();
      if (success) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name} failed with error:`, error.message);
      failed++;
    }
    console.log(""); // Empty line for readability
  }

  console.log("📊 Test Results:");
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(
    `📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`
  );
};

// Run tests
runTests().catch(console.error);
