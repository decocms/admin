import { connect } from "jsr:@deco/warp";
import * as colors from "jsr:@std/fmt/colors";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    let command;
    switch (Deno.build.os) {
      case "darwin":
        command = new Deno.Command("pbcopy", { stdin: "piped" });
        break;
      case "windows":
        command = new Deno.Command("clip", { stdin: "piped" });
        break;
      case "linux":
        command = new Deno.Command("xclip", {
          args: ["-selection", "clipboard"],
          stdin: "piped",
        });
        break;
      default:
        return false;
    }

    const child = command.spawn();
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(text));
    await writer.close();
    await child.status;
    return true;
  } catch {
    return false;
  }
}

async function isPortRunning(port: number): Promise<boolean> {
  try {
    const listener = Deno.listen({ port, hostname: "localhost" });
    await listener.close();
    return false;
  } catch {
    return true;
  }
}

async function waitForPort(port: number): Promise<void> {
  let isAvailable = await isPortRunning(port);
  if (isAvailable) {
    return;
  }

  console.log(colors.yellow(`Waiting for port ${port} to become available...`));

  while (!isAvailable) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    isAvailable = await isPortRunning(port);
  }

  console.log(colors.green(`Port ${port} is now available!`));
}

async function monitorPortAvailability(port: number) {
  while (true) {
    const isAvailable = await isPortRunning(port);
    if (!isAvailable) {
      console.log(
        colors.red(`⚠️ Warning: Port ${port} is no longer available!`),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
  }
}

async function register(port: number, domain: string) {
  const server = `wss://${domain}`;
  const localAddr = `http://${hostname}:${port}`;

  try {
    // Start port monitoring in the background
    monitorPortAvailability(port).catch((err) => {
      console.error("Port monitoring error:", err);
    });

    // Wait for port to become available before connecting
    await waitForPort(port);

    const tunnel = await connect({
      domain,
      localAddr,
      server,
      apiKey: Deno.env.get("DECO_TUNNEL_SERVER_TOKEN") ??
        "c309424a-2dc4-46fe-bfc7-a7c10df59477",
    });

    await tunnel.registered;
    const serverUrl = `https://${domain}`;
    const copied = await copyToClipboard(serverUrl);

    console.log(
      `\nTunnel started \n   -> 🌐 ${colors.bold("Preview")}: ${
        colors.cyan(serverUrl)
      }${copied ? colors.dim(" (copied to clipboard)") : ""}`,
    );

    await tunnel.closed;
  } catch (err) {
    console.log("Tunnel connection error, retrying in 500ms...", err);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return register(port, domain);
  }
}

export const link = async ({ port: p }: { port: number }) => {
  const port = p || 8000;

  // Save the host information to localStorage
  const key = `tunnel-${port}`;
  const saved = localStorage.getItem(key);
  const hostInfo = saved ? JSON.parse(saved) : {
    domain: `localhost-${crypto.randomUUID().slice(0, 6)}.deco.host`,
  };

  localStorage.setItem(key, JSON.stringify(hostInfo));
  const domain = hostInfo.domain;
  await register(port, domain);
};
