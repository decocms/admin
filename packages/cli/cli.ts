import { Command } from "@cliffy/command";
import { Input } from "@cliffy/prompt";
import denoJson from "./deno.json" with { type: "json" };
import { getConfig, writeConfigFile } from "./src/config.ts";
import { DECO_CHAT_API_LOCAL } from "./src/constants.ts";
import { deploy } from "./src/hosting/deploy.ts";
import { listApps } from "./src/hosting/list.ts";
import { link } from "./src/link.ts";
import { loginCommand } from "./src/login.ts";
import { deleteSession, readSession } from "./src/session.ts";
import { whoamiCommand } from "./src/whoami.ts";
import { ensureDevEnvironment, getEnvVars } from "./src/wrangler.ts";
import { genEnv } from "./src/typings.ts";
import { checkForUpdates, upgrade } from "./src/upgrade.ts";
import { createCommand, listTemplates } from "./src/create.ts";

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

const configure = new Command()
  .description("Save configuration options for the current directory.")
  .action(async () => {
    const workspace = await Input.prompt({
      message: "Enter workspace name:",
    });

    const app = await Input.prompt({
      message: "Enter app name:",
    });

    await writeConfigFile({ workspace, app });
    console.log("✅ Configuration saved successfully!");
  });

// Placeholder for hosting list command implementation
const hostingList = new Command()
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: false,
  })
  .action(async (args) => {
    return listApps({
      workspace: args.workspace ??
        await readSession().then((session) => session?.workspace!),
    });
  });

// Placeholder for hosting deploy command implementation
const hostingDeploy = new Command()
  .description("Deploy the current directory into the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: false,
  })
  .option("-a, --app <app:string>", "App name", { required: false })
  .option(
    "-l, --local",
    `Deploy the app locally (Needs deco.chat running at ${DECO_CHAT_API_LOCAL})`,
    { required: false },
  )
  .action(async (args) => {
    const config = await getConfig({
      inlineOptions: args,
    });
    return deploy(config);
  });

const linkCmd = new Command()
  .description("Link the project to be accessed through a remote domain.")
  .option("-p, --port <port:number>", "Port to link", {
    required: false,
  })
  .arguments("[...build-cmd]")
  .action(async function ({ port }) {
    const runCommand = this.getLiteralArgs();

    const env = await getEnvVars();
    await link({
      port,
      onBeforeRegister: () => {
        const [cmd, ...args] = runCommand;

        if (runCommand.length === 0) {
          console.error("No build command provided");
          return;
        }

        const process = new Deno.Command(cmd, {
          args,
          stdout: "inherit",
          stderr: "inherit",
          env,
        }).spawn();

        return process;
      },
    });
  });

const update = new Command()
  .description("Update the deco CLI to the latest version.")
  .action(upgrade);

const dev = new Command()
  .description("Start a development server.")
  .action(async () => {
    await ensureDevEnvironment();

    const deno = new Deno.Command("deco", {
      args: ["link", "-p", "8787", "--", "npx", "wrangler", "dev"],
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();

    await deno.status;
  });

const create = new Command()
  .description("Create a new project from a template.")
  .option("-t, --template <template:string>", "Template to use", {
    required: false,
  })
  .arguments("[project-name]")
  .action(async (options, projectName?: string) => {
    await createCommand(projectName, options.template);
  });

const listTemplatesCommand = new Command()
  .description("List available templates.")
  .action(() => {
    listTemplates();
  });

// Hosting parent command
const hosting = new Command()
  .description("Manage hosting apps in a workspace.")
  .command("list", hostingList)
  .command("deploy", hostingDeploy);

const gen = new Command()
  .description("Generate the environment that will be used to run the app.")
  .action(async () => {
    const config = await getConfig({});
    const env = await genEnv({
      workspace: config.workspace,
      local: config.local,
      bindings: config.bindings,
    });
    console.log(env);
  });

// Main CLI
await checkForUpdates();
await new Command()
  .name(denoJson.name)
  .version(denoJson.version)
  .description(denoJson.description)
  .command("login", login)
  .command("logout", logout)
  .command("whoami", whoami)
  .command("hosting", hosting)
  .command("deploy", hostingDeploy)
  .command("dev", dev)
  .command("configure", configure)
  .command("update", update)
  .command("link", linkCmd)
  .command("gen", gen)
  .command("create", create)
  .command("templates", listTemplatesCommand)
  .parse(Deno.args);
