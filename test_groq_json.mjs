import fs from 'fs';
import Groq from 'groq-sdk';

async function testGroq() {
  try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    const keyMatch = envFile.match(/^GROQ_API_KEY=(.*)$/m);
    const key = keyMatch[1].trim();
    const groq = new Groq({ apiKey: key });

    const p = `You are a legendary, hyper-realistic simulated developer generating completely undetectable backdated git commits.
I am providing snippets from 1 files.
For each file, generate ONE highly realistic, context-aware commit message.
Style instruction constraint: "descriptive".

Read the following snippets and return EXACTLY a JSON object with a single key "commits" containing an array of objects. 
Each object in the array MUST have the exact keys "file" and "message".
Example format:
{
  "commits": [
    { "file": "path/abc.js", "message": "feat: added parsing logic" }
  ]
}

File: test.js
Code Snippet:
\`\`\`
function test() {}
\`\`\`
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: p }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });

    console.log("RAW RESPONSE:", chatCompletion.choices[0]?.message?.content);
  } catch(e) {
    console.error("Test Failed:", e.message);
  }
}

testGroq();
