import { assertEquals, assertExists } from "@std/assert";
import {
  doesChildFieldMatchSchema,
  doesSchemaTypeMatchValue,
  findMatchingAnyOfSchema,
  formatPropertyName,
  getDefaultAnyOfSchema,
  getDetectedType,
  selectAnyOfSchema,
  typeMatches,
} from "./schema.ts";
import { JSONSchema7 } from "json-schema";

Deno.test("formatPropertyName", () => {
  // Test camelCase to Title Case
  assertEquals(formatPropertyName("firstName"), "First Name");

  // Test snake_case to Title Case (won't work without additional handling)
  assertEquals(formatPropertyName("first_name"), "First_name");

  // Test already capitalized word
  assertEquals(formatPropertyName("FirstName"), "First Name");

  // Test single character
  assertEquals(formatPropertyName("a"), "A");

  // Test empty string
  assertEquals(formatPropertyName(""), "");
});

Deno.test("getDetectedType", () => {
  // Test primitive types
  assertEquals(getDetectedType("string value"), "string");
  assertEquals(getDetectedType(123), "number");
  assertEquals(getDetectedType(true), "boolean");

  // Test null
  assertEquals(getDetectedType(null), "null");

  // Test arrays
  assertEquals(getDetectedType([1, 2, 3]), "array");
  assertEquals(getDetectedType([]), "array");

  // Test objects
  assertEquals(getDetectedType({ key: "value" }), "object");
  assertEquals(getDetectedType({}), "object");
});

Deno.test("doesSchemaTypeMatchValue", () => {
  // Test undefined schema type (should match anything)
  assertEquals(doesSchemaTypeMatchValue(undefined, "string"), true);

  // Test string type
  assertEquals(doesSchemaTypeMatchValue("string", "string"), true);
  assertEquals(doesSchemaTypeMatchValue("string", "number"), false);

  // Test number/integer type
  assertEquals(doesSchemaTypeMatchValue("number", "number"), true);
  assertEquals(doesSchemaTypeMatchValue("integer", "number"), true);

  // Test array of types
  assertEquals(doesSchemaTypeMatchValue(["string", "null"], "string"), true);
  assertEquals(
    doesSchemaTypeMatchValue(["string", "number"], "boolean"),
    false,
  );
  assertEquals(doesSchemaTypeMatchValue(["integer", "null"], "number"), true);
});

Deno.test("typeMatches", () => {
  // Test undefined schema type (should match anything)
  assertEquals(typeMatches(undefined, "string"), true);

  // Test string type
  assertEquals(typeMatches("string", "string"), true);
  assertEquals(typeMatches("string", "number"), false);

  // Test number/integer type
  assertEquals(typeMatches("number", "number"), true);
  assertEquals(typeMatches("integer", "number"), true);

  // Test array of types
  assertEquals(typeMatches(["string", "null"], "string"), true);
  assertEquals(typeMatches(["string", "number"], "boolean"), false);
});

Deno.test("findMatchingAnyOfSchema - basic type matching", () => {
  const schemas: JSONSchema7[] = [
    { type: "string" },
    { type: "number" },
    { type: "object", properties: { name: { type: "string" } } },
  ];

  // Test matching by type
  const stringSchema = findMatchingAnyOfSchema(schemas, "test string");
  assertEquals(stringSchema?.type, "string");

  const numberSchema = findMatchingAnyOfSchema(schemas, 42);
  assertEquals(numberSchema?.type, "number");

  // Test no match
  const noMatch = findMatchingAnyOfSchema(schemas, true);
  assertEquals(noMatch, undefined);
});

Deno.test("findMatchingAnyOfSchema - object properties matching", () => {
  const schemas: JSONSchema7[] = [
    {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    },
    {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
      },
    },
  ];

  // Test matching by properties
  const nameAgeSchema = findMatchingAnyOfSchema(
    schemas,
    { name: "John", age: 30 },
  );
  assertExists(nameAgeSchema?.properties?.name);
  assertExists(nameAgeSchema?.properties?.age);

  const nameSchema = findMatchingAnyOfSchema(
    schemas,
    { firstName: "John", lastName: "Doe" },
  );
  assertExists(nameSchema?.properties?.firstName);
  assertExists(nameSchema?.properties?.lastName);
});

Deno.test("findMatchingAnyOfSchema - required properties", () => {
  const schemas: JSONSchema7[] = [
    {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    },
  ];

  // Should match when all required properties exist
  const match = findMatchingAnyOfSchema(
    schemas,
    { name: "John", age: 30 },
  );
  assertExists(match);

  // Should not match when required properties are missing
  const noMatch = findMatchingAnyOfSchema(
    schemas,
    { name: "John" },
  );
  assertEquals(noMatch, undefined);
});

Deno.test("doesChildFieldMatchSchema", () => {
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
  };

  // Test matching field
  assertEquals(doesChildFieldMatchSchema("user.name", "user.", schema), true);
  assertEquals(doesChildFieldMatchSchema("user.age", "user.", schema), true);

  // Test non-matching field
  assertEquals(doesChildFieldMatchSchema("user.email", "user.", schema), false);

  // Test non-object schema
  assertEquals(
    doesChildFieldMatchSchema("user.name", "user.", { type: "string" }),
    false,
  );
});

Deno.test("getDefaultAnyOfSchema", () => {
  // Test schema with default
  const schemasWithDefault: JSONSchema7[] = [
    { type: "string" },
    { type: "number", default: 42 },
    { type: "boolean" },
  ];
  const defaultSchema = getDefaultAnyOfSchema(schemasWithDefault);
  assertEquals(defaultSchema.type, "number");
  assertEquals(defaultSchema.default, 42);

  // Test non-null preference
  const schemasWithNull: JSONSchema7[] = [
    { type: "null" },
    { type: "string" },
    { type: ["number", "null"] },
  ];
  const nonNullSchema = getDefaultAnyOfSchema(schemasWithNull);
  assertEquals(nonNullSchema.type, "string");

  // Test first item fallback
  const basicSchemas: JSONSchema7[] = [
    { type: "boolean" },
    { type: "string" },
  ];
  const firstSchema = getDefaultAnyOfSchema(basicSchemas);
  assertEquals(firstSchema.type, "boolean");
});

Deno.test("selectAnyOfSchema - with form data", () => {
  const schema: JSONSchema7 = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
    ],
  };

  // Test with string data
  const stringSchema = selectAnyOfSchema(schema, "test");
  assertEquals(stringSchema.type, "string");

  // Test with object data
  const objectSchema = selectAnyOfSchema(schema, { name: "John" });
  assertEquals(objectSchema.type, "object");

  // Test with no matching data
  const anySchema = selectAnyOfSchema(schema, true);
  assertExists(anySchema); // Should return default schema
});
