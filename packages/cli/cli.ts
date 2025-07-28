import { Command } from "@cliffy/command";
import denoJson from "./deno.json" with { type: "json" };
import {
  getConfig,
  getLocal,
  readWranglerConfig,
  setLocal,
} from "./src/config.ts";
import { configureCommand } from "./src/configure.ts";
import { DECO_CHAT_API_LOCAL } from "./src/constants.ts";
import { createCommand, listTemplates } from "./src/create.ts";
import { deploy } from "./src/hosting/deploy.ts";
import { listApps } from "./src/hosting/list.ts";
import { promoteApp } from "./src/hosting/promote.ts";
import { link } from "./src/link.ts";
import { loginCommand } from "./src/login.ts";
import { deleteSession, readSession, setToken } from "./src/session.ts";
import { genEnv } from "./src/typings.ts";
import { checkForUpdates, upgrade } from "./src/upgrade.ts";
import {
  hasMCPPreferences,
  promptIDESetup,
  writeIDEConfig,
} from "./src/utils/prompt-ide-setup.ts";
import { whoamiCommand } from "./src/whoami.ts";
import { ensureDevEnvironment, getEnvVars } from "./src/wrangler.ts";
import { addCommand } from "./src/add.ts";

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
  .alias("config")
  .description("Save configuration options for the current directory.")
  .action(async () => {
    const local = getLocal();
    await configureCommand(local);
  });

// Placeholder for hosting list command implementation
const hostingList = new Command()
  .description("List all apps in the current workspace.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: false,
  })
  .action(async (args) => {
    const workspace = Array.isArray(args.workspace)
      ? args.workspace[0]
      : args.workspace;
    return listApps({
      workspace: workspace ??
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
  .option("-y, --yes", "Skip confirmation", { required: false })
  .option("-p, --public", "Make the app public in the registry", {
    required: false,
  })
  .arguments("[cwd:string]")
  .action(async (args, folder) => {
    const cwd = folder ?? Deno.cwd();

    // Normalize CLI arguments
    const workspace = Array.isArray(args.workspace)
      ? args.workspace[0]
      : args.workspace;
    const appArg = Array.isArray(args.app) ? args.app[0] : args.app;
    const yes = Array.isArray(args.yes) ? args.yes.includes(true) : args.yes;
    const isPublic = Array.isArray(args.public)
      ? args.public.includes(true)
      : args.public;

    const config = await getConfig({
      inlineOptions: { workspace },
    });
    const wranglerConfig = await readWranglerConfig();
    const assetsDirectory = wranglerConfig.assets?.directory;
    const app = appArg ??
      (typeof wranglerConfig.name === "string"
        ? wranglerConfig.name
        : "my-app");
    return deploy({
      workspace: config.workspace,
      local: config.local || false,
      app,
      skipConfirmation: yes,
      cwd,
      unlisted: !isPublic,
      assetsDirectory,
    });
  });

// Placeholder for hosting promote command implementation
const hostingPromote = new Command()
  .description("Promote a deployment to an existing route pattern.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: false,
  })
  .option("-a, --app <app:string>", "App name", { required: false })
  .option("-d, --deployment <deployment:string>", "Deployment ID", {
    required: false,
  })
  .option(
    "-r, --route <route:string>",
    "Route pattern (defaults to appName.deco.page)",
    {
      required: false,
    },
  )
  .option("-y, --yes", "Skip confirmation", { required: false })
  .action(async (args) => {
    // Normalize CLI arguments
    const workspace = Array.isArray(args.workspace)
      ? args.workspace[0]
      : args.workspace;
    const appArg = Array.isArray(args.app) ? args.app[0] : args.app;
    const deploymentArg = Array.isArray(args.deployment)
      ? args.deployment[0]
      : args.deployment;
    const routeArg = Array.isArray(args.route) ? args.route[0] : args.route;
    const yes = Array.isArray(args.yes) ? args.yes.includes(true) : args.yes;

    const config = await getConfig({
      inlineOptions: { workspace },
    });
    const wranglerConfig = await readWranglerConfig();
    const app = appArg ??
      (typeof wranglerConfig.name === "string"
        ? wranglerConfig.name
        : "my-app");

    return promoteApp({
      workspace: config.workspace,
      appSlug: app,
      deploymentId: deploymentArg,
      routePattern: routeArg,
      skipConfirmation: yes,
    });
  });

const linkCmd = new Command()
  .description("Link the project to be accessed through a remote domain.")
  .option("-p, --port <port:number>", "Port to link", {
    required: false,
  })
  .arguments("[...build-cmd]")
  .action(async function ({ port }) {
    const runCommand = this.getLiteralArgs();
    const normalizedPort = Array.isArray(port) ? port[0] : port;

    const env = await getEnvVars();
    await link({
      port: normalizedPort,
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

    const config = await getConfig().catch(() => ({
      workspace: "default",
      bindings: [],
      local: false,
      enable_workflows: true,
    }));

    const wranglerConfig = await readWranglerConfig();
    const app = typeof wranglerConfig.name === "string"
      ? wranglerConfig.name
      : "my-app";

    const latest = await hasMCPPreferences(config.workspace, app);

    if (!latest) {
      const mcpConfig = await promptIDESetup({
        workspace: config.workspace,
        app,
      });

      if (mcpConfig) {
        await writeIDEConfig(mcpConfig);
      }
    }

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
    const config = await getConfig().catch(() => ({}));
    const template = Array.isArray(options.template)
      ? options.template[0]
      : options.template;
    await createCommand(projectName, template, config);
  });

const listTemplatesCommand = new Command()
  .description("List available templates.")
  .action(() => {
    listTemplates();
  });

const add = new Command()
  .description("Add integrations to the current project.")
  .option("-w, --workspace <workspace:string>", "Workspace name", {
    required: false,
  })
  .action(async (args) => {
    const local = getLocal();
    const workspace = Array.isArray(args.workspace)
      ? args.workspace[0]
      : args.workspace;
    await addCommand({
      workspace,
      local,
    });
  });

// Hosting parent command
const hosting = new Command()
  .description("Manage hosting apps in a workspace.")
  .command("list", hostingList)
  .command("deploy", hostingDeploy)
  .command("promote", hostingPromote);

const gen = new Command()
  .description("Generate the environment that will be used to run the app.")
  .option(
    "-s, --self <url:string>",
    "Useful to generate a SELF binding for own types based on local mcp server.",
    {
      required: false,
    },
  )
  .action(async (options) => {
    const config = await getConfig({});
    const selfUrl = Array.isArray(options.self)
      ? options.self[0]
      : options.self;
    const env = await genEnv({
      workspace: config.workspace,
      local: config.local,
      bindings: config.bindings,
      selfUrl,
    });
    console.log(env);
  });

// Main CLI
await checkForUpdates();
await new Command()
  .name(denoJson.name)
  .version(denoJson.version)
  .description(denoJson.description)
  .globalOption(
    "-t, --token <token:string>",
    "Authentication token to use for API requests",
    {
      required: false,
      action: (opt) => {
        opt.token && setToken(opt.token);
      },
    },
  )
  .globalOption(
    "-l, --local",
    `Deploy the app locally (Needs deco.chat running at ${DECO_CHAT_API_LOCAL})`,
    {
      required: false,
      action: (opt) => {
        opt.local && setLocal(true);
      },
    },
  )
  .command("login", login)
  .command("logout", logout)
  .command("whoami", whoami)
  .command("hosting", hosting)
  .command("deploy", hostingDeploy)
  .command("dev", dev)
  .command("configure", configure)
  .command("add", add)
  .command("update", update)
  .command("link", linkCmd)
  .command("gen", gen)
  .command("create", create)
  .command("templates", listTemplatesCommand)
  .parse(Deno.args);
