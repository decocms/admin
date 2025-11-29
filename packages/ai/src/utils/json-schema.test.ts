/* oxlint-disable no-explicit-any */
import { expect, test, describe } from "vitest";
import { fixJsonSchemaArrayItems, patchedJsonSchema } from "./json-schema.ts";
import type { JSONSchema7 } from "ai";
import type { Schema } from "@ai-sdk/provider-utils";
import { z } from "zod/v3";
import { zodToJsonSchema } from "zod-to-json-schema";

describe("fixJsonSchemaArrayItems", () => {
  test("adds items to array without items", () => {
    const schema: JSONSchema7 = {
      type: "array",
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "array",
      items: {},
    });
  });

  test("does not modify array with existing items", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: {
        type: "string",
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "array",
      items: {
        type: "string",
      },
    });
  });

  test("fixes nested array in object properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
        },
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {},
        },
      },
    });
  });

  test("fixes multiple arrays in properties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        tags: {
          type: "array",
        },
        categories: {
          type: "array",
        },
        name: {
          type: "string",
        },
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: {},
        },
        categories: {
          type: "array",
          items: {},
        },
        name: {
          type: "string",
        },
      },
    });
  });

  test("fixes deeply nested arrays", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            posts: {
              type: "array",
            },
          },
        },
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        user: {
          type: "object",
          properties: {
            posts: {
              type: "array",
              items: {},
            },
          },
        },
      },
    });
  });

  test("fixes arrays within array items", () => {
    const schema: JSONSchema7 = {
      type: "array",
      items: {
        type: "object",
        properties: {
          tags: {
            type: "array",
          },
        },
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "array",
      items: {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: {},
          },
        },
      },
    });
  });

  test("fixes array in additionalProperties", () => {
    const schema: JSONSchema7 = {
      type: "object",
      additionalProperties: {
        type: "array",
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      additionalProperties: {
        type: "array",
        items: {},
      },
    });
  });

  test("fixes arrays in anyOf", () => {
    const schema: JSONSchema7 = {
      anyOf: [
        {
          type: "array",
        },
        {
          type: "string",
        },
      ],
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      anyOf: [
        {
          type: "array",
          items: {},
        },
        {
          type: "string",
        },
      ],
    });
  });

  test("fixes arrays in oneOf", () => {
    const schema: JSONSchema7 = {
      oneOf: [
        {
          type: "array",
        },
        {
          type: "object",
          properties: {
            items: {
              type: "array",
            },
          },
        },
      ],
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      oneOf: [
        {
          type: "array",
          items: {},
        },
        {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {},
            },
          },
        },
      ],
    });
  });

  test("fixes arrays in allOf", () => {
    const schema: JSONSchema7 = {
      allOf: [
        {
          type: "object",
          properties: {
            tags: {
              type: "array",
            },
          },
        },
      ],
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      allOf: [
        {
          type: "object",
          properties: {
            tags: {
              type: "array",
              items: {},
            },
          },
        },
      ],
    });
  });

  test("handles null schema", () => {
    const result = fixJsonSchemaArrayItems(null as any);
    expect(result).toBeNull();
  });

  test("handles non-object schema", () => {
    const result = fixJsonSchemaArrayItems(true as any);
    expect(result).toBe(true);
  });

  test("complex nested scenario", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              roles: {
                type: "array",
              },
              metadata: {
                type: "object",
                additionalProperties: {
                  type: "array",
                },
              },
            },
          },
        },
        tags: {
          type: "array",
        },
      },
      additionalProperties: {
        anyOf: [
          {
            type: "array",
          },
          {
            type: "string",
          },
        ],
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              roles: {
                type: "array",
                items: {},
              },
              metadata: {
                type: "object",
                additionalProperties: {
                  type: "array",
                  items: {},
                },
              },
            },
          },
        },
        tags: {
          type: "array",
          items: {},
        },
      },
      additionalProperties: {
        anyOf: [
          {
            type: "array",
            items: {},
          },
          {
            type: "string",
          },
        ],
      },
    });
  });

  test("does not modify schemas without arrays", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: {
          type: "string",
        },
        age: {
          type: "number",
        },
      },
    };

    const result = fixJsonSchemaArrayItems(schema);

    expect(result).toEqual({
      type: "object",
      properties: {
        name: {
          type: "string",
        },
        age: {
          type: "number",
        },
      },
    });
  });
});

describe("patchedJsonSchema", () => {
  test("fixes z.array(z.any()) schema", () => {
    const zodSchema = z.object({
      items: z.array(z.any()),
    });

    const jsonSchemaInput = zodToJsonSchema(zodSchema) as JSONSchema7;
    const result = patchedJsonSchema(jsonSchemaInput) as Schema<any>;

    expect(result.jsonSchema.properties?.items).toEqual({
      type: "array",
      items: {},
    });
  });

  test("preserves normal array schemas", () => {
    const zodSchema = z.object({
      tags: z.array(z.string()),
    });

    const jsonSchemaInput = zodToJsonSchema(zodSchema) as JSONSchema7;
    const result = patchedJsonSchema(jsonSchemaInput) as Schema<any>;

    expect(result.jsonSchema.properties?.tags).toEqual({
      type: "array",
      items: {
        type: "string",
      },
    });
  });

  test("handles nested arrays with z.any()", () => {
    const zodSchema = z.object({
      users: z.array(
        z.object({
          roles: z.array(z.any()),
        }),
      ),
    });

    const jsonSchemaInput = zodToJsonSchema(zodSchema) as JSONSchema7;
    const result = patchedJsonSchema(jsonSchemaInput) as Schema<any>;

    expect(result.jsonSchema.properties?.users).toMatchObject({
      type: "array",
      items: {
        type: "object",
        properties: {
          roles: {
            type: "array",
            items: {},
          },
        },
      },
    });
  });

  test("returns FlexibleSchema with all properties", () => {
    const zodSchema = z.object({
      name: z.string().describe("User name"),
      items: z.array(z.any()),
    });

    const jsonSchemaInput = zodToJsonSchema(zodSchema) as JSONSchema7;
    const result = patchedJsonSchema(jsonSchemaInput) as Schema<any>;

    expect(result).toHaveProperty("jsonSchema");
    expect(result.jsonSchema).toHaveProperty("type", "object");
    expect(result.jsonSchema).toHaveProperty("properties");
    expect(result.jsonSchema.properties?.name).toMatchObject({
      type: "string",
      description: "User name",
    });
  });

  test("handles complex nested structures", () => {
    const zodSchema = z.object({
      data: z.object({
        items: z.array(z.any()),
        metadata: z.object({
          tags: z.array(z.any()),
        }),
      }),
    });

    const jsonSchemaInput = zodToJsonSchema(zodSchema) as JSONSchema7;
    const result = patchedJsonSchema(jsonSchemaInput) as Schema<any>;

    const dataProps = result.jsonSchema.properties?.data as JSONSchema7;
    expect(dataProps.properties?.items).toEqual({
      type: "array",
      items: {},
    });
    const metadataProps = dataProps.properties?.metadata as JSONSchema7;
    expect(metadataProps.properties?.tags).toEqual({
      type: "array",
      items: {},
    });
  });
});
