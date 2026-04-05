import dotenv from 'dotenv';
dotenv.config({path: '.env.local'});
import Groq from 'groq-sdk';
import fs from 'fs';

async function test() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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

File: lib/ai.ts
Code Snippet:
import Groq from 'groq-sdk';
export async function generateBatchedMessages() {}
`;

  try {
    const c = await groq.chat.completions.create({
      messages: [{ role: 'user', content: p }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' }
    });
    console.log('Result:', c.choices[0].message.content);
  } catch(e) { 
    console.log('Groq Error:', e.message); 
  }
}
test();
