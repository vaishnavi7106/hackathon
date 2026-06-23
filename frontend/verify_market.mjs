import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

const BASE = 'http://localhost:5181';
const SHOTS = 'verify_screenshots';
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

let step = 0;
async function shot(name) {
  step++;
  const path = `${SHOTS}/${String(step).padStart(2,'0')}_${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`📸 ${path}`);
}

// ── Register + login ──────────────────────────────────────────────────────────
console.log('\n── Registering test user ──');
const res = await fetch(`http://localhost:8000/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '9000000001',
    pin: '1234',
    name: 'Verify Bot',
    district: 'Coimbatore',
    primary_crop: 'Tomato',
    language_preference: 'en',
  }),
}).catch(async () =>
  fetch(`http://localhost:8000/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '9000000001', pin: '1234' }),
  })
);
const auth = await res.json();
const token = auth.token;
if (!token) { console.error('❌ No token:', JSON.stringify(auth)); process.exit(1); }
console.log('✅ Authenticated, farmerId:', auth.farmer_id);

// Seed token into localStorage via page eval
await page.goto(BASE);
await page.evaluate(({ token, farmerId }) => {
  const store = {
    state: { farmerId, token, expiresAt: new Date(Date.now() + 7*86400000).toISOString(), profile: {
      farmer_id: farmerId, district: 'Coimbatore', primary_crop: 'Tomato',
      storage_facility: 'home', language: 'en', phone: null, name: 'Verify Bot',
      crops: [], latest_soil_test: null, created_at: '', updated_at: ''
    }},
    version: 0
  };
  localStorage.setItem('uzhavar-farmer', JSON.stringify(store));
}, { token, farmerId: auth.farmer_id });
await page.reload();
await page.waitForTimeout(1000);
await shot('home_page');

// ── Navigate to /market ────────────────────────────────────────────────────────
console.log('\n── Step 1: Navigate to Market tab ──');
await page.goto(`${BASE}/market`);
await page.waitForTimeout(1000);
await shot('screen1_market_home');

// Count crop cards
const cropCards = await page.locator('button').filter({ hasText: /Tomato|Onion|Banana|Bhindi|Bitter|Cabbage|Coconut|Chilli|Mint|Pumpkin/ }).count();
console.log(`✅ Crop cards visible: ${cropCards} (expect 10)`);

// ── Select Tomato ──────────────────────────────────────────────────────────────
console.log('\n── Step 2: Select Tomato ──');
await page.locator('button').filter({ hasText: /Tomato/ }).first().click();
await page.waitForTimeout(300);
await shot('screen1_tomato_selected');
const selected = await page.locator('button').filter({ hasText: /Tomato/ }).first().evaluate(el =>
  el.className.includes('primary') || el.className.includes('ring')
);
console.log(`✅ Tomato selected (teal border): ${selected}`);

// ── Verify Home storage selected ───────────────────────────────────────────────
console.log('\n── Step 3: Home storage ──');
const homeBtn = await page.locator('button').filter({ hasText: /Home/ }).first();
const homeSelected = await homeBtn.evaluate(el => el.className.includes('primary'));
console.log(`✅ Home storage pre-selected: ${homeSelected}`);

// ── Click Check Market Price ───────────────────────────────────────────────────
console.log('\n── Step 4: Click Check Market Price ──');
await page.locator('button').filter({ hasText: /Check Market Price/ }).click();
await shot('screen1_loading');
// Wait for result screen
await page.waitForSelector('text=SELL NOW', { timeout: 15000 }).catch(() =>
  page.waitForSelector('text=HOLD', { timeout: 5000 }).catch(() => null)
);
await page.waitForTimeout(500);
await shot('screen2_result');

// Check SELL/HOLD card
const hasSell = await page.locator('text=SELL NOW').count();
const hasHold = await page.locator('text=HOLD').count();
console.log(`✅ SELL NOW: ${hasSell > 0}, HOLD: ${hasHold > 0}`);

// Check chart
const chartSvg = await page.locator('svg').count();
console.log(`✅ SVG elements (chart): ${chartSvg}`);
await shot('screen2_chart');

// Scroll to mandis
await page.evaluate(() => window.scrollBy(0, 400));
await page.waitForTimeout(300);
await shot('screen2_mandis');

const mandiItems = await page.locator('.rounded-xl').filter({ hasText: /km/ }).count();
console.log(`✅ Mandi rows visible: ${mandiItems} (expect 3)`);

// ── Back to Screen 1 ──────────────────────────────────────────────────────────
console.log('\n── Step 5: Check another crop ──');
await page.evaluate(() => window.scrollTo(0, 99999));
await page.waitForTimeout(300);
await shot('screen2_bottom');
await page.locator('button').filter({ hasText: /Check another crop/ }).click();
await page.waitForTimeout(500);
await shot('screen1_back');
const backOnHome = await page.locator('text=Select Crop').count() + await page.locator('text=பயிர் தேர்வு').count();
console.log(`✅ Back on Screen 1: ${backOnHome > 0}`);

// ── Cache note ─────────────────────────────────────────────────────────────────
console.log('\n── Step 6: Cache note after re-selecting Tomato ──');
await page.locator('button').filter({ hasText: /Tomato/ }).first().click();
await page.waitForTimeout(400);
await shot('screen1_cache_note');
const cacheNote = await page.locator('text=/Last checked|கடைசியாக/').count();
console.log(`✅ Cache note visible: ${cacheNote > 0}`);

// ── Language test (Tamil) ──────────────────────────────────────────────────────
console.log('\n── Step 7: Tamil language test ──');
await page.evaluate(({ token, farmerId }) => {
  const store = {
    state: { farmerId, token, expiresAt: new Date(Date.now() + 7*86400000).toISOString(), profile: {
      farmer_id: farmerId, district: 'Coimbatore', primary_crop: 'Tomato',
      storage_facility: 'home', language: 'ta', phone: null, name: 'Verify Bot',
      crops: [], latest_soil_test: null, created_at: '', updated_at: ''
    }},
    version: 0
  };
  localStorage.setItem('uzhavar-farmer', JSON.stringify(store));
}, { token, farmerId: auth.farmer_id });
await page.reload();
await page.goto(`${BASE}/market`);
await page.waitForTimeout(800);
await shot('screen1_tamil');
const tamilName = await page.locator('text=தக்காளி').count();
console.log(`✅ Tamil crop names visible (தக்காளி): ${tamilName > 0}`);

await browser.close();
console.log('\n✅ All steps complete. Screenshots in verify_screenshots/');
