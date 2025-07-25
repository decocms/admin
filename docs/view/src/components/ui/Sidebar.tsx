import React, { useEffect, useState } from "react";
import { Logo } from "../../components/atoms/Logo.tsx";
import { Button } from "../../components/atoms/Button.tsx";
import { Select } from "../../components/atoms/Select.tsx";
import { Icon } from "../../components/atoms/Icon.tsx";

interface DocData {
  title?: string;
  icon?: string;
  [key: string]: unknown;
}

interface Doc {
  data?: DocData;
  [key: string]: unknown;
}

interface TreeNode {
  name: string;
  type: "file" | "folder";
  children: TreeNode[];
  doc?: Doc;
  path: string[];
  id: string;
}

interface FlatNode {
  name: string;
  type: "file" | "folder";
  doc?: Doc;
  path: string[];
  depth: number;
  id: string;
  hasChildren: boolean;
}

interface SidebarProps {
  tree: FlatNode[];
  locale: string;
  translations: Record<string, string>;
}

interface TreeItemProps {
  node: FlatNode;
  isVisible: boolean;
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  locale: string;
  translations: Record<string, string>;
}

function TreeItem(
  { node, isVisible, isExpanded, onToggle, locale, translations }:
    TreeItemProps,
) {
  if (!isVisible) return null;

  // Check if this item is active (current page) - client-side only
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (node.type !== "file") return;

    const currentPath = globalThis.location.pathname;
    const itemPath = `/${locale}/${node.path.join("/")}`;

    setActive(currentPath === itemPath);
  }, [node.type, node.path, locale]);

  return (
    <li>
      <div
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
          active
            ? "bg-primary/5 text-primary" // Active state
            : node.type === "folder"
            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {/* Indentation spacer for nested items */}
        {node.depth > 1 && <div className="w-6 shrink-0" />}

        {/* Icon */}
        {node.type === "folder"
          ? (
            <Icon
              name="Folder"
              size={16}
              className={`shrink-0 ${active ? "text-primary" : ""}`}
            />
          )
          : node.doc?.data?.icon
          ? (
            <Icon
              name={node.doc.data.icon}
              size={16}
              className={`shrink-0 ${active ? "text-primary" : ""}`}
            />
          )
          : (
            <Icon
              name="FileText"
              size={16}
              className={`shrink-0 ${active ? "text-primary" : ""}`}
            />
          )}

        {/* Content */}
        {node.type === "folder"
          ? (
            <button
              type="button"
              className="flex items-center justify-between w-full text-left"
              onClick={() => onToggle(node.id)}
            >
              <span className="flex-1">
                {translations[`sidebar.section.${node.name}`] || node.name}
              </span>
              {node.hasChildren && (
                <Icon
                  name={isExpanded ? "ChevronDown" : "ChevronRight"}
                  size={16}
                  className={`shrink-0 ${active ? "text-primary" : ""}`}
                />
              )}
            </button>
          )
          : (
            <a
              href={`/${locale}/${node.path.join("/")}`}
              className="flex-1"
            >
              {node.doc?.data?.title || node.name}
            </a>
          )}
      </div>
    </li>
  );
}

interface TreeListProps {
  tree: FlatNode[];
  treeState: Map<string, boolean>;
  onToggle: (folderId: string) => void;
  locale: string;
  translations: Record<string, string>;
}

function TreeList(
  { tree, treeState, onToggle, locale, translations }: TreeListProps,
) {
  const isNodeVisible = (node: FlatNode): boolean => {
    if (node.depth === 0) return true;

    // Find the parent folder
    const parentPath = node.path.slice(0, -1);
    const parentId = parentPath.join("/");

    return treeState.get(parentId) !== false;
  };

  // Group nodes to determine when to add separators
  const getNodeGroup = (node: FlatNode): "root-files" | "root-folders" => {
    if (node.depth === 0 && node.type === "file") return "root-files";
    return "root-folders";
  };

  return (
    <ul className="space-y-0.5">
      {tree.map((node, index) => {
        const isVisible = isNodeVisible(node);
        const isExpanded = treeState.get(node.id) !== false;
        const prevNode = tree[index - 1];

        // Add separator when switching between different groups at root level
        let needsSeparator = false;
        if (prevNode && node.depth === 0 && prevNode.depth === 0) {
          const currentGroup = getNodeGroup(node);
          const prevGroup = getNodeGroup(prevNode);
          needsSeparator = currentGroup !== prevGroup;
        }

        // Also add separator when going from nested items back to root level
        if (prevNode && node.depth === 0 && prevNode.depth > 0) {
          needsSeparator = true;
        }

        // Add section title for root folders
        const needsSectionTitle = node.type === "folder" &&
          node.depth === 0; // All root folders get section titles

        return (
          <React.Fragment key={node.id}>
            {needsSeparator && (
              <li className="my-3">
                <div className="h-px bg-border/50" />
              </li>
            )}
            {needsSectionTitle && (
              <li className="mt-3 first:mt-0">
                <div className="px-3 py-2">
                  <h3 className="text-sm font-medium text-foreground">
                    {translations[`sidebar.section.${node.name}`] || node.name}
                  </h3>
                </div>
              </li>
            )}
            {!needsSectionTitle && (
              <TreeItem
                node={node}
                isVisible={isVisible}
                isExpanded={isExpanded}
                onToggle={onToggle}
                locale={locale}
                translations={translations}
              />
            )}
          </React.Fragment>
        );
      })}
    </ul>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | "auto">("auto");

  useEffect(() => {
    // Get saved theme from localStorage or default to auto
    const savedTheme =
      localStorage.getItem("theme") as "light" | "dark" | "auto" || "auto";
    setTheme(savedTheme);
    // Don't apply theme here since the script in the head already does it
  }, []);

  const applyTheme = (newTheme: "light" | "dark" | "auto") => {
    const html = document.documentElement;

    if (newTheme === "auto") {
      // Use system preference
      const prefersDark =
        globalThis.matchMedia("(prefers-color-scheme: dark)").matches;
      html.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      html.setAttribute("data-theme", newTheme);
    }

    localStorage.setItem("theme", newTheme);
  };

  const cycleTheme = () => {
    const nextTheme = theme === "light"
      ? "dark"
      : theme === "dark"
      ? "auto"
      : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return "Sun";
      case "dark":
        return "Moon";
      case "auto":
        return "Monitor";
      default:
        return "Monitor";
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-8 w-8"
    >
      <Icon name={getThemeIcon()} size={16} />
    </Button>
  );
}

function LanguageSelect({ locale }: { locale: string }) {
  const languageOptions = [
    { value: "en", label: "English" },
    { value: "pt-br", label: "Português" },
  ];

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value;
    // Navigate to the new locale URL
    const currentPath = globalThis.location.pathname;
    const pathWithoutLocale = currentPath.replace(/^\/[^\/]+/, "");
    globalThis.location.href = `/${newLocale}${pathWithoutLocale}`;
  };

  return (
    <Select
      options={languageOptions}
      value={locale}
      icon="Languages"
      className="w-full"
      selectClassName="text-muted-foreground"
      onChange={handleChange}
    />
  );
}

export default function Sidebar({ tree, locale, translations }: SidebarProps) {
  const [treeState, setTreeState] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    // Load saved state from localStorage
    const savedState = JSON.parse(
      localStorage.getItem("sidebar-tree-state") || "{}",
    );
    const initialState = new Map();

    // Initialize tree state - default to expanded
    tree.forEach((node) => {
      if (node.type === "folder") {
        initialState.set(node.id, savedState[node.id] !== false);
      }
    });

    setTreeState(initialState);
  }, [tree]);

  const updateFolderVisibility = (folderId: string, isExpanded: boolean) => {
    setTreeState((prev) => {
      const newState = new Map(prev);
      newState.set(folderId, isExpanded);
      return newState;
    });

    // Save state to localStorage
    const stateToSave: Record<string, boolean> = {};
    treeState.forEach((value, key) => {
      stateToSave[key] = value;
    });
    stateToSave[folderId] = isExpanded;
    localStorage.setItem("sidebar-tree-state", JSON.stringify(stateToSave));
  };

  const handleFolderToggle = (folderId: string) => {
    const currentState = treeState.get(folderId) || false;
    updateFolderVisibility(folderId, !currentState);
  };

  return (
    <div className="flex flex-col h-screen bg-app-background border-r border-border w-[19rem]">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 shrink-0">
        <Logo width={67} height={28} />
        <ThemeToggle />
      </div>

      {/* Language Select */}
      <div className="px-8 py-4 shrink-0">
        <LanguageSelect locale={locale} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-4 min-h-0">
        <TreeList
          tree={tree}
          treeState={treeState}
          onToggle={handleFolderToggle}
          locale={locale}
          translations={translations}
        />
      </div>

      {/* Footer */}
      <div className="px-8 py-4 border-t border-border shrink-0">
        <div className="space-y-2">
          <a
            href="/discord"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="flex-1 ">Discord community</span>
            <Icon
              name="ArrowUpRight"
              size={16}
              className="text-muted-foreground"
            />
          </a>
          <a
            href="/get-started"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <span className="flex-1">Get started</span>
            <Icon
              name="ArrowUpRight"
              size={16}
              className="text-muted-foreground"
            />
          </a>
        </div>
      </div>
    </div>
  );
}
