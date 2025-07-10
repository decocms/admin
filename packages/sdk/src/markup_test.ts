import { assertEquals, assertThrows } from "jsr:@std/assert";
import { Markup } from "./plan.ts";
import type { PlanWithTeamMetadata } from "./plan.ts";

const usd = (dollars: number) => dollars * 100;

Deno.test("Markup.add", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  assertEquals(result, usd(110));
});

Deno.test("Markup.remove", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(110);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.add and Markup.remove are inverses", () => {
  const plan = {
    markup: 10,
  } as PlanWithTeamMetadata;
  const amount = usd(100);
  const resultAdd = Markup.add({
    usdCents: amount,
    markupPercentage: plan.markup,
  });
  const resultRemove = Markup.remove({
    usdCents: resultAdd,
    markupPercentage: plan.markup,
  });
  assertEquals(resultRemove, amount);
});

Deno.test("Markup.add with 0% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 0,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.remove with 0% markup", () => {
  const amount = usd(100);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 0,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.add with 100% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 100,
  });
  assertEquals(result, usd(200));
});

Deno.test("Markup.remove with 100% markup", () => {
  const amount = usd(200);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 100,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.add with 25% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 25,
  });
  assertEquals(result, usd(125));
});

Deno.test("Markup.remove with 25% markup", () => {
  const amount = usd(125);
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 25,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.add with 33.33% markup", () => {
  const amount = usd(100);
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 33.33,
  });
  assertEquals(result, 13333); // $133.33
});

Deno.test("Markup.remove with 33.33% markup", () => {
  const amount = 13333; // $133.33
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 33.33,
  });
  assertEquals(result, usd(100));
});

Deno.test("Markup.add with small amount", () => {
  const amount = 1; // $0.01
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 1); // Should round to 1 cent
});

Deno.test("Markup.remove with small amount", () => {
  const amount = 1; // $0.01
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 1); // Should round to 1 cent
});

Deno.test("Markup.add with large amount", () => {
  const amount = usd(10000); // $10,000
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 15,
  });
  assertEquals(result, usd(11500)); // $11,500
});

Deno.test("Markup.remove with large amount", () => {
  const amount = usd(11500); // $11,500
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 15,
  });
  assertEquals(result, usd(10000)); // $10,000
});

Deno.test("Markup.add with fractional cents", () => {
  const amount = 999; // $9.99
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 1099); // $10.99
});

Deno.test("Markup.remove with fractional cents", () => {
  const amount = 1099; // $10.99
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 999); // $9.99
});

Deno.test("Markup.add with rounding precision", () => {
  const amount = 333; // $3.33
  const result = Markup.add({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 366); // $3.66 (rounded)
});

Deno.test("Markup.remove with rounding precision", () => {
  const amount = 366; // $3.66
  const result = Markup.remove({
    usdCents: amount,
    markupPercentage: 10,
  });
  assertEquals(result, 333); // $3.33 (rounded)
});

Deno.test("Markup operations are inverses with various percentages", () => {
  const testCases = [
    { amount: usd(50), markup: 5 },
    { amount: usd(75.50), markup: 12.5 },
    { amount: usd(200), markup: 20 },
    { amount: usd(999.99), markup: 33.33 },
    { amount: 1, markup: 50 },
    { amount: usd(10000), markup: 7.5 },
  ];

  testCases.forEach(({ amount, markup }) => {
    const resultAdd = Markup.add({
      usdCents: amount,
      markupPercentage: markup,
    });
    const resultRemove = Markup.remove({
      usdCents: resultAdd,
      markupPercentage: markup,
    });
    assertEquals(
      resultRemove,
      amount,
      `Failed for amount ${amount} with markup ${markup}%`,
    );
  });
});

Deno.test("Markup.add with negative markup throws", () => {
  const amount = usd(100);
  assertThrows(() => {
    Markup.add({
      usdCents: amount,
      markupPercentage: -10,
    });
  });
});

Deno.test("Markup.remove with negative markup throws", () => {
  const amount = usd(90);
  assertThrows(() => {
    Markup.remove({
      usdCents: amount,
      markupPercentage: -10,
    });
  });
});
