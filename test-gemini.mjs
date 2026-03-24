import fs from 'fs';

async function testFetch() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const keyMatch = envFile.match(/^GEMINI_API_KEY=(.*)$/m);
    const key = keyMatch[1].trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Hello, confirm you are online." }] }] })
    });
    
    const data = await res.json();
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

testFetch();
