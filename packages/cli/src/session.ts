// Utility functions for saving and reading session data securely
import z from "zod";
import { createClient } from "./supabase.ts";

const SessionSchema = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  workspace: z.string().optional(),
});

export type SessionData = z.infer<typeof SessionSchema>;

/**
 * Path to the session file in the user's home directory.
 */
function getSessionPath(): string {
  const homeDir = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return `${homeDir}/.deco_auth_session.json`;
}

/**
 * Save session data securely to the filesystem.
 * @param data The session data to save (object).
 */
export async function saveSession(data: SessionData) {
  const sessionPath = getSessionPath();
  await Deno.writeTextFile(sessionPath, JSON.stringify(data, null, 2));
  // Set file permissions to 600 (read/write for user only)
  await Deno.chmod(sessionPath, 0o600);
}

/**
 * Read session data from the filesystem.
 * @returns The parsed session data, or null if not found or error.
 */
export async function readSession(): Promise<SessionData | null> {
  const sessionPath = getSessionPath();
  const content = await Deno.readTextFile(sessionPath);
  return SessionSchema.safeParse(JSON.parse(content)).data ?? null;
}

export async function deleteSession() {
  const sessionPath = getSessionPath();

  const { client } = createClient();

  await Deno.remove(sessionPath)
    .catch(() => console.warn("Session file not found"));

  await client.auth.signOut();
}

export async function getSessionCookies(): Promise<string> {
  const session = await readSession();

  if (!session) {
    throw new Error("Session not found. Please login again.");
  }

  // Extract tokens from session
  const { access_token, refresh_token } = session;

  if (!access_token || !refresh_token) {
    throw new Error("Session expired. Please login again.");
  }

  // Create Supabase client (no cookies needed for this local op)
  const { client: supabase, responseHeaders } = createClient();

  const { data, error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    throw new Error("Session expired. Please login again.");
  }

  await saveSession(data.session ?? {});

  const setCookie = responseHeaders.getSetCookie();

  if (!setCookie.length) {
    throw new Error("Session expired. Please login again.");
  }

  const cookies = setCookie.map((cookie) => cookie.split(";")[0]).join("; ");

  return cookies;
}

export async function getSessionToken(): Promise<string> {
  const session = await readSession();

  if (!session) {
    throw new Error("Session not found. Please login again.");
  }

  // Extract tokens from session
  const { access_token, refresh_token } = session;

  if (!access_token || !refresh_token) {
    throw new Error("Session expired. Please login again.");
  }

  return access_token;
}
