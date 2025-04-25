import app from "./src/app.ts";

Deno.serve({ port: 3001 }, app.fetch);
