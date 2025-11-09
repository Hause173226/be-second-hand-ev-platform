// Test script đơn giản cho Transaction History API
// Chạy: node test-simple.js

const axios = require('axios');

// Cấu hình
const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TOKEN = process.env.JWT_TOKEN || 'YOUR_JWT_TOKEN_HERE';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'YOUR_ADMIN_TOKEN_HERE';

// Colors cho console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Test 1: User xem giao dịch của mình
async function testUserHistory() {
  log('\n📋 Test 1: User xem giao dịch của mình', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/user/history`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 10
      }
    });
    
    if (response.data.success) {
      log('✅ Success!', 'green');
      log(`   - Total transactions: ${response.data.data.length}`, 'green');
      log(`   - Pagination: page ${response.data.pagination.current}/${response.data.pagination.pages}`, 'green');
      log(`   - Total: ${response.data.pagination.total} transactions`, 'green');
      
      if (response.data.data.length > 0) {
        const first = response.data.data[0];
        log(`   - First transaction:`, 'green');
        log(`     * ID: ${first.id}`, 'green');
        log(`     * Type: ${first.type}`, 'green');
        log(`     * Status: ${first.status}`, 'green');
        log(`     * Listing: ${first.listing.title}`, 'green');
        log(`     * Amount: ${first.amount.total.toLocaleString('vi-VN')} VND`, 'green');
      }
    } else {
      log('❌ Failed: Response success is false', 'red');
    }
  } catch (error) {
    log('❌ Error:', 'red');
    if (error.response) {
      log(`   Status: ${error.response.status}`, 'red');
      log(`   Message: ${error.response.data?.message || error.message}`, 'red');
    } else {
      log(`   ${error.message}`, 'red');
    }
  }
}

// Test 2: User xem giao dịch với filter status
async function testUserHistoryWithStatus() {
  log('\n📋 Test 2: User xem giao dịch (filter: COMPLETED)', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/user/history`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        status: 'COMPLETED',
        page: 1,
        limit: 10
      }
    });
    
    if (response.data.success) {
      log('✅ Success!', 'green');
      log(`   - Completed transactions: ${response.data.data.length}`, 'green');
    } else {
      log('❌ Failed: Response success is false', 'red');
    }
  } catch (error) {
    log('❌ Error:', 'red');
    log(`   ${error.response?.data?.message || error.message}`, 'red');
  }
}

// Test 3: Admin xem tất cả giao dịch
async function testAdminHistory() {
  log('\n📋 Test 3: Admin xem tất cả giao dịch', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/admin/history`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        limit: 20
      }
    });
    
    if (response.data.success) {
      log('✅ Success!', 'green');
      log(`   - Total transactions: ${response.data.data.length}`, 'green');
      log(`   - Pagination: page ${response.data.pagination.current}/${response.data.pagination.pages}`, 'green');
      log(`   - Total: ${response.data.pagination.total} transactions`, 'green');
    } else {
      log('❌ Failed: Response success is false', 'red');
    }
  } catch (error) {
    if (error.response?.status === 403) {
      log('⚠️  Forbidden: Need admin/staff role', 'yellow');
    } else {
      log('❌ Error:', 'red');
      log(`   ${error.response?.data?.message || error.message}`, 'red');
    }
  }
}

// Test 4: Admin xem giao dịch với filter
async function testAdminHistoryWithFilter() {
  log('\n📋 Test 4: Admin xem giao dịch (filter: COMPLETED)', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/admin/history`, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      },
      params: {
        status: 'COMPLETED',
        page: 1,
        limit: 20
      }
    });
    
    if (response.data.success) {
      log('✅ Success!', 'green');
      log(`   - Completed transactions: ${response.data.data.length}`, 'green');
    } else {
      log('❌ Failed: Response success is false', 'red');
    }
  } catch (error) {
    if (error.response?.status === 403) {
      log('⚠️  Forbidden: Need admin/staff role', 'yellow');
    } else {
      log('❌ Error:', 'red');
      log(`   ${error.response?.data?.message || error.message}`, 'red');
    }
  }
}

// Test 5: Xem chi tiết giao dịch (cần appointmentId thực)
async function testTransactionDetails(appointmentId) {
  if (!appointmentId || appointmentId === 'APPOINTMENT_ID') {
    log('\n📋 Test 5: Xem chi tiết giao dịch - SKIPPED (cần appointmentId thực)', 'yellow');
    return;
  }
  
  log('\n📋 Test 5: Xem chi tiết giao dịch', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/api/transactions/${appointmentId}`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      log('✅ Success!', 'green');
      log(`   - Appointment ID: ${response.data.data.appointment?._id}`, 'green');
      log(`   - Status: ${response.data.data.appointment?.status}`, 'green');
    } else {
      log('❌ Failed: Response success is false', 'red');
    }
  } catch (error) {
    log('❌ Error:', 'red');
    log(`   ${error.response?.data?.message || error.message}`, 'red');
  }
}

// Run all tests
async function runAllTests() {
  log('🧪 Testing Transaction History API (Simple)...', 'blue');
  log(`📍 Base URL: ${BASE_URL}`, 'blue');
  log(`🔑 Token: ${TOKEN.substring(0, 20)}...`, 'blue');
  
  if (TOKEN === 'YOUR_JWT_TOKEN_HERE') {
    log('\n⚠️  WARNING: Please set JWT_TOKEN environment variable!', 'yellow');
    log('   Example: JWT_TOKEN=your_token node test-simple.js', 'yellow');
    return;
  }
  
  await testUserHistory();
  await testUserHistoryWithStatus();
  await testAdminHistory();
  await testAdminHistoryWithFilter();
  // await testTransactionDetails('APPOINTMENT_ID'); // Uncomment và thay bằng appointmentId thực
  
  log('\n✅ All tests completed!', 'green');
}

// Run tests
runAllTests().catch(console.error);

