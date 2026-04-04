import Groq from 'groq-sdk';
import fsExtra from 'fs-extra';

export async function generateBatchedMessages(
  files: { filePath: string; absolutePath: string }[],
  authorStyle: string
): Promise<{ file: string; message: string }[]> {
  try {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return [];
    
    const groq = new Groq({ apiKey: groqKey });

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

    const p = `You are a senior developer analyzing code and writing authentic git commit messages.
I am providing snippets from ${fileSnippets.length} files.
For each file, analyze the exact code snippet provided and generate ONE highly realistic, context-aware commit message.
The message MUST accurately describe what the code snippet is actually doing.
Do NOT output generic messages. Describe the specific functions, variables, or styles added in the snippet.

Style constraint: use the "${authorStyle}" style.
- If descriptive: Write a natural English phrase. (e.g. "added user authentication logic for the login modal")
- If terse: Write 2-3 lowercase words. (e.g. "auth modal")
- If conventional: Use conventional commits format based on the file name. (e.g. "feat(auth): implement login modal")

Return EXACTLY a JSON object with a single key "commits" containing an array of objects. 
Each object in the array MUST have the exact keys "file" and "message".

${fileSnippets.join('\n\n')}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: p }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2, // Low temperature for more predictable formatting
      response_format: { type: 'json_object' }
    });

    const responseText = chatCompletion.choices[0]?.message?.content;
    
    if (responseText) {
      try {
        // Strip out markdown code block backticks if present
        const cleanedText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        const jsonMatch = cleanedText.match(/(\{[\s\S]*\})/);
        const finalJsonText = jsonMatch ? jsonMatch[1] : cleanedText;
        
        const parsed = JSON.parse(finalJsonText);
        if (parsed.commits && Array.isArray(parsed.commits)) {
          return parsed.commits;
        }
      } catch (parseError: any) {
        console.error("Groq JSON Parse error:", parseError.message, "Raw Output:", responseText);
      }
    }

    return [];
  } catch (error) {
    console.error("AI Batch Generation failed completely:", error);
    return []; // Fail open, so the classic generic string builder kicks in!
  }
}
