import { Environment } from "./env.ts";
import { Result, success, fail } from "./result.ts";
import Anthropic from "@anthropic-ai/sdk";

export type ProjectFile = {
  path: string;
  content: string;
};

export type GeneratedProject = {
  files: ProjectFile[];
};

export async function generateProjectStructure(
  techStack: string,
  aboutProject: string,
  env: Environment,
): Promise<Result<GeneratedProject, string>> {
  const apiKey = env.anthropicApiKey;
  const prompt = `You are an expert software architect. Generate a complete, production-ready project structure based on the following requirements:

Tech Stack: ${techStack}
Project Description: ${aboutProject}

Please generate a complete project with:
1. All necessary files and folders
2. Working, production-ready code following best practices
3. Configuration files (package.json, tsconfig.json, etc. as needed)
4. A comprehensive README.md with setup instructions
5. Basic error handling and proper code structure

Return your response as a JSON object with this exact structure:
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "file content here"
    }
  ]
}

IMPORTANT: 
- Return ONLY valid JSON, no markdown code blocks or explanations
- Use relative paths (e.g., "src/index.js", "package.json")
- Include actual working code, not placeholders
- Make sure all files are properly formatted`;

  try {
    const anthropic = new Anthropic({
      apiKey: apiKey,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 64000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    if (!message.content || !message.content[0]) {
      return fail("Invalid response from Anthropic API");
    }

    const firstBlock = message.content[0];
    if (firstBlock.type !== "text") {
      return fail("Expected text response from Anthropic API");
    }

    const contentText = firstBlock.text.trim();

    // Try to extract JSON from the response
    let jsonText = contentText;

    // Remove markdown code blocks if present
    if (contentText.includes("```json")) {
      const match = contentText.match(/```json\s*([\s\S]*?)```/);
      if (match) {
        jsonText = match[1].trim();
      }
    } else if (contentText.includes("```")) {
      const match = contentText.match(/```\s*([\s\S]*?)```/);
      if (match) {
        jsonText = match[1].trim();
      }
    }

    try {
      const parsedProject = JSON.parse(jsonText) as GeneratedProject;

      if (!parsedProject.files || !Array.isArray(parsedProject.files)) {
        return fail("Invalid project structure from AI response");
      }

      // Validate each file
      for (const file of parsedProject.files) {
        if (typeof file.path !== "string" || typeof file.content !== "string") {
          return fail("Invalid file structure in AI response");
        }
      }

      return success(parsedProject);
    } catch (parseError) {
      return fail(
        `Failed to parse AI response as JSON: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`,
      );
    }
  } catch (error) {
    return fail(
      `Failed to call Anthropic API: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
