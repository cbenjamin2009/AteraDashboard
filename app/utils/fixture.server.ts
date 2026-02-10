import { readFile } from "node:fs/promises";
import path from "node:path";

export async function loadJsonFixture<T>(relativeOrAbsolutePath: string): Promise<T | null> {
  try {
    const resolved = path.isAbsolute(relativeOrAbsolutePath)
      ? relativeOrAbsolutePath
      : path.join(process.cwd(), relativeOrAbsolutePath);
    const raw = await readFile(resolved, "utf-8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Unable to load fixture ${relativeOrAbsolutePath}`, error);
    return null;
  }
}
