import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { generateDefaultValue } from "./generate-default-value.ts";
import type { JSONSchema7 } from "json-schema";

Deno.test("generateDefaultValue - primitive types", () => {
  // Test string
  const stringSchema: JSONSchema7 = { type: "string" };
  assertEquals(generateDefaultValue(stringSchema), "");

  // Test number
  const numberSchema: JSONSchema7 = { type: "number" };
  assertEquals(generateDefaultValue(numberSchema), 0);

  // Test integer
  const integerSchema: JSONSchema7 = { type: "integer" };
  assertEquals(generateDefaultValue(integerSchema), 0);

  // Test boolean
  const booleanSchema: JSONSchema7 = { type: "boolean" };
  assertEquals(generateDefaultValue(booleanSchema), false);

  // Test null
  const nullSchema: JSONSchema7 = { type: "null" };
  assertEquals(generateDefaultValue(nullSchema), null);
});

Deno.test("generateDefaultValue - with default values", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "string",
    default: "Default Value",
  };
  assertEquals(generateDefaultValue(schemaWithDefault), "Default Value");

  // Test number with default
  const numberWithDefault: JSONSchema7 = {
    type: "number",
    default: 42,
  };
  assertEquals(generateDefaultValue(numberWithDefault), 42);
});

Deno.test("generateDefaultValue - with default values that not match schema", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "string",
    default: "Default Value",
  };
  const wrongValue = 1;
  // We preserve form data even if it doesn't match the schema type
  assertEquals(
    generateDefaultValue(schemaWithDefault, wrongValue),
    "Default Value",
  );

  // Test number with default - special case
  // Setting up the test to check that a string value passed to a number schema
  // would result in using the default value when configured that way
  const numberWithDefault: JSONSchema7 = {
    type: "number",
    default: 42,
  };
  const wrongNumberValue = "not a number";
  // Should use the default value for this special case
  assertEquals(generateDefaultValue(numberWithDefault, wrongNumberValue), 42);
});

Deno.test("generateDefaultValue - enum values", () => {
  // Test schema with enum values
  const enumSchema: JSONSchema7 = {
    type: "string",
    enum: ["option1", "option2", "option3"],
  };
  assertEquals(generateDefaultValue(enumSchema), "option1");
});

Deno.test("generateDefaultValue - object type", () => {
  // Test simple object
  const objectSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  const result = generateDefaultValue(objectSchema) as Record<string, unknown>;

  // Should have the required property
  assertExists(result.name);
  assertEquals(result.name, "");

  // Should not have non-required property
  assertEquals(result.age, undefined);

  // Test object with all required properties
  const allRequiredSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const allRequiredResult = generateDefaultValue(allRequiredSchema) as Record<
    string,
    unknown
  >;

  assertExists(allRequiredResult.name);
  assertExists(allRequiredResult.age);
  assertEquals(allRequiredResult.age, 0);
});

Deno.test("generateDefaultValue - object type with formData doesn't matching schema", () => {
  // Test simple object
  const objectSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  const result = generateDefaultValue(objectSchema, {
    name: "Name ok",
    age: "wrong",
  }) as Record<string, unknown>;

  // Should have the required property
  assertExists(result.name);
  assertEquals(result.name, "Name ok");

  // Should not have non-required property
  assertEquals(result.age, undefined);

  // Test object with all required properties
  const allRequiredSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const allRequiredResult = generateDefaultValue(allRequiredSchema, {
    name: "Name ok",
    age: "wrong",
  }) as Record<string, unknown>;

  assertExists(allRequiredResult.name);
  assertExists(allRequiredResult.age);
  assertEquals(allRequiredResult.age, 0);
});

Deno.test("generateDefaultValue - nested objects", () => {
  // Test nested object
  const nestedSchema: JSONSchema7 = {
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street"],
          },
        },
        required: ["name", "address"],
      },
    },
    required: ["user"],
  };

  // deno-lint-ignore no-explicit-any
  const result = generateDefaultValue(nestedSchema) as Record<string, any>;

  // Check nested structure
  assertExists(result.user);
  assertExists(result.user.name);
  assertExists(result.user.address);
  assertExists(result.user.address.street);
  assertEquals(result.user.address.city, undefined);
});

Deno.test("generateDefaultValue - array type", () => {
  // Test empty array
  const arraySchema: JSONSchema7 = {
    type: "array",
    items: { type: "string" },
  };

  const emptyArray = generateDefaultValue(arraySchema) as string[];
  assertEquals(emptyArray, []);

  // Test array with minItems
  const minItemsSchema: JSONSchema7 = {
    type: "array",
    items: { type: "number" },
    minItems: 2,
  };

  const minItemsArray = generateDefaultValue(minItemsSchema) as number[];
  assertEquals(minItemsArray.length, 2);
  assertEquals(minItemsArray[0], 0);
  assertEquals(minItemsArray[1], 0);
});

Deno.test("generateDefaultValue - anyOf schema", () => {
  // Test anyOf schema
  const anyOfSchema: JSONSchema7 = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    ],
  };

  // Should select a schema from anyOf options
  const result = generateDefaultValue(anyOfSchema);
  assertNotEquals(result, null);
  assertExists(result);
});

Deno.test("generateDefaultValue - with form data", () => {
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  // Should use form data when available
  const formData = { name: "John", age: 30 };
  const result = generateDefaultValue(schema, formData) as Record<
    string,
    unknown
  >;

  // Should preserve form data values
  assertEquals(result.name, "John");
  assertEquals(result.age, 30);
});

Deno.test("generateDefaultValue - array with form data", () => {
  const schema: JSONSchema7 = {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "number" },
      },
      required: ["name"],
    },
  };

  // Should preserve array items
  const formData = [
    { name: "Item 1", value: 10 },
    { name: "Item 2", value: 20 },
  ];

  const result = generateDefaultValue(schema, formData) as {
    name: string;
    value: number;
  }[];

  assertEquals(result.length, 2);
  assertEquals(result[0].name, "Item 1");
  assertEquals(result[0].value, 10);
  assertEquals(result[1].name, "Item 2");
  assertEquals(result[1].value, 20);
});
