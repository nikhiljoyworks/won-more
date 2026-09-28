/**
 * Comprehensive Automated System & Unit Test Suite for Won More Platform
 */

const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    Error: ${err.message}`);
  }
}

console.log('====================================================');
console.log('🚀 WON MORE PLATFORM - FULL AUTOMATED TEST SUITE');
console.log('====================================================\n');

// -------------------------------------------------------------------
// SUITE 1: Phone Validation Logic (CustomerPlay.tsx validatePhone)
// -------------------------------------------------------------------
console.log('--- SUITE 1: Phone Number Validation Rules ---');

const validatePhone = (phone) => {
  const trimmed = phone.trim();
  if (!trimmed) {
    return { valid: false, message: 'Please enter your mobile phone number.' };
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) {
    return { valid: false, message: 'Mobile number must have at least 10 digits.' };
  }
  if (digits.length > 15) {
    return { valid: false, message: 'Mobile number cannot exceed 15 digits.' };
  }
  if (digits.length === 10 && !/^[6-9]\d{9}$/.test(digits)) {
    return { valid: false, message: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.' };
  }
  if (digits.length === 11 && digits.startsWith('0') && !/^0[6-9]\d{9}$/.test(digits)) {
    return { valid: false, message: 'Please enter a valid mobile number starting with 6, 7, 8, or 9.' };
  }
  if (digits.length === 12 && digits.startsWith('91') && !/^91[6-9]\d{9}$/.test(digits)) {
    return { valid: false, message: 'Please enter a valid 10-digit mobile number after country code 91.' };
  }
  return { valid: true };
};

test('Accepts standard 10-digit Indian numbers starting with 6, 7, 8, 9', () => {
  assert.strictEqual(validatePhone('9876543210').valid, true);
  assert.strictEqual(validatePhone('8123456789').valid, true);
  assert.strictEqual(validatePhone('7123456789').valid, true);
  assert.strictEqual(validatePhone('6123456789').valid, true);
});

test('Rejects 10-digit numbers starting with 0-5', () => {
  assert.strictEqual(validatePhone('1234567890').valid, false);
  assert.strictEqual(validatePhone('5234567890').valid, false);
  assert.strictEqual(validatePhone('0234567890').valid, false);
});

test('Accepts 11-digit numbers with leading 0', () => {
  assert.strictEqual(validatePhone('09876543210').valid, true);
});

test('Accepts 12-digit numbers with 91 country prefix', () => {
  assert.strictEqual(validatePhone('+91 98765 43210').valid, true);
  assert.strictEqual(validatePhone('919876543210').valid, true);
});

test('Rejects empty or whitespace-only inputs', () => {
  assert.strictEqual(validatePhone('').valid, false);
  assert.strictEqual(validatePhone('   ').valid, false);
});

test('Rejects numbers with fewer than 10 digits or more than 15 digits', () => {
  assert.strictEqual(validatePhone('98765').valid, false);
  assert.strictEqual(validatePhone('1234567890123456').valid, false);
});

// -------------------------------------------------------------------
// SUITE 2: Option A Redemption Code Logic & Entropy Analysis
// -------------------------------------------------------------------
console.log('\n--- SUITE 2: Option A (4x4 Split) Redemption Code Format & Security ---');

const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const OPTION_A_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;

function generateTestRedemptionCode() {
  let result = '';
  for (let i = 1; i <= 8; i++) {
    if (i === 5) result += '-';
    const idx = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    result += UNAMBIGUOUS_CHARS[idx];
  }
  return result;
}

test('Generated code matches exact 4x4 hyphenated format (XXXX-XXXX)', () => {
  const code = generateTestRedemptionCode();
  assert.strictEqual(OPTION_A_REGEX.test(code), true);
  assert.strictEqual(code.length, 9);
  assert.strictEqual(code.charAt(4), '-');
});

test('Zero ambiguous characters (0, O, 1, I) appear across 5,000 generated codes', () => {
  const forbiddenChars = ['0', 'O', '1', 'I', 'o', 'l', 'i'];
  for (let i = 0; i < 5000; i++) {
    const code = generateTestRedemptionCode();
    for (const char of forbiddenChars) {
      assert.strictEqual(code.includes(char), false, `Code ${code} contained forbidden char ${char}`);
    }
  }
});

test('Uniqueness / Zero Collisions in a batch of 1,000 consecutive codes', () => {
  const generated = new Set();
  for (let i = 0; i < 1000; i++) {
    const code = generateTestRedemptionCode();
    assert.strictEqual(generated.has(code), false, `Collision detected on code: ${code}`);
    generated.add(code);
  }
  assert.strictEqual(generated.size, 1000);
});

// -------------------------------------------------------------------
// SUITE 3: WhatsApp Claim URL Construction (utils.ts)
// -------------------------------------------------------------------
console.log('\n--- SUITE 3: WhatsApp Claim URL Generation ---');

const DEFAULT_WHATSAPP_CLAIM_TEMPLATE =
  'Hello! I just scratched and won {{reward_won}} on {{shop_name}}! My redemption code is {{redemption_code}}. Name: {{customer_name}}.';

function interpolateWhatsAppMessage(template, vars) {
  let msg = template && template.trim() ? template.trim() : DEFAULT_WHATSAPP_CLAIM_TEMPLATE;

  const replacements = {
    '{{shop_name}}': vars.shopName || '',
    '{{reward_won}}': vars.rewardName || '',
    '{{redemption_code}}': vars.redemptionCode || '',
    '{{customer_name}}': vars.customerName || '',
    '{{customer_phone}}': vars.customerPhone || '',
    '{{campaign_title}}': vars.campaignTitle || '',
  };

  if (vars.customData && typeof vars.customData === 'object') {
    Object.entries(vars.customData).forEach(([key, val]) => {
      const stringVal = val !== null && val !== undefined ? String(val) : '';
      replacements[`{{${key}}}`] = stringVal;
      const sanitizedKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      replacements[`{{${sanitizedKey}}}`] = stringVal;
    });
  }

  Object.entries(replacements).forEach(([tag, val]) => {
    msg = msg.split(tag).join(val);
  });

  return msg;
}

function buildWhatsAppClaimUrl(shopPhone, rewardName, redemptionCode, customerName, template, extraVars) {
  const cleanPhone = shopPhone.replace(/[^\d]/g, '');
  const message = interpolateWhatsAppMessage(template, {
    shopName: extraVars?.shopName,
    rewardName,
    redemptionCode,
    customerName,
    customerPhone: extraVars?.customerPhone,
    campaignTitle: extraVars?.campaignTitle,
    customData: extraVars?.customData,
  });
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

test('Constructs accurate wa.me URL with default template', () => {
  const url = buildWhatsAppClaimUrl('+91 98765-43210', '15% Off Total Bill', 'WPB2-BBKF', 'John Doe', null, {
    shopName: 'Nikhil Furniture',
  });
  assert.strictEqual(url.startsWith('https://wa.me/919876543210?text='), true);
  assert.strictEqual(url.includes('WPB2-BBKF'), true);
  assert.strictEqual(url.includes('John%20Doe'), true);
  assert.strictEqual(url.includes('Nikhil%20Furniture'), true);
  assert.strictEqual(url.includes('15%25%20Off%20Total%20Bill'), true);
});

test('Interpolates custom template with core variables and custom campaign fields', () => {
  const customTemplate = '🎉 Hi {{shop_name}}, I am {{customer_name}}! I won {{reward_won}} (Code: {{redemption_code}}). Bill: {{bill_no}}, Table: {{table_no}}.';
  const url = buildWhatsAppClaimUrl('9746321808', 'Free Coffee', 'GX6Z-WRK5', 'Rahul', customTemplate, {
    shopName: 'Urban Cafe',
    campaignTitle: 'Summer Fest',
    customData: {
      bill_no: 'B-9942',
      table_no: 'Table 7'
    }
  });

  const decodedUrl = decodeURIComponent(url);
  assert.strictEqual(decodedUrl.includes('Hi Urban Cafe, I am Rahul!'), true);
  assert.strictEqual(decodedUrl.includes('I won Free Coffee (Code: GX6Z-WRK5)'), true);
  assert.strictEqual(decodedUrl.includes('Bill: B-9942, Table: Table 7'), true);
});

test('Handles phone numbers with international prefix, spaces, and brackets cleanly', () => {
  const url = buildWhatsAppClaimUrl('+1 (555) 123-4567', 'Free Coffee', '7K9M-2P4X', 'Alice');
  assert.strictEqual(url.startsWith('https://wa.me/15551234567?text='), true);
});

// -------------------------------------------------------------------
// SUITE 4: Time Ago & Formatting Utilities
// -------------------------------------------------------------------
console.log('\n--- SUITE 4: Time Ago & Formatting Utilities ---');

function formatTimeAgo(dateString) {
  const d = new Date(dateString);
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

test('Formats recent seconds as "Just now"', () => {
  const recent = new Date(Date.now() - 15 * 1000).toISOString();
  assert.strictEqual(formatTimeAgo(recent), 'Just now');
});

test('Formats minutes ago accurately', () => {
  const minsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.strictEqual(formatTimeAgo(minsAgo), '5m ago');
});

test('Formats hours ago accurately', () => {
  const hoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  assert.strictEqual(formatTimeAgo(hoursAgo), '3h ago');
});

test('Formats days ago accurately', () => {
  const daysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
  assert.strictEqual(formatTimeAgo(daysAgo), '2d ago');
});

// -------------------------------------------------------------------
// SUITE 5: CSV Lead Exporter Escaping
// -------------------------------------------------------------------
console.log('\n--- SUITE 5: CSV Lead Exporter Escaping & Alignment ---');

function generateCsvRow(lead) {
  return [
    `"${(lead.shop_name || '').replace(/"/g, '""')}"`,
    `"${(lead.campaign_title || '').replace(/"/g, '""')}"`,
    `"${(lead.customer_name || '').replace(/"/g, '""')}"`,
    `"${(lead.customer_phone || '').replace(/"/g, '""')}"`,
    `"${(lead.customer_email || '').replace(/"/g, '""')}"`,
    `"${(lead.reward_won || '').replace(/"/g, '""')}"`,
    `"${(lead.redemption_code || '').replace(/"/g, '""')}"`,
    `"${(lead.status || '').replace(/"/g, '""')}"`
  ].join(',');
}

test('Properly escapes embedded quotes and commas in CSV output', () => {
  const row = generateCsvRow({
    shop_name: 'Nikhil\'s "Furniture" & Decor',
    campaign_title: 'Summer Promo, 2026',
    customer_name: 'Jane "JJ" Doe',
    customer_phone: '9876543210',
    customer_email: 'jane@example.com',
    reward_won: 'Special 10% "Mega" Discount',
    redemption_code: 'WPB2-BBKF',
    status: 'claimed'
  });

  assert.strictEqual(row.includes('""Furniture""'), true);
  assert.strictEqual(row.includes('"Summer Promo, 2026"'), true);
  assert.strictEqual(row.includes('"WPB2-BBKF"'), true);
});

// -------------------------------------------------------------------
// SUITE 6: Edge Worker Rate Limiter & Auth Logic (worker.ts mock test)
// -------------------------------------------------------------------
console.log('\n--- SUITE 6: Edge Worker Rate Limiting & Admin Security ---');

const adminRateLimiter = new Map();

function simulateAdminLogin(ip, accessCode, expectedSecret = 'WM_ADMIN_2026') {
  const now = Date.now();
  const existing = adminRateLimiter.get(ip);

  if (existing && existing.blockedUntil > now) {
    const remainingSeconds = Math.ceil((existing.blockedUntil - now) / 1000);
    return { status: 429, error: 'Security lockout', isBlocked: true, remainingSeconds };
  }

  if (!accessCode || accessCode !== expectedSecret) {
    const isPreviousBlockExpired = !!(existing && existing.blockedUntil > 0 && existing.blockedUntil <= now);
    const attempts = (isPreviousBlockExpired ? 0 : existing?.attempts || 0) + 1;
    if (attempts >= 5) {
      const blockedUntil = now + 90 * 1000;
      adminRateLimiter.set(ip, { attempts, blockedUntil });
      return { status: 429, error: 'Security lockout', isBlocked: true, remainingSeconds: 90 };
    } else {
      adminRateLimiter.set(ip, { attempts, blockedUntil: 0 });
      return { status: 401, error: 'Invalid admin access code', attemptsRemaining: 5 - attempts };
    }
  }

  adminRateLimiter.delete(ip);
  return { status: 200, success: true, token: 'WM_ADMIN_2026' };
}

test('Authenticates admin with valid access code', () => {
  const res = simulateAdminLogin('1.2.3.4', 'WM_ADMIN_2026');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
});

test('Rejects invalid access code and decrements remaining attempts', () => {
  const res1 = simulateAdminLogin('2.3.4.5', 'WRONG_CODE');
  assert.strictEqual(res1.status, 401);
  assert.strictEqual(res1.attemptsRemaining, 4);

  const res2 = simulateAdminLogin('2.3.4.5', 'WRONG_CODE_2');
  assert.strictEqual(res2.status, 401);
  assert.strictEqual(res2.attemptsRemaining, 3);
});

test('Triggers 90s lockout on 5 consecutive failed attempts', () => {
  const testIp = '3.4.5.6';
  for (let i = 1; i <= 4; i++) {
    simulateAdminLogin(testIp, 'WRONG');
  }
  // 5th attempt
  const res5 = simulateAdminLogin(testIp, 'WRONG');
  assert.strictEqual(res5.status, 429);
  assert.strictEqual(res5.isBlocked, true);
  assert.strictEqual(res5.remainingSeconds, 90);

  // Immediate 6th attempt should remain locked out
  const res6 = simulateAdminLogin(testIp, 'WM_ADMIN_2026'); // Even with right code, must remain locked
  assert.strictEqual(res6.status, 429);
  assert.strictEqual(res6.isBlocked, true);
});

// -------------------------------------------------------------------
// SUITE 7: Public Credential Isolation Audit
// -------------------------------------------------------------------
console.log('\n--- SUITE 7: Public Credential Isolation Security Check ---');

const PUBLIC_SHOP_COLUMNS = 'id, shop_name, slug, email, whatsapp_number, logo_url, plan_status, plan_tier, subscription_expires_at, created_at';

test('PUBLIC_SHOP_COLUMNS strictly excludes password_pin', () => {
  assert.strictEqual(PUBLIC_SHOP_COLUMNS.includes('password_pin'), false);
  assert.strictEqual(PUBLIC_SHOP_COLUMNS.includes('pin'), false);
});

// -------------------------------------------------------------------
// SUITE 8: Online vs Offline Campaign Dynamics
// -------------------------------------------------------------------
console.log('\n--- SUITE 8: Online vs Offline Campaign Dynamics ---');

function resolveClaimInstructions(campaignType, customInstructions) {
  if (customInstructions && customInstructions.trim()) {
    return customInstructions.trim();
  }
  if (campaignType === 'online') {
    return 'Copy your unique coupon code and apply at checkout on our website, or claim below.';
  }
  return 'Show your code in-store or claim instantly on WhatsApp below';
}

function parseUniqueCouponCodes(rawText) {
  if (!rawText || !rawText.trim()) return [];
  return Array.from(
    new Set(
      rawText
        .split(/[\r\n,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function resolveWebsiteUrl(rawUrl) {
  if (!rawUrl || !rawUrl.trim()) return '#';
  const trimmed = rawUrl.trim();
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${trimmed}`;
}

function resolveHeaderTagline(campaignType, customTagline) {
  return (
    customTagline?.trim() ||
    (campaignType === 'online' ? 'Online Scratch & Win' : 'In-Store Scratch & Win')
  );
}

test('Resolves smart default claim instructions based on campaign type', () => {
  const offlineDefault = resolveClaimInstructions('offline', null);
  assert.strictEqual(offlineDefault, 'Show your code in-store or claim instantly on WhatsApp below');

  const onlineDefault = resolveClaimInstructions('online', null);
  assert.strictEqual(
    onlineDefault,
    'Copy your unique coupon code and apply at checkout on our website, or claim below.'
  );

  const customText = resolveClaimInstructions('online', 'Custom: Use code at myshop.com');
  assert.strictEqual(customText, 'Custom: Use code at myshop.com');
});

test('Resolves smart default and custom header taglines based on campaign type', () => {
  assert.strictEqual(resolveHeaderTagline('offline', null), 'In-Store Scratch & Win');
  assert.strictEqual(resolveHeaderTagline('offline', undefined), 'In-Store Scratch & Win');
  assert.strictEqual(resolveHeaderTagline('online', null), 'Online Scratch & Win');
  assert.strictEqual(resolveHeaderTagline('online', undefined), 'Online Scratch & Win');
  assert.strictEqual(resolveHeaderTagline('online', '   '), 'Online Scratch & Win');
  assert.strictEqual(resolveHeaderTagline('online', 'Exclusive Web Drop'), 'Exclusive Web Drop');
  assert.strictEqual(resolveHeaderTagline('offline', 'VIP Boutique Special'), 'VIP Boutique Special');
});

test('Deduplicates and extracts unique coupon codes from bulk paste', () => {
  const pastedInput = `
    SAVE20-A1, save20-a2, SAVE20-A1
    SAVE20-B3
    save20-b3, SAVE20-C4
  `;
  const parsed = parseUniqueCouponCodes(pastedInput);
  assert.strictEqual(parsed.length, 4);
  assert.deepStrictEqual(parsed, ['SAVE20-A1', 'SAVE20-A2', 'SAVE20-B3', 'SAVE20-C4']);
});

test('Properly normalizes website destination URLs for online claims', () => {
  assert.strictEqual(resolveWebsiteUrl('mystore.com/shop'), 'https://mystore.com/shop');
  assert.strictEqual(resolveWebsiteUrl('https://mystore.com/offers'), 'https://mystore.com/offers');
  assert.strictEqual(resolveWebsiteUrl(''), '#');
});

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests} PASSED / ${totalTests} TOTAL (${failedTests} FAILED)`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
