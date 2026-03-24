import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import fsExtra from 'fs-extra';

let cachedAi: GoogleGenerativeAI | null = null;

export async function generateBatchedMessages(
  files: { filePath: string; absolutePath: string }[],
  authorStyle: string
): Promise<{ file: string; message: string }[]> {
  try {
    if (!process.env.GEMINI_API_KEY) return [];

    if (!cachedAi) {
      cachedAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    const model = cachedAi.getGenerativeModel({ 
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

    const result = await model.generateContent(p);
    const responseText = result.response.text();
    return JSON.parse(responseText);
  } catch (error) {
    console.error("AI Batch Generation failed:", error);
    return []; // Fail open, so the classic generic string builder kicks in!
  }
}
