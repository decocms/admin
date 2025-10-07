# API Key Reissue Components

Components for re-issuing API keys with new policies.

## Components

### `ReissueApiKey`

The base component that handles the API key reissue logic and UI. Can be embedded anywhere.

**Props:**
- `apiKeyId: string` - The ID of the API key to reissue
- `newPolicies: ApiKeyPolicies` - The new policies to apply (will show diff with current policies)
- `onReissued?: (result: { id: string; value: string }) => void` - Callback when reissue is successful
- `onCancel?: () => void` - Callback when user cancels

**Example:**
```tsx
import { ReissueApiKey } from "./components/api-keys";

function MyComponent() {
  const handleReissued = (result) => {
    console.log("New API key:", result.value);
  };

  return (
    <ReissueApiKey
      apiKeyId="key-123"
      newPolicies={[
        { effect: "allow", resource: "tools:*" },
        { effect: "allow", resource: "agents:*" }
      ]}
      onReissued={handleReissued}
      onCancel={() => console.log("Cancelled")}
    />
  );
}
```

### `ReissueApiKeyDialog`

A dialog wrapper around `ReissueApiKey` for modal usage.

**Props:**
- `open: boolean` - Whether the dialog is open
- `onOpenChange: (open: boolean) => void` - Callback when dialog open state changes
- `apiKeyId: string` - The ID of the API key to reissue
- `newPolicies: ApiKeyPolicies` - The new policies to apply
- `onReissued?: (result: { id: string; value: string }) => void` - Callback when reissue is successful

**Example:**
```tsx
import { useState } from "react";
import { ReissueApiKeyDialog } from "./components/api-keys";

function MyComponent() {
  const [open, setOpen] = useState(false);
  
  const handleReissued = (result) => {
    console.log("New API key:", result.value);
    // Copy to clipboard, show to user, etc.
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>
        Reissue API Key
      </button>
      
      <ReissueApiKeyDialog
        open={open}
        onOpenChange={setOpen}
        apiKeyId="key-123"
        newPolicies={[
          { effect: "allow", resource: "tools:*" },
          { effect: "allow", resource: "agents:read" }
        ]}
        onReissued={handleReissued}
      />
    </>
  );
}
```

## Features

- ✅ Fetches current API key data automatically
- ✅ Shows current permissions
- ✅ Highlights additional permissions being requested
- ✅ Portuguese UI text ("Permissões adicionais sendo requisitadas")
- ✅ Loading and error states
- ✅ Success callback with new API key value
- ✅ Separate base component for flexible usage
- ✅ Dialog wrapper for modal usage

## API Key Policies

Policies follow the `Statement` schema:

```typescript
interface Statement {
  effect: "allow" | "deny";
  resource: string;
  matchCondition?: {
    resource: "is_integration";
    integrationId: string;
  };
}

type ApiKeyPolicies = Statement[];
```

## Dependencies

- `@deco/sdk/hooks` - For `useGetAPIKey` and `useReissueAPIKey`
- `@deco/ui` - For UI components (Button, Dialog, Card, etc.)

