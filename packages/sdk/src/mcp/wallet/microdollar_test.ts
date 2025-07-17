import { assertEquals, assertThrows } from "jsr:@std/assert";
import { MicroDollar } from "./microdollar.ts";

Deno.test("MicroDollar - fromMicrodollarString and toMicrodollarString", async (t) => {
  await t.step("should handle zero values", () => {
    const zero = MicroDollar.fromMicrodollarString("0");
    assertEquals(zero.toMicrodollarString(), "000000");
    assertEquals(zero.toDollars(), 0);
  });

  await t.step("should handle positive integer dollars", () => {
    const oneDollar = MicroDollar.fromMicrodollarString("1000000");
    assertEquals(oneDollar.toMicrodollarString(), "1_000000");
    assertEquals(oneDollar.toDollars(), 1);

    const tenDollars = MicroDollar.fromMicrodollarString("10000000");
    assertEquals(tenDollars.toMicrodollarString(), "10_000000");
    assertEquals(tenDollars.toDollars(), 10);
  });

  await t.step("should handle fractional dollars", () => {
    const fiftyCents = MicroDollar.fromMicrodollarString("500000");
    assertEquals(fiftyCents.toMicrodollarString(), "500000");
    assertEquals(fiftyCents.toDollars(), 0.5);

    const oneCent = MicroDollar.fromMicrodollarString("10000");
    assertEquals(oneCent.toMicrodollarString(), "010000");
    assertEquals(oneCent.toDollars(), 0.01);
  });

  await t.step("should handle values with underscores", () => {
    const value = MicroDollar.fromMicrodollarString("1_000000");
    assertEquals(value.toMicrodollarString(), "1_000000");
    assertEquals(value.toDollars(), 1);
  });

  await t.step("should handle large values", () => {
    const largeValue = MicroDollar.fromMicrodollarString("123456789_123456");
    assertEquals(largeValue.toMicrodollarString(), "123456789_123456");
    assertEquals(largeValue.toDollars(), 123456789.123456);
  });
});

Deno.test("MicroDollar - negative values", async (t) => {
  await t.step("should handle negative zero", () => {
    const negativeZero = MicroDollar.fromMicrodollarString("-0");
    assertEquals(negativeZero.toMicrodollarString(), "000000");
    assertEquals(negativeZero.toDollars(), 0);
    assertEquals(negativeZero.isZero(), true);
    assertEquals(negativeZero.isNegative(), false);
  });

  await t.step("should handle negative integer dollars", () => {
    const negativeOneDollar = MicroDollar.fromMicrodollarString("-1000000");
    assertEquals(negativeOneDollar.toMicrodollarString(), "-1_000000");
    assertEquals(negativeOneDollar.toDollars(), -1);
    assertEquals(negativeOneDollar.isNegative(), true);

    const negativeTenDollars = MicroDollar.fromMicrodollarString("-10000000");
    assertEquals(negativeTenDollars.toMicrodollarString(), "-10_000000");
    assertEquals(negativeTenDollars.toDollars(), -10);
    assertEquals(negativeTenDollars.isNegative(), true);
  });

  await t.step("should handle negative fractional dollars", () => {
    const negativeFiftyCents = MicroDollar.fromMicrodollarString("-500000");
    assertEquals(negativeFiftyCents.toMicrodollarString(), "-500000");
    assertEquals(negativeFiftyCents.toDollars(), -0.5);
    assertEquals(negativeFiftyCents.isNegative(), true);

    const negativeOneCent = MicroDollar.fromMicrodollarString("-10000");
    assertEquals(negativeOneCent.toMicrodollarString(), "-010000");
    assertEquals(negativeOneCent.toDollars(), -0.01);
    assertEquals(negativeOneCent.isNegative(), true);
  });

  await t.step("should handle large negative values", () => {
    const largeNegativeValue = MicroDollar.fromMicrodollarString(
      "-123456789_123456",
    );
    assertEquals(largeNegativeValue.toMicrodollarString(), "-123456789_123456");
    assertEquals(largeNegativeValue.toDollars(), -123456789.123456);
    assertEquals(largeNegativeValue.isNegative(), true);
  });

  await t.step("should handle negative values with underscores", () => {
    const negativeValue = MicroDollar.fromMicrodollarString("-1_000000");
    assertEquals(negativeValue.toMicrodollarString(), "-1_000000");
    assertEquals(negativeValue.toDollars(), -1);
    assertEquals(negativeValue.isNegative(), true);
  });
});

Deno.test("MicroDollar - fromDollars and fromCents with negative values", async (t) => {
  await t.step("should handle negative dollars", () => {
    const negativeDollar = MicroDollar.fromDollars(-1);
    assertEquals(negativeDollar.toDollars(), -1);
    assertEquals(negativeDollar.isNegative(), true);
    assertEquals(negativeDollar.toMicrodollarString(), "-1_000000");

    const negativeFractional = MicroDollar.fromDollars(-1.5);
    assertEquals(negativeFractional.toDollars(), -1.5);
    assertEquals(negativeFractional.isNegative(), true);
    assertEquals(negativeFractional.toMicrodollarString(), "-1_500000");
  });

  await t.step("should handle negative cents", () => {
    const negativeCent = MicroDollar.fromCents(-100);
    assertEquals(negativeCent.toDollars(), -1);
    assertEquals(negativeCent.isNegative(), true);
    assertEquals(negativeCent.toMicrodollarString(), "-1_000000");

    const negativeFiftyCents = MicroDollar.fromCents(-50);
    assertEquals(negativeFiftyCents.toDollars(), -0.5);
    assertEquals(negativeFiftyCents.isNegative(), true);
    assertEquals(negativeFiftyCents.toMicrodollarString(), "-500000");
  });

  await t.step("should handle zero from dollars", () => {
    const zero = MicroDollar.fromDollars(0);
    assertEquals(zero.toDollars(), 0);
    assertEquals(zero.isNegative(), false);
    assertEquals(zero.isZero(), true);
    assertEquals(zero.toMicrodollarString(), "000000");
  });

  await t.step("should handle negative zero from dollars", () => {
    const negativeZero = MicroDollar.fromDollars(-0);
    assertEquals(negativeZero.toDollars(), 0);
    assertEquals(negativeZero.isNegative(), false);
    assertEquals(negativeZero.isZero(), true);
    assertEquals(negativeZero.toMicrodollarString(), "000000");
  });
});

Deno.test("MicroDollar - arithmetic operations with negative values", async (t) => {
  await t.step("should add negative values", () => {
    const positive = MicroDollar.fromDollars(10);
    const negative = MicroDollar.fromDollars(-3);
    const result = positive.add(negative);
    assertEquals(result.toDollars(), 7);
    assertEquals(result.isNegative(), false);
  });

  await t.step("should add two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    const result = negative1.add(negative2);
    assertEquals(result.toDollars(), -8);
    assertEquals(result.isNegative(), true);
  });

  await t.step("should subtract negative values", () => {
    const positive = MicroDollar.fromDollars(10);
    const negative = MicroDollar.fromDollars(-3);
    const result = positive.subtract(negative); // 10 - (-3) = 13
    assertEquals(result.toDollars(), 13);
    assertEquals(result.isNegative(), false);
  });

  await t.step("should subtract from negative values", () => {
    const negative = MicroDollar.fromDollars(-5);
    const positive = MicroDollar.fromDollars(3);
    const result = negative.subtract(positive); // -5 - 3 = -8
    assertEquals(result.toDollars(), -8);
    assertEquals(result.isNegative(), true);
  });

  await t.step("should multiply negative values", () => {
    const negative = MicroDollar.fromDollars(-2);
    const result = negative.multiply(3);
    assertEquals(result.toDollars(), -6);
    assertEquals(result.isNegative(), true);
  });

  await t.step("should multiply by negative multiplier", () => {
    const positive = MicroDollar.fromDollars(2);
    const result = positive.multiply(-3);
    assertEquals(result.toDollars(), -6);
    assertEquals(result.isNegative(), true);
  });

  await t.step("should divide negative values", () => {
    const negative = MicroDollar.fromDollars(-6);
    const result = negative.divide(2);
    assertEquals(result.toDollars(), -3);
    assertEquals(result.isNegative(), true);
  });

  await t.step("should divide by negative divisor", () => {
    const positive = MicroDollar.fromDollars(6);
    const result = positive.divide(-2);
    assertEquals(result.toDollars(), -3);
    assertEquals(result.isNegative(), true);
  });
});

Deno.test("MicroDollar - abs() method", async (t) => {
  await t.step("should return absolute value of positive", () => {
    const positive = MicroDollar.fromDollars(5);
    const abs = positive.abs();
    assertEquals(abs.toDollars(), 5);
    assertEquals(abs.isNegative(), false);
  });

  await t.step("should return absolute value of negative", () => {
    const negative = MicroDollar.fromDollars(-5);
    const abs = negative.abs();
    assertEquals(abs.toDollars(), 5);
    assertEquals(abs.isNegative(), false);
  });

  await t.step("should return zero for zero", () => {
    const zero = MicroDollar.ZERO;
    const abs = zero.abs();
    assertEquals(abs.toDollars(), 0);
    assertEquals(abs.isNegative(), false);
    assertEquals(abs.isZero(), true);
  });
});

Deno.test("MicroDollar - compare() method with negative values", async (t) => {
  await t.step("should compare positive and negative", () => {
    const positive = MicroDollar.fromDollars(5);
    const negative = MicroDollar.fromDollars(-3);
    assertEquals(positive.compare(negative), 1);
    assertEquals(negative.compare(positive), -1);
  });

  await t.step("should compare two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    assertEquals(negative1.compare(negative2), -1); // -5 < -3
    assertEquals(negative2.compare(negative1), 1); // -3 > -5
  });

  await t.step("should compare equal values", () => {
    const value1 = MicroDollar.fromDollars(-3);
    const value2 = MicroDollar.fromDollars(-3);
    assertEquals(value1.compare(value2), 0);
  });
});

Deno.test("MicroDollar - max() method with negative values", async (t) => {
  await t.step("should return max of positive and negative", () => {
    const positive = MicroDollar.fromDollars(5);
    const negative = MicroDollar.fromDollars(-3);
    const max = MicroDollar.max(positive, negative);
    assertEquals(max.toDollars(), 5);
  });

  await t.step("should return max of two negative values", () => {
    const negative1 = MicroDollar.fromDollars(-5);
    const negative2 = MicroDollar.fromDollars(-3);
    const max = MicroDollar.max(negative1, negative2);
    assertEquals(max.toDollars(), -3); // -3 is greater than -5
  });
});

Deno.test("MicroDollar - display() method with negative values", async (t) => {
  await t.step("should display negative values correctly", () => {
    const negative = MicroDollar.fromDollars(-1.50);
    const display = negative.display();
    assertEquals(display, "-$1.50");
  });

  await t.step("should display negative values with all decimals", () => {
    const negative = MicroDollar.fromDollars(-1.123456);
    const display = negative.display({ showAllDecimals: true });
    assertEquals(display, "-$1.123456");
  });
});

Deno.test("MicroDollar - edge cases and error handling", async (t) => {
  await t.step("should handle division by zero", () => {
    const value = MicroDollar.fromDollars(10);
    assertThrows(() => value.divide(0), Error, "Division by zero");
  });

  await t.step("should handle very small negative values", () => {
    const tinyNegative = MicroDollar.fromMicrodollarString("-1");
    assertEquals(tinyNegative.toDollars(), -0.000001);
    assertEquals(tinyNegative.isNegative(), true);
    assertEquals(tinyNegative.toMicrodollarString(), "-000001");
  });

  await t.step("should handle very large negative values", () => {
    const largeNegative = MicroDollar.fromMicrodollarString(
      "-999999999999_999999",
    );
    // eslint-disable-next-line eslint(no-loss-of-precision)
    assertEquals(largeNegative.toDollars(), -999999999999.999999);
    assertEquals(largeNegative.isNegative(), true);
    assertEquals(largeNegative.toMicrodollarString(), "-999999999999_999999");
  });
});
