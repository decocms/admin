import { walk } from "https://deno.land/std/fs/mod.ts";

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

async function renameFiles() {
  try {
    for await (const entry of walk(".", {
      exts: [".ts", ".tsx"],
      includeDirs: false,
      skip: [/node_modules/],
    })) {
      const path = entry.path;
      const fileName = path.split("/").pop() || "";
      const kebabCaseName = toKebabCase(fileName);
      
      if (fileName !== kebabCaseName) {
        const newPath = path.replace(fileName, kebabCaseName);
        console.log(`Renaming: ${path} -> ${newPath}`);
        await Deno.rename(path, newPath);
      }
    }
    console.log("File renaming completed!");
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("An unknown error occurred");
    }
  }
}

// Run the script
renameFiles(); 