import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useState } from "react";
import { cronTriggerSchema, useCreateTrigger } from "@deco/sdk";

const cronPresets = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 10am", value: "0 10 * * 1" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Custom", value: "custom" },
];

function isValidCron(cron: string) {
  // Basic validation: 5 space-separated fields
  // Regex created by ChatGPT at 2025-05-02
  return /^(\S+\s+){4}\S+$/.test(cron);
}

function CronSelectInput({ value, onChange, required, error }: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
}) {
  const [selected, setSelected] = useState(
    cronPresets[0].value,
  );
  const [custom, setCustom] = useState(selected === "custom" ? value : "");
  const [localError, setLocalError] = useState<string | null>(null);

  function handlePresetChange(val: string) {
    setSelected(val);
    if (val === "custom") {
      if (isValidCron(custom)) {
        setLocalError(null);
        onChange(custom);
      } else {
        setLocalError("Invalid cron expression");
        onChange("");
      }
    } else {
      setLocalError(null);
      onChange(val);
    }
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustom(val);
    setSelected("custom");
    if (isValidCron(val)) {
      setLocalError(null);
      onChange(val);
    } else {
      setLocalError("Invalid cron expression");
      onChange("");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="cron-frequency">Frequency</Label>
      <Select value={selected} onValueChange={handlePresetChange}>
        <SelectTrigger id="cron-frequency" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {cronPresets.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected === "custom" && (
        <Input
          type="text"
          placeholder="Ex: */10 * * * *"
          value={custom}
          className="rounded-md font-mono"
          onChange={handleCustomChange}
          required={required}
        />
      )}
      {(localError || error) && (
        <span className="text-xs text-red-500">{localError || error}</span>
      )}
      {selected === "custom" && (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700 mb-2">
          <div className="font-semibold mb-1">How to fill the Frequency:</div>

          <ul className="list-disc pl-4 mb-2">
            <li>
              The value must be a valid <b>cron expression</b> (e.g.,{" "}
              <code>0 9 * * *</code>).
            </li>
            <li>
              You can select a preset or write your own custom expression.
            </li>
            <li>
              <a
                href="https://crontab.guru"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                Use this generator to create and test expressions
              </a>.
            </li>
          </ul>

          <div className="font-semibold mb-1">Example:</div>
          <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
{`0 9 * * *     (every day at 9am)
*/5 * * * *   (every 5 minutes)`}
          </pre>
        </div>
      )}
    </div>
  );
}

export function CronTriggerForm({ agentId, onSuccess }: {
  agentId: string;
  onSuccess?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("");
  const [prompt, setPrompt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { mutate: createTrigger, isPending } = useCreateTrigger(agentId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    if (!prompt.trim()) {
      setErrors({ prompt: "Prompt is required" });
      return;
    }

    if (!frequency || !isValidCron(frequency)) {
      setErrors({ frequency: "Frequency is required and must be valid" });
      return;
    }

    const result = cronTriggerSchema.safeParse({
      title: name,
      description,
      cronExp: frequency,
      prompt: { messages: [{ role: "user", content: prompt }] },
      type: "cron",
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const err of result.error.errors) {
        if (err.path[0]) fieldErrors[err.path[0]] = err.message;
      }
      setErrors(fieldErrors);
      return;
    }
    createTrigger(
      {
        title: name,
        description: description || undefined,
        cronExp: frequency,
        prompt: { messages: [{ role: "user", content: prompt }] },
        type: "cron",
      },
      {
        onSuccess: () => {
          setErrors({});
          setName("");
          setDescription("");
          setFrequency("");
          setPrompt("");
          onSuccess?.();
        },
        onError: (error: Error) => {
          setErrors({ form: error?.message || "Failed to create trigger" });
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="cron-name">Name</Label>
        <Input
          id="cron-name"
          name="name"
          className="rounded-md"
          placeholder="Send birthday message"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && (
          <div className="text-xs text-red-500 mt-1">{errors.name}</div>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="cron-description">Description</Label>
          <span className="text-xs text-slate-400">Optional</span>
        </div>
        <Textarea
          id="cron-description"
          name="description"
          placeholder="Send birthday message to the user"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors.description && (
          <div className="text-xs text-red-500 mt-1">{errors.description}</div>
        )}
      </div>
      <CronSelectInput
        value={frequency}
        onChange={setFrequency}
        required
        error={errors.frequency}
      />
      <div className="space-y-2">
        <Label htmlFor="cron-prompt">Prompt</Label>
        <Textarea
          id="cron-prompt"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Send birthday message to the user using the SEND_BIRTHDAY_MESSAGE tool"
          rows={3}
          required
        />
        {errors.prompt && (
          <div className="text-xs text-red-500 mt-1">{errors.prompt}</div>
        )}
      </div>
      {errors.form && (
        <div className="text-xs text-red-500 mt-1">{errors.form}</div>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </form>
  );
}
