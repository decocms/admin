import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  ResponsiveSelect,
  ResponsiveSelectContent,
  ResponsiveSelectItem,
  ResponsiveSelectTrigger,
  ResponsiveSelectValue,
} from "@deco/ui/components/responsive-select.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  DEFAULT_MODEL,
  type Model,
  type ModelRuntimeState,
  useModels,
  WELL_KNOWN_MODELS,
} from "@deco/sdk";
import { useState } from "react";

const OLLAMA_PROVIDER_PREFIX = "ollama:";

const mapLegacyModelId = (modelId: string): string => {
  const model = WELL_KNOWN_MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

const CAPABILITY_CONFIGS = {
  reasoning: {
    icon: "neurology",
    bg: "bg-purple-100",
    text: "text-purple-700",
    label: "Reasoning",
  },
  "image-upload": {
    icon: "image",
    bg: "bg-teal-100",
    text: "text-teal-700",
    label: "Can analyze images",
  },
  "file-upload": {
    icon: "description",
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Can analyze files",
  },
  "web-search": {
    icon: "search",
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Can search the web to answer questions",
  },
} as const;

interface OllamaStatusMeta {
  state: ModelRuntimeState | "unknown";
  label: string;
  bgClass: string;
  textClass: string;
  dotClass: string;
  reason?: string;
}

const OLLAMA_STATUS_CONFIG: Record<
  OllamaStatusMeta["state"],
  Omit<OllamaStatusMeta, "state" | "reason">
> = {
  available: {
    label: "Ready",
    bgClass: "bg-emerald-100",
    textClass: "text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  "model-missing": {
    label: "Model missing",
    bgClass: "bg-amber-100",
    textClass: "text-amber-700",
    dotClass: "bg-amber-500",
  },
  unavailable: {
    label: "Offline",
    bgClass: "bg-rose-100",
    textClass: "text-rose-700",
    dotClass: "bg-rose-500",
  },
  unknown: {
    label: "Checking…",
    bgClass: "bg-slate-200",
    textClass: "text-slate-600",
    dotClass: "bg-slate-500",
  },
};

const isOllamaModel = (model: Model) =>
  model.model.startsWith(OLLAMA_PROVIDER_PREFIX);

const isOllamaReady = (model: Model) => {
  if (!isOllamaModel(model)) return true;
  const state = model.runtimeStatus?.state;
  return !state || state === "available";
};

const getOllamaStatusMeta = (model: Model): OllamaStatusMeta | null => {
  if (!isOllamaModel(model)) return null;
  const state = model.runtimeStatus?.state ?? "unknown";
  const config = OLLAMA_STATUS_CONFIG[state];
  return {
    state,
    label: config.label,
    bgClass: config.bgClass,
    textClass: config.textClass,
    dotClass: config.dotClass,
    reason: model.runtimeStatus?.reason,
  };
};

function CapabilityBadge({
  capability,
}: {
  capability: keyof typeof CAPABILITY_CONFIGS;
}) {
  const config = CAPABILITY_CONFIGS[capability] || {
    icon: "check",
    bg: "bg-slate-200",
    text: "text-slate-700",
    label: capability,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center justify-center h-6 w-6 rounded-sm ${config.bg}`}
        >
          <Icon name={config.icon} className={config.text} />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function OllamaStatusBadge({ status }: { status: OllamaStatusMeta | null }) {
  if (!status) return null;

  const badge = (
    <div
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        status.bgClass,
        status.textClass,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", status.dotClass)} />
      <span>{status.label}</span>
    </div>
  );

  if (!status.reason) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{status.reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ModelItemContent({ model }: { model: Model }) {
  const status = getOllamaStatusMeta(model);

  return (
    <div className="p-2 md:w-[420px] flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <img src={model.logo} className="h-5 w-5" alt="" />
        <span className="text-sm text-foreground">{model.name}</span>
        <OllamaStatusBadge status={status} />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {model.capabilities.map((capability) => (
          <CapabilityBadge key={capability} capability={capability} />
        ))}
      </div>
    </div>
  );
}

function SelectedModelDisplay({ model }: { model: Model }) {
  const status = getOllamaStatusMeta(model);

  return (
    <div className="flex items-center gap-1.5">
      {model.logo && <img src={model.logo} className="h-4 w-4" alt="" />}
      <span className="text-xs text-foreground">{model.name}</span>
      <OllamaStatusBadge status={status} />
    </div>
  );
}

interface ModelSelectorProps {
  model?: string;
  onModelChange?: (model: string) => void;
  variant?: "borderless" | "bordered";
}

export function ModelSelector({
  model = DEFAULT_MODEL.id,
  onModelChange,
  variant = "borderless",
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [ollamaModalOpen, setOllamaModalOpen] = useState(false);
  const [pendingModelId, setPendingModelId] = useState<string | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const { data: models, refetch } = useModels({ excludeDisabled: true });

  const selectedModel =
    models.find((item) => item.id === model) ?? DEFAULT_MODEL;

  const pendingModel = pendingModelId
    ? models.find((item) => item.id === pendingModelId)
    : undefined;
  const pendingStatus = pendingModel ? getOllamaStatusMeta(pendingModel) : null;

  const selectModel = (next: string) => {
    if (onModelChange) {
      onModelChange(next);
    }
    setOpen(false);
    setOllamaModalOpen(false);
    setPendingModelId(null);
  };

  const handleModelChange = (next: string) => {
    const candidate = models.find((item) => item.id === next);
    if (candidate && !isOllamaReady(candidate)) {
      setPendingModelId(candidate.id);
      setOllamaModalOpen(true);
      setOpen(false);
      return;
    }
    selectModel(next);
  };

  const handleCheckAgain = async () => {
    if (checkingOllama) return;

    setCheckingOllama(true);
    try {
      const result = await refetch();
      const refreshedModels = (result.data ?? models) as Model[];
      if (pendingModelId) {
        const refreshed = refreshedModels.find(
          (item) => item.id === pendingModelId,
        );
        if (refreshed && isOllamaReady(refreshed)) {
          selectModel(refreshed.id);
          return;
        }
      }
    } catch (error) {
      console.error("Failed to refresh Ollama status", error);
    } finally {
      setCheckingOllama(false);
    }
  };

  const handleModalOpenChange = (nextOpen: boolean) => {
    setOllamaModalOpen(nextOpen);
    if (!nextOpen) {
      setCheckingOllama(false);
      setPendingModelId(null);
    }
  };

  return (
    <>
      <ResponsiveSelect
        open={open}
        onOpenChange={setOpen}
        value={mapLegacyModelId(model)}
        onValueChange={handleModelChange}
      >
        <ResponsiveSelectTrigger
          className={cn(
            "!h-9 cursor-pointer px-2 py-0 text-xs shadow-none hover:bg-muted",
            variant === "borderless" && "md:border-none",
          )}
        >
          <ResponsiveSelectValue placeholder="Select model">
            <SelectedModelDisplay model={selectedModel} />
          </ResponsiveSelectValue>
        </ResponsiveSelectTrigger>
        <ResponsiveSelectContent title="Select model">
          {models.map((item) => (
            <ResponsiveSelectItem
              key={item.id}
              value={item.id}
              hideCheck
              className={cn(
                "cursor-pointer p-0 text-foreground focus:bg-muted focus:text-foreground",
                item.id === selectedModel?.id && "bg-muted/50",
              )}
            >
              <ModelItemContent model={item} />
            </ResponsiveSelectItem>
          ))}
        </ResponsiveSelectContent>
      </ResponsiveSelect>

      <Dialog open={ollamaModalOpen} onOpenChange={handleModalOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Use Ollama locally</DialogTitle>
            <DialogDescription>
              Start your local Ollama server so Deco can talk to it directly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            {pendingStatus && (
              <div className="flex flex-wrap items-center gap-2">
                <OllamaStatusBadge status={pendingStatus} />
                {pendingStatus.reason && (
                  <span className="text-xs text-muted-foreground">
                    {pendingStatus.reason}
                  </span>
                )}
              </div>
            )}
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Install Ollama from{" "}
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline"
                >
                  ollama.com
                </a>{" "}
                if it&apos;s not installed yet.
              </li>
              <li>
                Download and start the Qwen model by running{" "}
                <code className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                  ollama run qwen3:4b-instruct
                </code>
                .
              </li>
              <li>
                Keep Ollama running and click{" "}
                <span className="font-semibold text-foreground">
                  Check again
                </span>
                .
              </li>
            </ol>
          </div>
          <DialogFooter className="sm:flex-row sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => handleModalOpenChange(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCheckAgain} disabled={checkingOllama}>
              {checkingOllama ? "Checking…" : "Check again"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
