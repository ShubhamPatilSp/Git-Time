import fs from 'fs';
import Groq from 'groq-sdk';

async function testGroq() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const keyMatch = envFile.match(/^GROQ_API_KEY=(.*)$/m);
    
    if (!keyMatch) {
      console.error("No GROQ_API_KEY found in .env.local!");
      return;
    }
    
    const key = keyMatch[1].trim();
    const groq = new Groq({ apiKey: key });

    console.log("Testing connection to Groq...");
    
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Reply with the word "Success" if you are online.' }],
      model: 'llama-3.1-8b-instant',
    });

    console.log("RESPONSE:", chatCompletion.choices[0]?.message?.content);
  } catch(e) {
    console.error("Test Failed:", e.message);
  }
}

testGroq();
