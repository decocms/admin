import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import Ajv from "ajv";
import { useState } from "react";
import { useCreateTrigger, webhookTriggerSchema } from "@deco/sdk";
import { useRef } from "react";

function JsonSchemaInput({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    onChange(val);
    try {
      // deno-lint-ignore no-explicit-any
      const ajv = new (Ajv as any)();
      const parsed = JSON.parse(val);
      try {
        ajv.compile(parsed);
        setError(null);
      } catch (schemaErr) {
        setError("Invalid JSON Schema: " + (schemaErr as Error).message);
      }
    } catch (err) {
      setError("Invalid JSON: " + (err as Error).message);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={handleChange}
        rows={5}
        className={error ? "border-red-500" : ""}
      />
      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-700">
        <div className="font-semibold mb-1">How to fill the Output Schema:</div>
        <ul className="list-disc pl-4 mb-2">
          <li>
            The value must be a valid <b>JSON Schema</b> (e.g.,{" "}
            <code>type: "object"</code>).
          </li>
          <li>
            If the schema is not provided, the trigger will send a message to
            response.
          </li>
          <li>Define the expected properties in the trigger's response.</li>
          <li>
            Use <code>type</code> for the data type and <code>required</code>
            {" "}
            for required fields.
          </li>
        </ul>
        <div className="font-semibold mb-1">Example:</div>
        <pre className="bg-white border rounded p-2 text-xs overflow-x-auto">
{`{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "age": { "type": "number" }
  },
  "required": ["name"]
}`}
        </pre>
      </div>
    </div>
  );
}

export function WebhookTriggerForm(
  { agentId }: { agentId: string },
) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [outputSchema, setOutputSchema] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutate: createTrigger, isPending } = useCreateTrigger(agentId);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setSuccessUrl(null);
    const result = webhookTriggerSchema.safeParse({
      title: name,
      description,
      passphrase,
      schema: outputSchema,
      type: "webhook",
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const err of result.error.errors) {
        if (err.path[0]) fieldErrors[err.path[0]] = err.message;
      }
      setErrors(fieldErrors);
      return;
    }
    let schemaObj: object | undefined = undefined;
    if (outputSchema && outputSchema.trim().length > 0) {
      try {
        schemaObj = JSON.parse(outputSchema);
      } catch {
        setErrors({ outputSchema: "Output Schema must be valid JSON" });
        return;
      }
    }
    createTrigger(
      {
        title: name,
        description: description || undefined,
        type: "webhook",
        passphrase: passphrase || undefined,
        // deno-lint-ignore no-explicit-any
        schema: schemaObj as unknown as any || undefined,
      },
      {
        onSuccess: (result) => {
          setErrors({});
          setName("");
          setDescription("");
          setPassphrase("");
          setOutputSchema("");
          setSuccessUrl(result?.url ?? null);
        },
        onError: (error: Error) => {
          setErrors({ form: error?.message || "Failed to create trigger" });
        },
      },
    );
  }

  return (
    <div>
      {successUrl
        ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-6 text-center max-w-md w-full">
              <div className="font-semibold text-lg mb-2">Webhook created!</div>
              <div className="mb-4 flex flex-col items-center gap-2">
                <div className="flex w-full gap-2">
                  <Input
                    ref={inputRef}
                    value={successUrl}
                    readOnly
                    className="flex-1 cursor-pointer select-all"
                    onClick={() => {
                      inputRef.current?.select();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      if (successUrl) {
                        await navigator.clipboard.writeText(successUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                  >
                    <Icon
                      name={copied ? "check" : "content_copy"}
                      size={18}
                      className="mr-1 align-middle"
                    />
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
        : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
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
                <Label htmlFor="webhook-description">Description</Label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <Textarea
                id="webhook-description"
                name="description"
                placeholder="Send birthday message to the user"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {errors.description && (
                <div className="text-xs text-red-500 mt-1">
                  {errors.description}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="webhook-passphrase">Passphrase</Label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <Input
                id="webhook-passphrase"
                name="passphrase"
                placeholder="Passphrase"
                className="rounded-md"
                type="text"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
              />
              {errors.passphrase && (
                <div className="text-xs text-red-500 mt-1">
                  {errors.passphrase}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="webhook-schema">Output Schema</Label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <JsonSchemaInput
                value={outputSchema}
                onChange={setOutputSchema}
              />
              {errors.outputSchema && (
                <div className="text-xs text-red-500 mt-1">
                  {errors.outputSchema}
                </div>
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
        )}
    </div>
  );
}
