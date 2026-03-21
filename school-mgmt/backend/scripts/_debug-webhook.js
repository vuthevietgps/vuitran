/**
 * Debug: Test webhook + immediately check if conversation appears
 * Run: node scripts/_debug-webhook.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const API_BASE = `http://localhost:${process.env.PORT || 3000}`;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234567890';
const TS = Date.now();

async function main() {
  // Login as director
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'director.demo@school.local', password: DEMO_PASSWORD }),
  });
  const loginData = await loginRes.json();
  const cookies = loginRes.headers.get('set-cookie') || '';
  const accessToken = (cookies.match(/access_token=([^;]+)/) || [])[1];
  const xsrf = (cookies.match(/XSRF-TOKEN=([^;]+)/) || [])[1];
  const token = `access_token=${accessToken}; XSRF-TOKEN=${xsrf}`;
  console.log(`Director login: ${loginRes.status}, token=${accessToken ? 'OK' : 'FAIL'}`);

  // Create AdAccount
  const accRes = await fetch(`${API_BASE}/ads/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: token, 'X-XSRF-TOKEN': xsrf },
    body: JSON.stringify({ name: `DBG Acc ${TS}`, platform: 'FACEBOOK', platformAccountId: `act_dbg_${TS}` }),
  });
  const acc = await accRes.json();
  const adAccountId = acc._id || acc.id;
  console.log(`AdAccount: ${accRes.status}, id=${adAccountId}`);

  // Create AdGroup
  const grpRes = await fetch(`${API_BASE}/ads/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: token, 'X-XSRF-TOKEN': xsrf },
    body: JSON.stringify({ name: `DBG Group ${TS}`, adAccountId, platform: 'FACEBOOK', platformCampaignId: `dbg-cid-${TS}` }),
  });
  const grp = await grpRes.json();
  const adGroupId = grp._id || grp.id;
  console.log(`AdGroup: ${grpRes.status}, id=${adGroupId}, platformCampaignId=dbg-cid-${TS}`);

  // Create Fanpage
  const fpRes = await fetch(`${API_BASE}/chatbot/fanpages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: token, 'X-XSRF-TOKEN': xsrf },
    body: JSON.stringify({ name: `DBG Fanpage ${TS}`, platform: 'FACEBOOK', pageId: `dbg-page-${TS}`, adAccountId }),
  });
  const fp = await fpRes.json();
  const fanpageId = fp._id || fp.id;
  const pageId = fp.pageId;
  console.log(`Fanpage: ${fpRes.status}, id=${fanpageId}, pageId=${pageId}`);

  // Send webhook
  const whPayload = {
    object: 'page',
    entry: [{ id: pageId, messaging: [{
      sender: { id: `dbg-user-${TS}` },
      recipient: { id: pageId },
      timestamp: Date.now(),
      message: { mid: `mid_dbg_${TS}`, text: 'debug test' },
      referral: { ref: `dbg-cid-${TS}`, ad_id: `dbg-cid-${TS}`, source: 'ADS', type: 'OPEN_THREAD' },
    }] }],
  };
  const whRes = await fetch(`${API_BASE}/webhooks/facebook/${pageId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(whPayload),
  });
  const whText = await whRes.text();
  console.log(`Webhook: ${whRes.status} "${whText}"`);

  // Poll for conversation
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500));
    const cvRes = await fetch(`${API_BASE}/chatbot/conversations?fanpageId=${fanpageId}&platform=FACEBOOK`, {
      headers: { Cookie: token },
    });
    const cvData = await cvRes.json();
    const list = Array.isArray(cvData) ? cvData : (cvData.data || []);
    console.log(`Poll ${i+1}: found ${list.length} conversations for fanpage`);
    const match = list.find(c => c.platformUserId === `dbg-user-${TS}`);
    if (match) {
      console.log(`\nSUCCESS! Conversation found:`);
      console.log(`  _id         : ${match._id}`);
      console.log(`  adRefParam  : ${match.adRefParam}`);
      console.log(`  adGroupId   : ${match.adGroupId}`);
      console.log(`  status      : ${match.status}`);
      return;
    }
  }
  console.log('\nFAIL: conversation never appeared after webhook');
  
  // Additional debug: try calling handleIncomingCustomerMessage directly
  // by looking at what's in the DB conversations collection
  const { MongoClient } = require('mongodb');
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/school-mgmt';
  const c = await MongoClient.connect(uri);
  const db = c.db();
  const recentConvs = await db.collection('conversations')
    .find({ platformUserId: `dbg-user-${TS}` }, { projection: { _id:1, platformUserId:1, adRefParam:1, status:1 } })
    .toArray();
  console.log('DB conversations matching user:', JSON.stringify(recentConvs));
  await c.close();
}

main().catch(e => console.error('Error:', e.message, e.stack));
