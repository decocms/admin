import { Command } from "@cliffy/command";
import { loginCommand } from "./src/login.ts";
import { deploy } from "./src/hosting/deploy.ts";
import { listApps } from "./src/hosting/list.ts";
import { deleteSession, getSessionToken } from "./src/session.ts";
import { whoamiCommand } from "./src/whoami.ts";
import { readApp } from "./src/hosting/read.ts";

// Placeholder for login command implementation
const login = new Command()
  .description("Log in to deco.chat and retrieve tokens for CLI usage.")
  .action(loginCommand);

// Placeholder for logout command implementation
const logout = new Command()
  .description("Log out of deco.chat and remove local session data.")
  .action(async () => {
    try {
      await deleteSession();
      console.log("Logged out successfully. Session data removed.");
    } catch (e) {
      if (e instanceof Error) {
        console.error("Failed to log out:", e.message);
      } else {
        console.error("Failed to log out:", String(e));
      }
    }
  });

// Placeholder for whoami command implementation
const whoami = new Command()
  .description("Print info about the current session.")
  .action(whoamiCommand);

// Placeholder for hosting list command implementation
const hostingList = new Command()
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await listApps({ ...args, authCookie });
  });

const hostingRead = new Command()
  .description("Read a given app in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .option("-a, --app <app:string>", "App name", { required: true })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await readApp(args.workspace, authCookie, args.app);
  });

// Placeholder for hosting deploy command implementation
const hostingDeploy = new Command()
  .description("Deploy the current directory into the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: true,
  })
  .option("-a, --app <app:string>", "App name", { required: true })
  .action(async (args) => {
    const authCookie = await getSessionToken();
    await deploy({ ...args, appSlug: args.app, authCookie });
  });

// Hosting parent command
const hosting = new Command()
  .description("Manage hosting apps in a workspace.")
  .command("list", hostingList)
  .command("deploy", hostingDeploy)
  .command("read", hostingRead);

// Main CLI
await new Command()
  .name("deco")
  .version("0.1.0")
  .description(
    "A CLI for interacting with deco.chat.",
  )
  .command("login", login)
  .command("logout", logout)
  .command("whoami", whoami)
  .command("hosting", hosting)
  .parse(Deno.args);
