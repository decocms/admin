import { cn } from "@deco/ui/lib/utils.ts";
import type { HTMLAttributes } from "react";
import * as LucideIcons from "lucide-react";

export interface Props extends HTMLAttributes<HTMLElement> {
  /**
   * The name of the icon (Material Icons name that gets mapped to Lucide).
   */
  name: string;
  /**
   * Whether the icon is filled (for backward compatibility).
   */
  filled?: boolean;
  /**
   * The size of the icon.
   */
  size?: number;
}

// Mapping from Material Icons to Lucide Icons
const ICON_MAP: Record<string, keyof typeof LucideIcons> = {
  // Navigation & Actions
  "arrow_back": "ArrowLeft",
  "arrow_forward": "ArrowRight",
  "arrow_drop_down": "ChevronDown",
  "arrow_drop_up": "ChevronUp",
  "expand_more": "ChevronDown",
  "expand_less": "ChevronUp",
  "chevron_down": "ChevronDown",
  "chevrons_up_down": "ChevronsUpDown",
  "close": "X",
  "menu": "Menu",
  "more_vert": "MoreVertical",
  "more_horiz": "MoreHorizontal",
  
  // Basic Actions
  "add": "Plus",
  "plus": "Plus",
  "attach_money": "DollarSign",
  "remove": "Minus",
  "globe": "Globe",
  "brain": "Brain",
  "file_spreadsheet": "FileSpreadsheet",
  "container": "Container",
  "corner_down_right": "CornerDownRight",
  "functions": "Function",
  "code": "Code",
  "circle": "Circle",
  "star": "Star",
  "auto_awesome": "Sparkles",
  "delete": "Trash2",
  "edit": "Edit",
  "edit_square": "Edit",
  "save": "Save",
  "check": "Check",
  "check_circle": "CheckCircle",
  "cancel": "XCircle",
  "refresh": "RefreshCw",
  "sync": "RefreshCw",
  "update": "RefreshCw",
  
  // Communication
  "send": "Send",
  "chat": "MessageCircle",
  "message": "MessageCircle",
  "message_circle": "MessageCircle",
  "forum": "MessageSquare",
  "email": "Mail",
  "phone": "Phone",
  "call": "Phone",
  "at-sign": "AtSign",
  
  // Media & Files
  "attach_file": "Paperclip",
  "image": "Image",
  "photo": "Image",
  "file_copy": "Copy",
  "download": "Download",
  "upload": "Upload",
  "folder": "Folder",
  "description": "FileText",
  
  // Audio & Video
  "mic": "Mic",
  "volume_up": "Volume2",
  "play_arrow": "Play",
  "pause": "Pause",
  "stop": "Square",
  
  // Status & Feedback
  "error": "AlertCircle",
  "warning": "AlertTriangle",
  "info": "Info",
  "help": "HelpCircle",
  "hourglass_empty": "Clock",
  "timer": "Timer",
  "schedule": "Calendar",
  
  // People & Social
  "person": "User",
  "person_add": "UserPlus",
  "group": "Users",
  "account_circle": "UserCircle",
  "business": "Building2",
  
  // Interface Elements
  "search": "Search",
  "search_off": "SearchX",
  "settings": "Settings",
  "tune": "Settings",
  "home": "Home",
  "star": "Star",
  "favorite": "Heart",
  
  // Technology & Development
  "robot_2": "Bot",
  "smart_toy": "Bot",
  "bot": "Bot",
  "extension": "Puzzle",
  "build": "Wrench",
  "construction": "Wrench",
  "wrench": "Wrench",
  "code": "Code",
  "terminal": "Terminal",
  "bug_report": "Bug",
  "analytics": "BarChart3",
  "monitoring": "BarChart3",
  "show_chart": "BarChart3",
  "bar_chart": "BarChart3",
  "line_chart": "TrendingUp",
  "trending_up": "TrendingUp",
  
  // Navigation & Layout
  "layers": "Layers",
  "view_list": "List",
  "view_module": "Grid3X3",
  "table_chart": "Table",
  "dashboard": "LayoutDashboard",
  "view_dashboard": "LayoutDashboard",
  "layout_grid": "LayoutGrid",
  "app_window": "AppWindow",
  "account_tree": "GitBranch",
  "device_hub": "GitBranch",
  "workflow": "Workflow",
  
  // Actions & Tools
  "open_in_new": "ExternalLink",
  "link": "Link",
  "share": "Share",
  "copy": "Copy",
  "paste": "Clipboard",
  "undo": "Undo",
  "redo": "Redo",
  
  // Status Indicators
  "radio_button_unchecked": "Circle",
  "remove_circle": "MinusCircle",
  "add_circle": "PlusCircle",
  
  // Interaction
  "mouse": "Mouse",
  "zoom_in": "ZoomIn",
  "zoom_out": "ZoomOut",
  "pan_tool": "Hand",
  
  // Specific App Icons
  "local_library": "FileText",
  "description": "FileText",
  "notebook": "BookOpen",
  "explore": "Compass",
  "compass": "Compass",
  "support": "LifeBuoy",
  "redeem": "Gift",
  "wallet": "Wallet",
  "briefcase": "Briefcase",
  "briefcase-business": "BriefcaseBusiness",
  "hub": "Network",
  "linked_services": "Link2",
  "cable": "Cable",
  "batch_prediction": "Brain",
  "inventory_2": "Package",
  "rate_review": "MessageSquare",
  "recommend": "ThumbsUp",
  "support_agent": "Headphones",
  "edit_note": "PenTool",
  "auto_awesome": "Sparkles",
  "article": "FileText",
  "pages": "Layers",
  "layers": "Layers",
  "sections": "LayoutPanelTop",
  "layout_panel_top": "LayoutPanelTop",
  "loaders": "Package",
  "box": "Package",
  "campaign": "Megaphone",
  "filter_alt": "Filter",
  "assignment": "ClipboardList",
  "input": "ArrowDownToLine",
  "atr": "Zap",
  
  // Fallback for unknown icons
  "unknown": "HelpCircle",
};

/**
 * Icon component using Lucide React icons with Material Icons name mapping.
 * For available Lucide icons, see: https://lucide.dev/icons/
 */
export function Icon({
  name,
  filled = false,
  size = 16,
  className,
  ...props
}: Props) {
  // Get the Lucide icon name from the mapping
  const lucideIconName = ICON_MAP[name] || ICON_MAP["unknown"];
  
  // Get the Lucide icon component
  const LucideIcon = LucideIcons[lucideIconName] as React.ComponentType<{
    size?: number;
    className?: string;
    fill?: string;
  }>;

  if (!LucideIcon) {
    console.warn(`Icon "${name}" not found in mapping. Using HelpCircle as fallback.`);
    const FallbackIcon = LucideIcons.HelpCircle;
    return (
      <FallbackIcon
        size={size}
        className={cn(className)}
        fill={filled ? "currentColor" : "none"}
      />
    );
  }

  return (
    <LucideIcon
      size={size}
      className={cn(className)}
      fill={filled ? "currentColor" : "none"}
    />
  );
}