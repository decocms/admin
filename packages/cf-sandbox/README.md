# CF Sandbox

A JavaScript sandbox implementation using QuickJS for secure code execution in
Cloudflare Workers.

## Features

- **Secure Execution**: Code runs in an isolated QuickJS context
- **Function Arguments**: Pass serializable data and host functions to sandboxed
  code
- **Host Function Proxies**: Function arguments execute in the host context, not
  the sandbox
- **Backward Compatible**: Existing code using `evalFunction(code)` continues to
  work

## Usage

### Basic Code Execution (Backward Compatible)

```typescript
import { createSandboxRuntime } from "@deco/cf-sandbox";

const sandbox = await createSandboxRuntime("my-tenant");
const context = sandbox.createContext();

// Execute code directly (existing behavior)
const result = await context.evalFunction(`
  const x = 10;
  const y = 20;
  return x + y;
`);

console.log(result.value); // 30
```

### Function Execution with Arguments

```typescript
// Define a function to execute in the sandbox
const fnString = `(data, callback) => {
  console.log("In sandbox, received data:", data);
  const processed = data * 2;
  console.log("Calling host callback with:", processed);
  const result = callback(processed);
  console.log("Host callback returned:", result);
  return result;
}`;

// Host function that executes in the host context
const hostCallback = (value: number) => {
  console.log("Host callback executed with:", value);
  return `Host processed: ${value * 3}`;
};

// Execute the function with arguments
const result = await context.evalFunction(
  fnString,
  42, // serializable argument
  hostCallback, // function argument (executes in host)
);

console.log(result.value); // "Host processed: 252"
```

### Async Function Support

The sandbox automatically handles both synchronous and asynchronous functions:

```typescript
// Synchronous function
const syncFn = `(x) => {
  return x * 2;
}`;

const syncResult = await context.evalFunction(syncFn, 21);
console.log(syncResult.value); // 42

// Asynchronous function
const asyncFn = `async (x) => {
  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 100));
  return x * 3;
}`;

const asyncResult = await context.evalFunction(asyncFn, 14);
console.log(asyncResult.value); // 42

// Mixed async/sync with promises
const mixedFn = `(x) => {
  // Return a promise directly
  return fetch('https://api.example.com/data')
    .then(response => response.json())
    .then(data => data.value * x);
}`;

const mixedResult = await context.evalFunction(mixedFn, 2);
console.log(mixedResult.value); // Result from API * 2
```

### Mixed Arguments Example

```typescript
const fnString = `(obj, fn, str) => {
  console.log("In sandbox, received object:", obj);
  console.log("In sandbox, received string:", str);
  const result = fn(obj.value);
  return { original: obj, processed: result, message: str };
}`;

const hostProcessor = (value: number) => {
  console.log("Host processor executed with:", value);
  return value * 10;
};

const result = await context.evalFunction(
  fnString,
  { value: 5, name: "test" }, // serializable object
  hostProcessor, // host function
  "Mixed args test", // serializable string
);

console.log(result.value);
// {
//   original: { value: 5, name: "test" },
//   processed: 50,
//   message: "Mixed args test"
// }
```

## API Reference

### `evalFunction<T>(codeOrFnString: string, ...args: unknown[]): Promise<EvaluationResult<T>>`

Evaluates code in the sandbox context.

**Parameters:**

- `codeOrFnString`: JavaScript code string or function string to execute
- `...args`: Optional arguments to pass to the function

**Behavior:**

- If no arguments provided: executes the code string directly (backward
  compatible)
- If arguments provided: treats the first parameter as a function string and
  calls it with the provided arguments
- **Promise handling**: All code is wrapped in async functions to automatically
  handle both sync and async returns

**Argument Handling:**

- **Serializable arguments**: JSON-serializable values are serialized and passed
  to the sandbox
- **Function arguments**: Functions are proxied to execute in the host context,
  not the sandbox
- **Async support**: Functions can return promises, which are automatically
  awaited

**Returns:**

```typescript
interface EvaluationResult<T = unknown> {
  value?: T; // The result of the evaluation
  error?: unknown; // Any error that occurred
  logs: Array<{ // Console logs from the sandbox
    type: "log" | "warn" | "error";
    content: string;
  }>;
}
```

## Security Considerations

- All code executes in an isolated QuickJS context
- Host functions execute in the host context, not the sandbox
- Memory and execution time limits can be configured
- Console output is captured and returned as logs
