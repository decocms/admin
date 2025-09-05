import { writeFile } from "fs/promises";
import { dirname, join } from "path";
import { homedir } from "os";
import process from "node:process";
import { ensureDir } from "../../lib/fs.js";

/**
 * Generate bash completion script
 */
function generateBashCompletionScript(): string {
  return `#!/bin/bash

# Deco CLI completion script for bash
_deco_completion() {
  local cur prev words cword
  _init_completion || return

  # Check if we're completing for call-tool command
  if [[ "\${words[*]}" == *"call-tool"* ]]; then
    local line="\${COMP_LINE}"
    local completions
    
    # Call the deco CLI completion command
    completions=\$(deco completion call-tool --current="\$cur" --previous="\$prev" --line="\$line" 2>/dev/null)
    
    if [[ \$? -eq 0 && -n "\$completions" ]]; then
      COMPREPLY=(\$(compgen -W "\$completions" -- "\$cur"))
      return 0
    fi
  fi

  # Default completion for other commands
  case \$prev in
    -w|--workspace)
      # Complete workspace names (could be enhanced to fetch from config)
      return 0
      ;;
    *)
      # Complete with available subcommands and options
      COMPREPLY=(\$(compgen -W "login logout whoami configure hosting dev add call-tool upgrade update link gen create" -- "\$cur"))
      ;;
  esac
}

# Register the completion function
complete -F _deco_completion deco
`;
}

/**
 * Generate zsh completion script
 */
function generateZshCompletionScript(): string {
  return `#compdef deco

# Deco CLI completion script for zsh
_deco() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \\
    '1: :_deco_commands' \\
    '*:: :->args'

  case \${words[1]} in
    call-tool)
      _deco_call_tool
      ;;
  esac
}

_deco_commands() {
  local commands
  commands=(
    'login:Log in to admin.decocms.com'
    'logout:Log out and remove session data'
    'whoami:Print current session info'
    'configure:Save configuration options'
    'hosting:Manage hosting apps'
    'dev:Start development server'
    'add:Add integrations'
    'call-tool:Call a tool on an integration'
    'upgrade:Upgrade the CLI'
    'update:Update dependencies'
    'link:Link project to remote domain'
    'gen:Generate environment'
    'create:Create new project'
  )
  _describe 'commands' commands
}

_deco_call_tool() {
  local context state state_descr line
  typeset -A opt_args

  _arguments -C \\
    '-i[Integration ID]:integration:_deco_integrations' \\
    '--integration[Integration ID]:integration:_deco_integrations' \\
    '-p[JSON payload]:payload:' \\
    '--payload[JSON payload]:payload:' \\
    '--set[Set key=value]:keyvalue:' \\
    '-w[Workspace name]:workspace:' \\
    '--workspace[Workspace name]:workspace:' \\
    '1: :_deco_tools'
}

_deco_integrations() {
  local integrations
  integrations=(\$(deco completion call-tool --current="\$PREFIX" --previous="-i" --line="\$BUFFER" 2>/dev/null))
  _describe 'integrations' integrations
}

_deco_tools() {
  local tools integration
  # Extract integration from command line
  if [[ "\$words" == *"-i"* ]]; then
    local i_index=\${words[(i)-i]}
    if (( i_index < \${#words} )); then
      integration=\${words[i_index+1]}
    fi
  elif [[ "\$words" == *"--integration"* ]]; then
    local int_index=\${words[(i)--integration]}
    if (( int_index < \${#words} )); then
      integration=\${words[int_index+1]}
    fi
  fi
  
  if [[ -n "\$integration" ]]; then
    tools=(\$(deco completion call-tool --current="\$PREFIX" --previous="" --line="\$BUFFER" 2>/dev/null))
    _describe 'tools' tools
  fi
}

_deco "\$@"
`;
}

/**
 * Install completion scripts
 */
export async function installCompletionCommand(
  shell?: string,
  options: { output?: string } = {},
): Promise<void> {
  try {
    const targetShell = shell || process.env.SHELL?.split("/").pop() || "bash";

    let script: string;
    let filename: string;
    let installPath: string;

    switch (targetShell) {
      case "bash": {
        script = generateBashCompletionScript();
        filename = "deco-completion.bash";
        installPath =
          options.output ||
          join(homedir(), ".local/share/bash-completion/completions/deco");
        break;
      }
      case "zsh": {
        script = generateZshCompletionScript();
        filename = "_deco";
        // Try to find zsh completion directory
        const zshDirs = [
          join(homedir(), ".zsh/completions"),
          "/usr/local/share/zsh/site-functions",
          "/opt/homebrew/share/zsh/site-functions",
        ];
        installPath = options.output || zshDirs[0];
        break;
      }
      default: {
        console.error(`❌ Unsupported shell: ${targetShell}`);
        console.log("Supported shells: bash, zsh");
        process.exit(1);
      }
    }

    // Determine final path and ensure directory exists
    const finalPath =
      options.output ||
      (targetShell === "zsh" ? join(installPath, filename) : installPath);

    // Ensure the directory exists
    await ensureDir(dirname(finalPath));

    // Write the completion script
    await writeFile(finalPath, script, "utf8");

    console.log(`✅ Completion script installed to: ${finalPath}`);

    if (!options.output) {
      switch (targetShell) {
        case "bash":
          console.log("");
          console.log("To enable completions, add this to your ~/.bashrc:");
          console.log(`source "${finalPath}"`);
          break;

        case "zsh":
          console.log("");
          console.log("To enable completions, add this to your ~/.zshrc:");
          console.log(`fpath=("${dirname(finalPath)}" $fpath)`);
          console.log("autoload -U compinit && compinit");
          break;
      }

      console.log("");
      console.log("Then restart your shell or run:");
      console.log("source ~/.bashrc  # for bash");
      console.log("source ~/.zshrc   # for zsh");
    }
  } catch (error) {
    console.error(
      "❌ Failed to install completion:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}
