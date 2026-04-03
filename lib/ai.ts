import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fsExtra from 'fs-extra';

let cachedAi: GoogleGenerativeAI | null = null;
let currentKeyIndex = 0;

export async function generateBatchedMessages(
  files: { filePath: string; absolutePath: string }[],
  authorStyle: string
): Promise<{ file: string; message: string }[]> {
  try {
    const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
    if (!rawKeys) return [];
    
    // Support single key or comma-separated keys
    const apiKeys = rawKeys.split(',').map(k => k.trim()).filter(k => k);
    if (apiKeys.length === 0) return [];

    const fileSnippets = [];
    for (const f of files) {
      try {
        const stats = await fsExtra.stat(f.absolutePath);
        if (stats.isDirectory() || stats.size > 1024 * 1024) continue; // Skip huge files
        const content = await fsExtra.readFile(f.absolutePath, 'utf8');
        // Take just the first 30 lines for context
        const snippet = content.split('\n').slice(0, 30).join('\n');
        fileSnippets.push(`File: ${f.filePath}\nCode Snippet:\n\`\`\`\n${snippet}\n\`\`\``);
      } catch {
        continue;
      }
    }

    if (fileSnippets.length === 0) return [];

    const p = `You are a legendary, hyper-realistic simulated developer generating completely undetectable backdated git commits.
I am providing snippets from ${fileSnippets.length} files.
For each file, generate ONE highly realistic, context-aware commit message reflecting what someone writing this code would write.
DO NOT use generic "update file" strings. If it's a CSS file, write "refactor layout grid". If it's a component, "implement primary auth flow in component".

Style instruction constraint: "${authorStyle}" (if descriptive = a full sentence, if terse = short 2-3 words lowercase, if conventional = feat(scope): message).

Read the following snippets and return EXACTLY a JSON array matching the required schema.

${fileSnippets.join('\n\n')}
`;

    let lastError = null;

    // Try keys sequentially, starting from the current active key index
    for (let i = 0; i < apiKeys.length; i++) {
        // We use modulo to wrap around seamlessly if we hit the end
        const activeIndex = (currentKeyIndex + i) % apiKeys.length;
        const currentKey = apiKeys[activeIndex];

        try {
            const ai = new GoogleGenerativeAI(currentKey);
            const model = ai.getGenerativeModel({ 
              model: 'gemini-2.5-flash',
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: SchemaType.ARRAY,
                  items: {
                    type: SchemaType.OBJECT,
                    properties: {
                      file: { type: SchemaType.STRING },
                      message: { type: SchemaType.STRING }
                    },
                    required: ["file", "message"]
                  }
                }
              }
            });

            const result = await model.generateContent(p);
            const responseText = result.response.text();
            
            // If successful, we update our index so we continue using this good key
            currentKeyIndex = activeIndex; 
            return JSON.parse(responseText);
        } catch (error: any) {
            console.error(`API Key at index ${activeIndex} failed. Trying next if available. Error:`, error.message);
            lastError = error;
            // If it's the last key, it will throw outside the loop
        }
    }

    throw lastError; // If all keys fail, throw the last error
  } catch (error) {
    console.error("AI Batch Generation failed completely:", error);
    return []; // Fail open, so the classic generic string builder kicks in!
  }
}
