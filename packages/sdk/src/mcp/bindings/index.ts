import { TRIGGER_INPUT_BINDING_SCHEMA } from "./trigger.ts";

export { type Binder } from "./binder.ts";
export * from "./utils.ts";
export * from "./trigger.ts";
// should not export binder.ts because it is a server-side only file

export const WellKnownBindings = {
  Input: TRIGGER_INPUT_BINDING_SCHEMA,
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
