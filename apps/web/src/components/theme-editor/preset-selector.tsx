import { THEME_PRESETS, type ThemePreset } from "./theme-presets.ts";
import { cn } from "@deco/ui/lib/utils.ts";

interface PresetSelectorProps {
  onSelectPreset: (preset: ThemePreset) => void;
  selectedPresetId?: string;
}

interface PresetCardProps {
  preset: ThemePreset;
  isSelected: boolean;
  onClick: () => void;
}

function PresetCard({ preset, isSelected, onClick }: PresetCardProps) {
  const vars = preset.theme.variables || {};

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={`Apply ${preset.name} preset`}
      className={cn(
        "w-[239px] shrink-0 border border-border rounded-md overflow-hidden transition-all hover:border-primary/60 hover:shadow-sm",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
    >
      {/* Skeleton Preview */}
      <div
        className="h-[205px] relative"
        style={{
          backgroundColor: vars["--background"],
        }}
      >
        {/* Header */}
        <div
          className="h-8 border-b flex items-center justify-between px-2"
          style={{
            borderColor: vars["--border"],
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-sm opacity-15"
              style={{
                backgroundColor: vars["--muted-foreground"],
              }}
            />
            <div
              className="h-3 w-1 opacity-30"
              style={{
                backgroundColor: vars["--muted-foreground"],
              }}
            />
            <div className="flex items-center gap-1">
              <div
                className="size-2.5 rounded-sm opacity-15"
                style={{
                  backgroundColor: vars["--muted-foreground"],
                }}
              />
              <div
                className="h-1.5 w-8 rounded-sm opacity-25"
                style={{
                  backgroundColor: vars["--foreground"],
                }}
              />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex h-[calc(100%-32px)]">
          {/* Sidebar */}
          <div
            className="w-[60px] border-r p-1 flex flex-col gap-1 overflow-hidden"
            style={{
              borderColor: vars["--border"],
            }}
          >
            <div
              className="p-0.5 rounded flex items-center justify-center gap-1"
              style={{
                backgroundColor: vars["--accent"],
              }}
            >
              <div
                className="size-2.5 rounded-sm opacity-15"
                style={{
                  backgroundColor: vars["--muted-foreground"],
                }}
              />
              <div
                className="h-1.5 w-8 rounded-sm opacity-25"
                style={{
                  backgroundColor: vars["--foreground"],
                }}
              />
            </div>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-0.5 flex items-center justify-center gap-1"
              >
                <div
                  className="size-2.5 rounded-sm opacity-15"
                  style={{
                    backgroundColor: vars["--muted-foreground"],
                  }}
                />
                <div
                  className="h-1.5 w-8 rounded-sm opacity-25"
                  style={{
                    backgroundColor: vars["--foreground"],
                  }}
                />
              </div>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-3 flex flex-col gap-2 overflow-hidden">
            {/* Top bar with buttons */}
            <div className="flex items-start justify-between shrink-0">
              <div
                className="h-2 w-8 rounded-sm opacity-25"
                style={{
                  backgroundColor: vars["--foreground"],
                }}
              />
              <div className="flex gap-0.5">
                <div
                  className="h-2 w-8 rounded-sm"
                  style={{
                    backgroundColor: vars["--secondary"],
                  }}
                />
                <div
                  className="h-2 w-8 rounded-sm"
                  style={{
                    backgroundColor: vars["--primary"],
                  }}
                />
              </div>
            </div>

            {/* Accent boxes */}
            <div className="flex gap-1 shrink-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-2 w-5 rounded-sm"
                  style={{
                    backgroundColor: vars["--accent"],
                  }}
                />
              ))}
            </div>

            {/* Table rows - this is the only part that should overflow */}
            <div className="flex flex-col gap-0.5 mt-2 overflow-y-auto overflow-x-hidden">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn("flex gap-1 py-2", i < 3 && "border-b")}
                  style={{
                    borderColor: vars["--border"],
                  }}
                >
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-1.5 w-[70px] rounded-sm opacity-15"
                      style={{
                        backgroundColor: vars["--muted-foreground"],
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with color dots and name */}
      <div
        className="border-t flex items-center gap-2.5 px-3 py-2"
        style={{
          borderColor: vars["--border"],
        }}
      >
        <div className="flex -space-x-1.5">
          <div
            className="size-[18px] rounded-full border-2 border-background"
            style={{
              backgroundColor: vars["--primary"],
            }}
          />
          <div
            className="size-[18px] rounded-full border-2 border-background"
            style={{
              backgroundColor: vars["--secondary"],
            }}
          />
          <div
            className="size-[18px] rounded-full border-2 border-background"
            style={{
              backgroundColor: vars["--accent"],
            }}
          />
          <div
            className="size-[18px] rounded-full border-2 border-background"
            style={{
              backgroundColor: vars["--border"],
            }}
          />
        </div>
        <p className="text-base font-normal text-foreground">{preset.name}</p>
      </div>
    </button>
  );
}

export function PresetSelector({
  onSelectPreset,
  selectedPresetId,
}: PresetSelectorProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-4 w-fit p-2 max-w-2xl">
        {THEME_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            isSelected={selectedPresetId === preset.id}
            onClick={() => onSelectPreset(preset)}
          />
        ))}
      </div>
    </div>
  );
}
