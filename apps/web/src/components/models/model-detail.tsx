import { useModelV2 } from "@deco/sdk";
import { Card } from "@deco/ui/components/card.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

/**
 * Model V2 Detail Component
 * Displays and allows editing of custom model configurations
 * 
 * TODO: This is a placeholder implementation. A full implementation would include:
 * - Rich form for editing all model properties
 * - API key configuration
 * - Model testing interface
 * - Cost calculator
 * - Usage statistics
 */

interface ModelDetailProps {
  resourceUri: string;
}

export function ModelDetail({ resourceUri }: ModelDetailProps) {
  const { data, isLoading, error } = useModelV2(resourceUri);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-2">Model not found</h2>
          <p className="text-muted-foreground">
            The model you're looking for doesn't exist or you don't have access to it.
          </p>
        </Card>
      </div>
    );
  }

  const model = data.data;

  return (
    <div className="p-6 space-y-6">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">{model.name}</h1>
        <p className="text-muted-foreground mb-4">{model.description || "No description"}</p>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Provider</h3>
            <p>{model.provider}</p>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Model ID</h3>
            <code className="bg-muted px-2 py-1 rounded text-sm">{model.modelId}</code>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {model.supports?.map((capability) => (
                <Badge key={capability} variant="secondary">
                  {capability}
                </Badge>
              )) || <span className="text-muted-foreground text-sm">No capabilities defined</span>}
            </div>
          </div>

          {model.limits && model.limits.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Limits</h3>
              <ul className="space-y-1">
                {model.limits.map((limit, idx) => (
                  <li key={idx} className="text-sm">
                    <strong>{limit.name}:</strong> {limit.value}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {model.price && (
            <div>
              <h3 className="text-sm font-medium mb-2">Pricing</h3>
              <p className="text-sm">
                <strong>Input:</strong> ${model.price.input}/1M tokens
              </p>
              <p className="text-sm">
                <strong>Output:</strong> ${model.price.output}/1M tokens
              </p>
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p><strong>URI:</strong> {resourceUri}</p>
            <p><strong>Created:</strong> {data.created_at}</p>
            <p><strong>Updated:</strong> {data.updated_at}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button onClick={() => {
            // TODO: Implement edit functionality
            console.log("Edit model", model);
          }}>
            Edit Model
          </Button>
          <Button variant="outline" onClick={() => {
            // TODO: Implement test functionality
            console.log("Test model", model);
          }}>
            Test Model
          </Button>
        </div>
      </Card>
    </div>
  );
}

