import { Result, success, fail } from "./result.ts";
import type { GeneratedProject } from "./ai-service.ts";

export async function createZipFromProject(
  project: GeneratedProject,
): Promise<Result<Uint8Array, string>> {
  try {
    // Create a temporary directory
    const tempDir = await Deno.makeTempDir({ prefix: "scaffold_" });

    try {
      // Create all files in the temporary directory
      for (const file of project.files) {
        const fullPath = `${tempDir}/${file.path}`;

        // Create parent directories if they don't exist
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf("/"));
        if (dirPath && dirPath !== tempDir) {
          await Deno.mkdir(dirPath, { recursive: true });
        }

        // Write the file
        await Deno.writeTextFile(fullPath, file.content);
      }

      // Create ZIP file using tar command (available on macOS)
      // We'll create a tar.gz file which is similar to zip
      const zipPath = `${tempDir}.tar.gz`;

      const process = new Deno.Command("tar", {
        args: ["-czf", zipPath, "-C", tempDir, "."],
        stdout: "piped",
        stderr: "piped",
      });

      const { code, stderr } = await process.output();

      if (code !== 0) {
        const errorMessage = new TextDecoder().decode(stderr);
        return fail(`Failed to create archive: ${errorMessage}`);
      }

      // Read the zip file
      const zipData = await Deno.readFile(zipPath);

      // Cleanup
      await Deno.remove(tempDir, { recursive: true });
      await Deno.remove(zipPath);

      return success(zipData);
    } catch (error) {
      // Cleanup on error
      try {
        await Deno.remove(tempDir, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    return fail(
      `File system error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
