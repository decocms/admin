import {
  assertEquals,
  assertExists,
  assertNotEquals,
} from "https://deno.land/std/testing/asserts.ts";
import { generateDefaultValues } from "./generateDefaultValues.ts";
import { JSONSchema7 } from "json-schema";

Deno.test("generateDefaultValues - empty or invalid schema", () => {
  // Test with null or undefined schema
  assertEquals(generateDefaultValues(null as unknown as JSONSchema7), {});
  assertEquals(generateDefaultValues(undefined as unknown as JSONSchema7), {});

  // Test with non-object schema
  assertEquals(generateDefaultValues({ type: "string" } as JSONSchema7), {});
});

Deno.test("generateDefaultValues - schema with default value", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "object",
    default: { name: "Default Name", age: 25 },
  };

  const result = generateDefaultValues(schemaWithDefault);
  assertEquals(result.name, "Default Name");
  assertEquals(result.age, 25);
});

Deno.test("generateDefaultValues - basic object properties", () => {
  // Test object schema with properties
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      isActive: { type: "boolean" },
    },
    required: ["name", "isActive"],
  };

  const result = generateDefaultValues(schema);

  // Should have required properties
  assertExists(result.name);
  assertEquals(result.name, "");

  assertExists(result.isActive);
  assertEquals(result.isActive, false);

  // Should not have optional properties
  assertEquals(result.age, undefined);
});

Deno.test("generateDefaultValues - with formData", () => {
  // Test using existing form data
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      isActive: { type: "boolean" },
    },
  };

  const formData = {
    name: "John Doe",
    age: 30,
  };

  const result = generateDefaultValues(schema, formData);

  // Should preserve properties from formData
  assertExists(result.name);
  assertEquals(result.name, "John Doe");

  assertExists(result.age);
  assertEquals(result.age, 30);

  // Properties not in formData should not be included
  assertEquals(result.isActive, undefined);
});

Deno.test("generateDefaultValues - anyOf schema", () => {
  // Test anyOf schema
  const anyOfSchema: JSONSchema7 = {
    anyOf: [
      {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      },
      {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
        },
        required: ["firstName", "lastName"],
      },
    ],
  };

  // Should select a schema from anyOf options
  const result = generateDefaultValues(anyOfSchema);
  assertNotEquals(result, {});

  // Test anyOf with matching form data
  const formData = {
    firstName: "John",
    lastName: "Doe",
  };

  const resultWithFormData = generateDefaultValues(anyOfSchema, formData);
  assertExists(resultWithFormData.firstName);
  assertExists(resultWithFormData.lastName);
  assertEquals(resultWithFormData.firstName, "John");
  assertEquals(resultWithFormData.lastName, "Doe");
});

Deno.test("generateDefaultValues - nested objects", () => {
  // Test schema with nested objects
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
  const result = generateDefaultValues(nestedSchema) as any;

  // Check nested structure
  assertExists(result.user);
  assertExists(result.user.name);
  assertExists(result.user.address);
  assertExists(result.user.address.street);
  assertEquals(result.user.address.street, "");
  assertEquals(result.user.address.city, undefined);
});

Deno.test("generateDefaultValues - nested objects with formData", () => {
  // Test schema with nested objects
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

  const formData = {
    user: {
      name: "John Smith",
      address: {
        street: "123 Main St",
        city: "Anytown",
      },
    },
  };

  // deno-lint-ignore no-explicit-any
  const result = generateDefaultValues(nestedSchema, formData) as Record<string, any>;

  // Check that nested structure preserves formData values
  assertExists(result.user);
  assertEquals(result.user.name, "John Smith");
  assertExists(result.user.address);
  assertEquals(result.user.address.street, "123 Main St");
  assertEquals(result.user.address.city, "Anytown");
});

Deno.test("generateDefaultValues - with field path", () => {
  // Test with field path parameter
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const result = generateDefaultValues(schema, undefined, "user");

  assertExists(result.name);
  assertExists(result.age);
  assertEquals(result.name, "");
  assertEquals(result.age, 0);
});

Deno.test("generateDefaultValues - with formData type mismatch", () => {
  // Test handling of form data that doesn't match schema type
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string", default: "Default Name" },
      age: { type: "number", default: 25 },
      isActive: { type: "boolean", default: true },
    },
  };

  const formData = {
    name: 42, // Not a string
    age: "thirty", // Not a number
    isActive: "yes", // Not a boolean
  };

  const result = generateDefaultValues(schema, formData);

  // Should use default values when types don't match
  assertEquals(result.name, "Default Name");
  assertEquals(result.age, 25);
  assertEquals(result.isActive, true);
});
