import { describe, it, expect } from "vitest";
import { Binding } from "../src/mcp/bindings/utils.ts";
import { VIEW_BINDING_SCHEMA } from "../src/mcp/bindings/views.ts";

describe("Binding utils", () => {
  describe("View binding", () => {
    const binding = Binding(VIEW_BINDING_SCHEMA);

    describe("isImplementedByTool", () => {
      it("should match exact tool names", () => {
        expect(binding.isImplementedByTool({ name: "DECO_CHAT_VIEW_HOME" })).toBe(true);
        expect(binding.isImplementedByTool({ name: "DECO_CHAT_VIEW_SETTINGS" })).toBe(true);
        expect(binding.isImplementedByTool({ name: "DECO_CHAT_VIEW_ANALYTICS" })).toBe(true);
        expect(binding.isImplementedByTool({ name: "DECO_CHAT_VIEW_HOME_EXTRA" })).toBe(true);
      });

      it("should not match non-matching wildcard patterns", () => {
        expect(binding.isImplementedByTool({ name: "DECO_CHAT_VIEW" })).toBe(false);
        expect(binding.isImplementedByTool({ name: "OTHER_VIEW_HOME" })).toBe(false);
      });
    });

    describe("isImplementedBy", () => {
      it("Integration group is flagged as valid for binding", () => {
        const tools = [
          { name: "DECO_CHAT_VIEW_HOME" },
        ];
        expect(binding.isImplementedBy(tools)).toBe(true);
      });

      it("should return false when implementing tools are missing", () => {
        const tools = [
          { name: "ANY_TOOL" },
        ];
        expect(binding.isImplementedBy(tools)).toBe(false);
      });

      it("should return true when optional tools are missing", () => {
        const tools = [
          { name: "DECO_CHAT_VIEW_HOME" },
          { name: "EXACT_MATCH_TOOL" },
        ];
        expect(binding.isImplementedBy(tools)).toBe(true);
      });
    });

    describe("filterImplementingTools", () => {
      it("should return tools that satisfy the binding", () => {
        const tools = [
          { name: "DECO_CHAT_VIEW_HOME" },
          { name: "DECO_CHAT_VIEW_SETTINGS" },
          { name: "DECO_CHAT_VIEW_ANALYTICS" },
          { name: "DECO_CHAT_VIEW_HOME_EXTRA" },
          { name: "ANY_TOOL" },
        ];
        const filteredTools = binding.filterImplementingTools(tools);
        expect(filteredTools.length).toBe(4);
        expect(filteredTools).toEqual([
          { name: "DECO_CHAT_VIEW_HOME" },
          { name: "DECO_CHAT_VIEW_SETTINGS" },
          { name: "DECO_CHAT_VIEW_ANALYTICS" },
          { name: "DECO_CHAT_VIEW_HOME_EXTRA" },
        ]);
      });
    });
  });
});
