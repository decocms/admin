import { Command } from "@cliffy/command";
import { parseArgs } from "@std/cli";
import { deploy } from "./src/hosting/deploy.ts";
import { listApps } from "./src/hosting/list.ts";
import { link } from "./src/link.ts";
import { loginCommand } from "./src/login.ts";
import { deleteSession, getSessionToken } from "./src/session.ts";
import { whoamiCommand } from "./src/whoami.ts";

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

const linkCmd = new Command()
  .description("Link the project to be accessed through a remote domain.")
  .option("-p, --port <port:number>", "Port to link", {
    required: false,
  })
  .action(async (args) => {
    const parsedArgs = parseArgs(Deno.args, {
      string: ["build-cmd"],
    });
    const runCommand: string[] = parsedArgs["_"] as string[];
    runCommand[0] === "link" && runCommand.splice(0, 1); // remove first command
    await link({
      ...args,
      onBeforeRegister: () => {
        if (runCommand.length > 0) {
          const denoCmd = new Deno.Command(runCommand[0], {
            args: runCommand.slice(1),
            stdout: "inherit",
            stderr: "inherit",
          });
          denoCmd.spawn();
        }
      },
    });
  });

// Hosting parent command
const hosting = new Command()
  .description("Manage hosting apps in a workspace.")
  .command("list", hostingList)
  .command("deploy", hostingDeploy);

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
  .command("link", linkCmd)
  .parse(Deno.args);
