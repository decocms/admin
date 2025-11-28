import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { ArrowLeft, Info, Loader2, Upload } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { AgentSchema } from "@decocms/bindings/agent";
import { z } from "zod";

export type Agent = z.infer<typeof AgentSchema>;

export interface AgentDetailsViewProps {
  item: Agent;
  onBack: () => void;
  onUpdate: (updates: Record<string, any>) => Promise<void>;
}

function SmartAvatarUpload({
  value,
  onChange,
  alt,
}: {
  value?: string | null;
  onChange: (value: string) => void;
  alt?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        onChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="relative h-14 w-14 shrink-0 cursor-pointer group"
      onClick={handleClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      <div className="h-full w-full rounded-xl border border-border bg-muted/20 overflow-hidden relative">
        {value ? (
          <img
            src={value}
            alt={alt || "Avatar"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            🤖
          </div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
          <Upload className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

export function AgentDetailsView({
  item,
  onBack,
  onUpdate,
}: AgentDetailsViewProps) {
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isDirty },
  } = useForm<Agent>({
    defaultValues: {
      title: item.title || item.name || "",
      description: item.description || "",
      instructions: item.instructions || item.content || "",
      avatar: item.avatar || "",
    },
  });

  const avatarValue = watch("avatar");

  // Reset form when item changes (e.g. first load)
  useEffect(() => {
    if (item) {
      reset({
        title: item.title || item.name || "",
        description: item.description || "",
        instructions: item.instructions || item.content || "",
        avatar: item.avatar || "",
      });
    }
  }, [item, reset]);

  const onSubmit = async (data: Agent) => {
    setIsSaving(true);
    try {
      await onUpdate(data);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="h-6 w-px bg-border mx-2" />
          {/* Tabs placeholder */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-7 bg-muted text-foreground font-normal"
            >
              Profile
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground font-normal"
            >
              Tools
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground font-normal"
            >
              Triggers
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-muted-foreground font-normal"
            >
              Advanced
            </Button>
          </div>
        </div>

        <div>
          <Button
            className="bg-[#d0ec1a] text-[#07401a] hover:bg-[#d0ec1a]/90 h-7 text-xs font-medium"
            onClick={handleSubmit(onSubmit)}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-5">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Agent Identity Header */}
          <div className="flex gap-4 items-start">
            <SmartAvatarUpload
              value={avatarValue}
              onChange={(val) => setValue("avatar", val, { shouldDirty: true })}
              alt={watch("title")}
            />
            <div className="space-y-3 pt-1 flex-1">
              <Input
                {...register("title")}
                className="text-2xl font-medium text-foreground border-transparent hover:border-input focus:border-input px-0 h-auto bg-transparent shadow-none"
                placeholder="Agent Name"
              />
              <Input
                {...register("description")}
                className="text-sm text-muted-foreground border-transparent hover:border-input focus:border-input px-0 h-auto bg-transparent shadow-none"
                placeholder="Brief description"
              />
            </div>
          </div>

          {/* Instructions Section */}
          <div className="space-y-4">
            <Badge
              variant="secondary"
              className="px-2 py-0.5 h-6 gap-1.5 bg-secondary/50 text-muted-foreground font-normal text-xs hover:bg-secondary/50"
            >
              <Info className="h-3.5 w-3.5" />
              Type @ to add tools and more
            </Badge>

            <div className="relative">
              <Textarea
                {...register("instructions")}
                className="min-h-[400px] resize-none text-sm leading-relaxed font-normal border-0 focus-visible:ring-0 px-0 py-0 shadow-none"
                placeholder="Enter agent instructions..."
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
