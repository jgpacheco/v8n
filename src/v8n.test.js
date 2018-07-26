import v8n from "./v8n";
import Rule from "./Rule";
import ValidationException from "./ValidationException";

beforeEach(() => {
  v8n.clearCustomRules();
});

describe("chaining", () => {
  const validation = v8n()
    .string()
    .not.every.lowercase()
    .not.null()
    .first("a")
    .last("e")
    .some.equal("l")
    .length(3, 5);

  it("should chain rules", () => {
    expect(debugRules(validation)).toEqual([
      "string()",
      "not.every.lowercase()",
      "not.null()",
      'first("a")',
      'last("e")',
      'some.equal("l")',
      "length(3, 5)"
    ]);
  });
});

describe("the 'validation' object", () => {
  it("should be immutable", () => {
    const a = v8n().number();
    const b = a.not.equal(10);
    expect(a).not.toBe(b);
    expect(a.test(10)).toBeTruthy();
    expect(b.test(10)).toBeFalsy();
  });
});

describe("execution functions", () => {
  describe("the 'test' function", () => {
    const validation = v8n()
      .number()
      .between(10, 20)
      .not.odd();

    it("should return false for invalid value", () => {
      expect(validation.test("Hello")).toBeFalsy();
      expect(validation.test(22)).toBeFalsy();
      expect(validation.test(13)).toBeFalsy();
    });

    it("should return true for valid value", () => {
      expect(validation.test(12)).toBeTruthy();
    });
  });

  describe("the 'testAll' function", () => {
    const validation = v8n()
      .string()
      .last("o")
      .not.includes("a");

    it("should return an array with a ValidationException for each failed rule", () => {
      const result = validation.testAll(100);
      expect(result).toHaveLength(2);
      for (let i = 0; i < result.length; i++) {
        expect(result[i].rule).toBe(validation.chain[i]);
        expect(result[i].value).toBe(100);
      }
    });

    it("should return an empty array if all rules passed", () => {
      expect(validation.testAll("Hello")).toHaveLength(0);
    });
  });

  describe("the 'check' function", () => {
    const validation = v8n()
      .string()
      .maxLength(3);

    it("should throw exception for invalid value", () => {
      expect(() => validation.check("abcd")).toThrow();
    });

    it("should pass through for valid value", () => {
      expect(() => validation.check("abc")).not.toThrow();
    });

    describe("the thrown exception", () => {
      let exception;

      try {
        validation.check("Hello");
      } catch (ex) {
        exception = ex;
      }

      it("should have rule object", () => {
        expect(exception.rule).toBeInstanceOf(Rule);
      });

      it("should have the validated value", () => {
        expect(exception.value).toBe("Hello");
      });
    });
  });

  describe("the 'testAsync' function", () => {
    beforeEach(() => {
      v8n.extend({ asyncRule });
    });

    it("should return a promise", () => {
      const validation = v8n()
        .minLength(2)
        .asyncRule("Hello");

      expect(validation.testAsync("Hello")).toBeInstanceOf(Promise);
    });

    it("should execute rules in sequence", async () => {
      const validation = v8n()
        .minLength(2)
        .asyncRule("Hi")
        .asyncRule("Hello");

      expect.assertions(4);

      try {
        await validation.testAsync("Hello");
      } catch (ex) {
        expect(ex.rule.name).toBe("asyncRule");
        expect(ex.value).toBe("Hello");
      }

      try {
        await validation.testAsync("Hi");
      } catch (ex) {
        expect(ex.rule.name).toBe("asyncRule");
        expect(ex.value).toBe("Hi");
      }
    });

    describe("working with modifiers", () => {
      it("should work with the 'not' modifier", async () => {
        const validation = v8n()
          .minLength(2)
          .not.asyncRule("Hello");

        expect.assertions(2);

        try {
          await validation.testAsync("Hello");
        } catch (ex) {
          expect(ex.rule.name).toEqual("asyncRule");
          expect(ex.value).toEqual("Hello");
        }
      });

      it("should work with mixed modifiers", async () => {
        const val1 = v8n()
          .some.equal("a")
          .not.every.vowel()
          .length(3);

        await expect(val1.testAsync("abc")).resolves.toBe("abc");
        await expect(val1.testAsync("aei")).rejects.toBeDefined();
        await expect(val1.testAsync("efg")).rejects.toBeDefined();
        await expect(val1.testAsync("abcd")).rejects.toBeDefined();

        const val2 = v8n()
          .some.even()
          .some.odd()
          .not.length(2);

        await expect(val2.testAsync([1, 2, 3])).resolves.toEqual([1, 2, 3]);
        await expect(val2.testAsync([1, 2])).rejects.toBeDefined();
        await expect(val2.testAsync([2, 4, 6])).rejects.toBeDefined();
        await expect(val2.testAsync([1, 3, 5])).rejects.toBeDefined();

        const val3 = v8n()
          .length(3)
          .every.even()
          .not.some.equal(2);

        await expect(val3.testAsync([4, 6, 8])).resolves.toEqual([4, 6, 8]);
        await expect(val3.testAsync([4, 6, 7])).rejects.toBeDefined();
        await expect(val3.testAsync([4, 5, 6, 7])).rejects.toBeDefined();
        await expect(val3.testAsync([2, 4, 6])).rejects.toBeDefined();

        const val4 = v8n()
          .not.every.lowercase()
          .not.every.uppercase();

        await expect(val4.testAsync("abc")).rejects.toBeDefined();
        await expect(val4.testAsync("ABU")).rejects.toBeDefined();
        await expect(val4.testAsync("aBc")).resolves.toEqual("aBc");
        await expect(val4.testAsync("AbC")).resolves.toEqual("AbC");
      });
    });

    describe("the returned Promise", () => {
      it("should resolves when valid", async () => {
        const validation = v8n()
          .string()
          .minLength(3)
          .asyncRule("Hello");

        const result = await validation.testAsync("Hello");
        expect(result).toEqual("Hello");
      });

      it("should rejects with ValidationException when invalid", async () => {
        const validation = v8n()
          .minLength(2)
          .asyncRule("Hello");

        expect.assertions(2);
        try {
          await validation.testAsync("Hi");
        } catch (ex) {
          expect(ex.rule.name).toBe("asyncRule");
          expect(ex.value).toBe("Hi");
        }
      });

      it("should rejects with with ValidationException when exception occurs", async () => {
        const validation = v8n()
          .number()
          .between(0, 50)
          .includes("a");

        expect.assertions(3);

        try {
          await validation.testAsync(10);
        } catch (ex) {
          expect(ex.rule.name).toBe("includes");
          expect(ex.value).toBe(10);
          expect(ex.cause).toBeDefined();
        }
      });
    });
  });
});

describe("modifiers", () => {
  describe("the 'not' modifier", () => {
    it("should invert the next rule meaning", () => {
      const validation = v8n()
        .number()
        .not.between(2, 8)
        .not.even();

      expect(validation.test(4)).toBeFalsy();
      expect(validation.test(6)).toBeFalsy();
      expect(validation.test(11)).toBeTruthy();

      expect(() => validation.check(4)).toThrow();
      expect(() => validation.check(6)).toThrow();
      expect(() => validation.check(11)).not.toThrow();
    });

    test("double negative", () => {
      const validation = v8n()
        .not.not.number()
        .not.not.positive();

      expect(validation.test(1)).toBeTruthy();
      expect(() => validation.check(12)).not.toThrow();
      expect(validation.test("12")).toBeFalsy();
      expect(() => validation.check(-1)).toThrow();
    });
  });

  describe("the 'some' modifier", () => {
    it("expect that rule passes on some array value", () => {
      const validation = v8n().some.positive();
      expect(validation.test([-1, -2, -3])).toBeFalsy();
      expect(validation.test(10)).toBeFalsy();
      expect(validation.test([-1, -2, 1])).toBeTruthy();
      expect(validation.test([1, 2, 3])).toBeTruthy();
    });
  });

  describe("the 'every' modifier", () => {
    it("expect that rule passes for every array value", () => {
      const validation = v8n().every.positive();
      expect(validation.test([1, 2, 3, -1])).toBeFalsy();
      expect(validation.test(10)).toBeFalsy();
      expect(validation.test([1, 2, 3])).toBeTruthy();
    });
  });

  test("should be able to mix modifiers", () => {
    const validation = v8n().not.some.positive();
    expect(validation.test([-1, -2, 1])).toBeFalsy();
    expect(validation.test([-1, -2, -3])).toBeTruthy();
    expect(validation.test([-5, -5, -1])).toBeTruthy();
  });

  test("fluency", async () => {
    // some item should not be 2
    const a = v8n().some.not.exact(2);
    expect(a.test([2, 2, 3])).toBeTruthy();
    expect(a.test([2, 2, 2])).toBeFalsy();

    // all items should not be 2
    const b = v8n().not.some.exact(2);
    expect(b.test([2, 3, 3])).toBeFalsy();
    expect(b.test([3, 3, 3])).toBeTruthy();

    const c = v8n()
      .not.every.even()
      .some.not.exact(3);
    expect(c.test([2, 4, 6])).toBeFalsy();
    expect(c.test([3, 3, 3])).toBeFalsy();
    expect(c.test([2, 3, 4])).toBeTruthy();
    expect(c.test([2, 4, 5])).toBeTruthy();
  });
});

describe("rules", () => {
  test("equal", () => {
    const is = v8n().equal("123");
    expect(is.test("123")).toBeTruthy();
    expect(is.test(123)).toBeTruthy();
    expect(is.test("Hello")).toBeFalsy();

    const not = v8n().not.equal(123);
    expect(not.test("123")).toBeFalsy();
    expect(not.test(123)).toBeFalsy();
    expect(not.test("Hello")).toBeTruthy();
  });

  test("exact", () => {
    const is = v8n().exact("123");
    expect(is.test("123")).toBeTruthy();
    expect(is.test(123)).toBeFalsy();
    expect(is.test("Hello")).toBeFalsy();

    const not = v8n().not.exact(123);
    expect(not.test(123)).toBeFalsy();
    expect(not.test("123")).toBeTruthy();
    expect(not.test("Hello")).toBeTruthy();
  });

  test("pattern", () => {
    const validation = v8n().pattern(/^[a-z]+$/);
    expect(validation.test("a")).toBeTruthy();
    expect(validation.test("ab")).toBeTruthy();
    expect(validation.test(" ")).toBeFalsy();
    expect(validation.test("A")).toBeFalsy();
    expect(validation.test("Ab")).toBeFalsy();
  });

  test("string", () => {
    const validation = v8n().string();
    expect(validation.test("hello")).toBeTruthy();
    expect(validation.test("")).toBeTruthy();
    expect(validation.test(" ")).toBeTruthy();
    expect(validation.test(123)).toBeFalsy();
    expect(validation.test(true)).toBeFalsy();
    expect(validation.test(false)).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
    expect(validation.test()).toBeFalsy();
    expect(validation.test(null)).toBeFalsy();
  });

  test("undefined", () => {
    const is = v8n().undefined();
    expect(is.test()).toBeTruthy();
    expect(is.test(undefined)).toBeTruthy();
    expect(is.test(null)).toBeFalsy();
    expect(is.test("")).toBeFalsy();
    expect(is.test(0)).toBeFalsy();
    expect(is.test(false)).toBeFalsy();

    const not = v8n().not.undefined();
    expect(not.test()).toBeFalsy();
    expect(not.test(undefined)).toBeFalsy();
    expect(not.test(null)).toBeTruthy();
    expect(not.test("")).toBeTruthy();
    expect(not.test(0)).toBeTruthy();
    expect(not.test(false)).toBeTruthy();
  });

  test("null", () => {
    const is = v8n().null();
    expect(is.test(null)).toBeTruthy();
    expect(is.test()).toBeFalsy();
    expect(is.test(undefined)).toBeFalsy();
    expect(is.test("")).toBeFalsy();
    expect(is.test(0)).toBeFalsy();
    expect(is.test(false)).toBeFalsy();

    const not = v8n().not.null();
    expect(not.test(null)).toBeFalsy();
    expect(not.test()).toBeTruthy();
    expect(not.test(undefined)).toBeTruthy();
    expect(not.test("")).toBeTruthy();
    expect(not.test(0)).toBeTruthy();
    expect(not.test(false)).toBeTruthy();
  });

  test("array", () => {
    const validation = v8n().array();
    expect(validation.test([])).toBeTruthy();
    expect(validation.test([1, 2])).toBeTruthy();
    expect(validation.test(new Array())).toBeTruthy();
    expect(validation.test(null)).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
    expect(validation.test("string")).toBeFalsy();
  });

  test("number", () => {
    const validation = v8n().number();
    expect(validation.test(34)).toBeTruthy();
    expect(validation.test(-10)).toBeTruthy();
    expect(validation.test("1")).toBeFalsy();
    expect(validation.test(null)).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
  });

  test("boolean", () => {
    const validation = v8n().boolean();
    expect(validation.test(true)).toBeTruthy();
    expect(validation.test(false)).toBeTruthy();
    expect(validation.test(1)).toBeFalsy();
    expect(validation.test(0)).toBeFalsy();
    expect(validation.test(null)).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
  });

  test("lowercase", () => {
    const validation = v8n().lowercase();
    expect(validation.test("")).toBeFalsy();
    expect(validation.test(" ")).toBeFalsy();
    expect(validation.test("aBc")).toBeFalsy();
    expect(validation.test("abc")).toBeTruthy();
    expect(validation.test("abc def g")).toBeTruthy();
    expect(validation.test(true)).toBeTruthy();
    expect(validation.test(1)).toBeFalsy();
  });

  test("uppercase", () => {
    const validation = v8n().uppercase();
    expect(validation.test("")).toBeFalsy();
    expect(validation.test(" ")).toBeFalsy();
    expect(validation.test("A")).toBeTruthy();
    expect(validation.test("ABC")).toBeTruthy();
    expect(validation.test("ABC DEF G")).toBeTruthy();
    expect(validation.test("abc")).toBeFalsy();
    expect(validation.test("Abc")).toBeFalsy();
  });

  test("first", () => {
    const letter = v8n().first("n");
    expect(letter.test("n")).toBeTruthy();
    expect(letter.test("nice")).toBeTruthy();
    expect(letter.test(null)).toBeFalsy();
    expect(letter.test("N")).toBeFalsy();
    expect(letter.test("wrong")).toBeFalsy();
    expect(letter.test(undefined)).toBeFalsy();
    expect(letter.test(["n", "i", "c", "e"])).toBeTruthy();
    expect(letter.test(["a", "b", "c"])).toBeFalsy();

    const number = v8n().first(2);
    expect(number.test(20)).toBeFalsy();
    expect(number.test(12)).toBeFalsy();
    expect(number.test([2, 3])).toBeTruthy();
    expect(number.test([1, 2])).toBeFalsy();
  });

  test("last", () => {
    const letter = v8n().last("d");
    expect(letter.test("d")).toBeTruthy();
    expect(letter.test("old")).toBeTruthy();
    expect(letter.test(undefined)).toBeFalsy();
    expect(letter.test("D")).toBeFalsy();
    expect(letter.test("don't")).toBeFalsy();
    expect(letter.test(null)).toBeFalsy();

    const number = v8n().last(2);
    expect(number.test(32)).toBeFalsy();
    expect(number.test(23)).toBeFalsy();
    expect(number.test([3, 2])).toBeTruthy();
    expect(number.test([2, 3])).toBeFalsy();
  });

  test("vowel", () => {
    const validation = v8n().vowel();
    expect(validation.test("aeiou")).toBeTruthy();
    expect(validation.test("AEIOU")).toBeTruthy();
    expect(validation.test("abcde")).toBeFalsy();
    expect(validation.test("ABCDE")).toBeFalsy();
  });

  test("consonant", () => {
    const validation = v8n().consonant();
    expect(validation.test("abcde")).toBeFalsy();
    expect(validation.test("bcdf")).toBeTruthy();
    expect(validation.test("^")).toBeFalsy();
    expect(validation.test("ç")).toBeFalsy();
  });

  test("empty", () => {
    const validation = v8n().empty();
    expect(validation.test("")).toBeTruthy();
    expect(validation.test(" ")).toBeFalsy();
    expect(validation.test("ab")).toBeFalsy();
    expect(validation.test([])).toBeTruthy();
    expect(validation.test([, ,])).toBeFalsy();
    expect(validation.test([1, 2])).toBeFalsy();
  });

  test("length", () => {
    const minAndMax = v8n().length(3, 4);
    expect(minAndMax.test("ab")).toBeFalsy();
    expect(minAndMax.test("abc")).toBeTruthy();
    expect(minAndMax.test("abcd")).toBeTruthy();
    expect(minAndMax.test("abcde")).toBeFalsy();
    expect(minAndMax.test([1, 2])).toBeFalsy();
    expect(minAndMax.test([1, 2, 3])).toBeTruthy();
    expect(minAndMax.test([1, 2, 3, 4])).toBeTruthy();
    expect(minAndMax.test([1, 2, 3, 4, 5])).toBeFalsy();

    const exact = v8n().length(3);
    expect(exact.test("ab")).toBeFalsy();
    expect(exact.test("abc")).toBeTruthy();
    expect(exact.test("abcd")).toBeFalsy();
    expect(exact.test([1, 2])).toBeFalsy();
    expect(exact.test([1, 2, 3])).toBeTruthy();
    expect(exact.test([1, 2, 3, 4])).toBeFalsy();
  });

  test("minLength", () => {
    const validation = v8n().minLength(2);
    expect(validation.test("a")).toBeFalsy();
    expect(validation.test("ab")).toBeTruthy();
    expect(validation.test("abc")).toBeTruthy();
    expect(validation.test("abcd")).toBeTruthy();
  });

  test("maxLength", () => {
    const validation = v8n().maxLength(3);
    expect(validation.test("a")).toBeTruthy();
    expect(validation.test("ab")).toBeTruthy();
    expect(validation.test("abc")).toBeTruthy();
    expect(validation.test("abcd")).toBeFalsy();
  });

  test("negative", () => {
    const validation = v8n().negative();
    expect(validation.test(-1)).toBeTruthy();
    expect(validation.test(0)).toBeFalsy();
    expect(validation.test(1)).toBeFalsy();
  });

  test("positive", () => {
    const validation = v8n().positive();
    expect(validation.test(-1)).toBeFalsy();
    expect(validation.test(0)).toBeTruthy();
    expect(validation.test(1)).toBeTruthy();
  });

  test("lessThan", () => {
    const is = v8n().lessThan(3);
    expect(is.test(1)).toBeTruthy();
    expect(is.test(2)).toBeTruthy();
    expect(is.test(-4)).toBeTruthy();
    expect(is.test(3)).toBeFalsy();
    expect(is.test(4)).toBeFalsy();

    const not = v8n().not.lessThan(3);
    expect(not.test(1)).toBeFalsy();
    expect(not.test(2)).toBeFalsy();
    expect(not.test(-4)).toBeFalsy();
    expect(not.test(3)).toBeTruthy();
    expect(not.test(4)).toBeTruthy();
  });

  test("lessThanOrEqualTo", () => {
    const is = v8n().lessThanOrEqual(3);
    expect(is.test(-4)).toBeTruthy();
    expect(is.test(-3)).toBeTruthy();
    expect(is.test(1)).toBeTruthy();
    expect(is.test(2)).toBeTruthy();
    expect(is.test(3)).toBeTruthy();
    expect(is.test(4)).toBeFalsy();

    const not = v8n().not.lessThanOrEqual(3);
    expect(not.test(-4)).toBeFalsy();
    expect(not.test(-3)).toBeFalsy();
    expect(not.test(1)).toBeFalsy();
    expect(not.test(2)).toBeFalsy();
    expect(not.test(3)).toBeFalsy();
    expect(not.test(4)).toBeTruthy();
  });

  test("greaterThan", () => {
    const is = v8n().greaterThan(3);
    expect(is.test(2)).toBeFalsy();
    expect(is.test(-3)).toBeFalsy();
    expect(is.test(3)).toBeFalsy();
    expect(is.test(4)).toBeTruthy();

    const not = v8n().not.greaterThan(3);
    expect(not.test(2)).toBeTruthy();
    expect(not.test(-3)).toBeTruthy();
    expect(not.test(3)).toBeTruthy();
    expect(not.test(4)).toBeFalsy();
  });

  test("greaterThanOrEqual", () => {
    const is = v8n().greaterThanOrEqual(3);
    expect(is.test(2)).toBeFalsy();
    expect(is.test(-3)).toBeFalsy();
    expect(is.test(3)).toBeTruthy();
    expect(is.test(4)).toBeTruthy();

    const not = v8n().not.greaterThanOrEqual(3);
    expect(not.test(2)).toBeTruthy();
    expect(not.test(-3)).toBeTruthy();
    expect(not.test(3)).toBeFalsy();
    expect(not.test(4)).toBeFalsy();
  });

  test("range", () => {
    const is = v8n().range(2, 4);
    expect(is.test(1)).toBeFalsy();
    expect(is.test(5)).toBeFalsy();
    expect(is.test(2)).toBeTruthy();
    expect(is.test(3)).toBeTruthy();
    expect(is.test(4)).toBeTruthy();

    const not = v8n().not.range(2, 4);
    expect(not.test(1)).toBeTruthy();
    expect(not.test(5)).toBeTruthy();
    expect(not.test(2)).toBeFalsy();
    expect(not.test(3)).toBeFalsy();
    expect(not.test(4)).toBeFalsy();
  });

  test("even", () => {
    const validation = v8n().even();
    expect(validation.test(-2)).toBeTruthy();
    expect(validation.test(-1)).toBeFalsy();
    expect(validation.test(0)).toBeTruthy();
    expect(validation.test(1)).toBeFalsy();
    expect(validation.test(2)).toBeTruthy();
  });

  test("odd", () => {
    const validation = v8n().odd();
    expect(validation.test(-2)).toBeFalsy();
    expect(validation.test(-1)).toBeTruthy();
    expect(validation.test(0)).toBeFalsy();
    expect(validation.test(1)).toBeTruthy();
    expect(validation.test(2)).toBeFalsy();
  });

  test("between", () => {
    const is = v8n().between(3, 5);
    expect(is.test(2)).toBeFalsy();
    expect(is.test(3)).toBeTruthy();
    expect(is.test(4)).toBeTruthy();
    expect(is.test(5)).toBeTruthy();
    expect(is.test(6)).toBeFalsy();

    const not = v8n().not.between(3, 5);
    expect(not.test(2)).toBeTruthy();
    expect(not.test(3)).toBeFalsy();
    expect(not.test(4)).toBeFalsy();
    expect(not.test(5)).toBeFalsy();
    expect(not.test(6)).toBeTruthy();
  });

  test("includes", () => {
    const is = v8n().includes("2");
    expect(is.test(["1", "2", "3"])).toBeTruthy();
    expect(is.test(["1", "3"])).toBeFalsy();
    expect(is.test(["1", "2"])).toBeTruthy();
    expect(is.test("123")).toBeTruthy();
    expect(is.test("13")).toBeFalsy();
    expect(is.test([1, 2, 3])).toBeFalsy();
    expect(is.test(2)).toBeFalsy();

    const not = v8n().not.includes("2");
    expect(not.test(["1", "2", "3"])).toBeFalsy();
    expect(not.test(["1", "3"])).toBeTruthy();
    expect(not.test(["1", "2"])).toBeFalsy();
    expect(not.test("123")).toBeFalsy();
    expect(not.test("13")).toBeTruthy();
    expect(not.test([1, 2, 3])).toBeTruthy();
    expect(not.test(2)).toBeTruthy();
  });

  test("integer", () => {
    const is = v8n().integer();
    expect(is.test(0)).toBeTruthy();
    expect(is.test(12)).toBeTruthy();
    expect(is.test(99999999999)).toBeTruthy();
    expect(is.test(-100000)).toBeTruthy();
    expect(is.test("12")).toBeFalsy();
    expect(is.test(3.14)).toBeFalsy();
    expect(is.test(NaN)).toBeFalsy();
    expect(is.test(Infinity)).toBeFalsy();

    const not = v8n().not.integer();
    expect(not.test(0)).toBeFalsy();
    expect(not.test(12)).toBeFalsy();
    expect(not.test(99999999999)).toBeFalsy();
    expect(not.test(-100000)).toBeFalsy();
    expect(not.test("12")).toBeTruthy();
    expect(not.test(3.14)).toBeTruthy();
    expect(not.test(NaN)).toBeTruthy();
    expect(not.test(Infinity)).toBeTruthy();
  });

  describe("schema", () => {
    const is = v8n().schema({
      one: v8n().equal(1),
      two: v8n().schema({
        three: v8n().equal(3),
        four: v8n().equal(4),
        five: v8n().schema({
          six: v8n().equal(6)
        })
      })
    });

    const not = v8n().not.schema({
      one: v8n().equal(1),
      two: v8n().schema({
        three: v8n().equal(3),
        four: v8n().equal(4),
        five: v8n().schema({
          six: v8n().equal(6)
        })
      })
    });

    const validObj = { one: 1, two: { three: 3, four: 4, five: { six: 6 } } };
    const invalidObj = { one: "Hello" };

    it("should work with validation", () => {
      const result = is.testAll(invalidObj);
      expect(result[0].cause).toHaveLength(2);
      expect(result[0].cause[0].rule.name).toBe("equal");
      expect(result[0].cause[1].rule.name).toBe("schema");
      expect(result[0].cause[1].cause).toHaveLength(3);
      expect(result[0].cause[1].cause[2].rule.name).toBe("schema");
      expect(result[0].cause[1].cause[2].cause[0].target).toBe("six");

      expect(is.test(validObj)).toBeTruthy();
      expect(is.test(invalidObj)).toBeFalsy();
      expect(not.test(validObj)).toBeFalsy();
      expect(not.test(invalidObj)).toBeTruthy();
    });

    it("should work with nested validations", () => {
      expect.assertions(12);

      try {
        is.check(invalidObj);
      } catch (ex) {
        expect(ex.cause).toHaveLength(2);
        expect(ex.cause[0].rule.name).toBe("equal");
        expect(ex.cause[0].value).toBe(invalidObj.one);
        expect(ex.cause[1].rule.name).toBe("schema");
        expect(ex.cause[1].cause).toHaveLength(3);
        expect(ex.cause[1].cause[0].rule.name).toBe("equal");
        expect(ex.cause[1].cause[1].rule.name).toBe("equal");
        expect(ex.cause[1].cause[2].rule.name).toBe("schema");
        expect(ex.cause[1].cause[2].cause[0].target).toBe("six");
      }

      expect(() => is.check(validObj)).not.toThrow();
      expect(() => not.check(invalidObj)).not.toThrow();
      expect(() => not.check(validObj)).toThrow();
    });
  });
});

describe("custom rules", () => {
  it("should be chainable", () => {
    v8n.extend({
      newRule: () => value => true
    });

    const validation = v8n()
      .string()
      .newRule()
      .lowercase();

    expect(debugRules(validation)).toEqual([
      "string()",
      "newRule()",
      "lowercase()"
    ]);
  });

  it("should be used in validation", () => {
    v8n.extend({
      or: (a, b) => value => value === a || value === b
    });

    const validation = v8n()
      .string()
      .or("one", "two");

    expect(validation.test("one")).toBeTruthy();
    expect(validation.test("two")).toBeTruthy();
    expect(validation.test("three")).toBeFalsy();
  });

  it("should be inverted by 'not' modifier", () => {
    v8n.extend({
      exact: it => value => value === it
    });

    const validation = v8n()
      .string()
      .not.exact("hello");

    expect(validation.test("hi")).toBeTruthy();
    expect(validation.test("nice")).toBeTruthy();
    expect(validation.test("hello")).toBeFalsy();
  });

  test("extend should be able to call multiple times", () => {
    v8n.extend({
      one: () => value => true
    });

    v8n.extend({
      two: () => value => true
    });

    const validation = v8n()
      .one()
      .two();

    expect(debugRules(validation)).toEqual(["one()", "two()"]);
  });

  describe("the 'clearCustomRules' function", () => {
    beforeEach(() => {
      v8n.extend({
        asyncRule
      });
    });

    it("should clear custom rules", () => {
      expect(v8n().asyncRule).toBeDefined();
      v8n.clearCustomRules();
      expect(v8n().asyncRule).toBeUndefined();
    });
  });
});

describe("fluency", () => {
  test("fluency test 1", () => {
    const validation = v8n()
      .array()
      .some.positive()
      .some.negative()
      .not.every.even()
      .includes(6);

    expect(validation.test(10)).toBeFalsy();
    expect(validation.test([1, 2, 3, 6])).toBeFalsy();
    expect(validation.test([-1, -2, -3])).toBeFalsy();
    expect(validation.test([2, -2, 4, 6])).toBeFalsy();
    expect(validation.test([2, -2, 4, 6, 7])).toBeTruthy();
  });

  test("fluency test 2", () => {
    const validation = v8n()
      .some.odd()
      .some.not.odd()
      .length(3);

    expect(validation.test([1, 3, 5])).toBeFalsy();
    expect(validation.test([1, 2, 3])).toBeTruthy();
    expect(validation.test([1, 2, 3, 4])).toBeFalsy();
  });

  test("fluency test 3", () => {
    const validation = v8n()
      .not.every.positive()
      .some.not.even()
      .not.some.equal(3);

    expect(validation.test([1, 2, 4])).toBeFalsy();
    expect(validation.test([-2, 2, 3])).toBeFalsy();
    expect(validation.test([-2, 2, 4])).toBeFalsy();
    expect(validation.test([-2, 2, 5])).toBeTruthy();
  });

  test("fluency test 4", () => {
    const validation = v8n()
      .not.every.equal(2)
      .every.positive()
      .every.even();

    expect(validation.test([2, 2, 2])).toBeFalsy();
    expect(validation.test([2, 2, -4])).toBeFalsy();
    expect(validation.test([4, 4, 4])).toBeTruthy();
  });

  test("fluency test 5", () => {
    const validation = v8n()
      .string()
      .first("H")
      .not.last("o")
      .not.every.consonant()
      .minLength(3);

    expect(validation.test("Hello")).toBeFalsy();
    expect(validation.test("Hi")).toBeFalsy();
    expect(validation.test("Hbrn")).toBeFalsy();
    expect(validation.test("Hbon")).toBeTruthy();
  });
});

describe("random tests", () => {
  test("random test 1", () => {
    const validation = v8n()
      .number()
      .even()
      .positive();

    expect(validation.test(-2)).toBeFalsy();
    expect(validation.test(-1)).toBeFalsy();
    expect(validation.test(0)).toBeTruthy();
    expect(validation.test(1)).toBeFalsy();
    expect(validation.test(2)).toBeTruthy();
  });

  test("random test 2", () => {
    const validation = v8n()
      .string()
      .minLength(2)
      .maxLength(5)
      .lowercase()
      .first("b")
      .last("o");

    expect(validation.test("bruno")).toBeTruthy();
    expect(validation.test("bruna")).toBeFalsy();
    expect(validation.test("druno")).toBeFalsy();
    expect(validation.test("Bruno")).toBeFalsy();
    expect(validation.test("Bruno")).toBeFalsy();
    expect(validation.test("brunno")).toBeFalsy();
  });

  test("random test 3", () => {
    const validation = v8n()
      .array()
      .minLength(3)
      .maxLength(4)
      .first(2)
      .last("o");

    expect(validation.test([2, "tree", "four", "lo"])).toBeFalsy();
    expect(validation.test([2, "tree", "four", "o"])).toBeTruthy();
    expect(validation.test([2, "tree", "four", "five", "o"])).toBeFalsy();
    expect(validation.test([2, "o"])).toBeFalsy();
    expect(validation.test("234o")).toBeFalsy();
  });

  test("random test 4", () => {
    const validation = v8n()
      .between(10, 20)
      .not.between(12, 14)
      .not.between(16, 18);

    expect(validation.test(9)).toBeFalsy();
    expect(validation.test(10)).toBeTruthy();
    expect(validation.test(11)).toBeTruthy();
    expect(validation.test(12)).toBeFalsy();
    expect(validation.test(13)).toBeFalsy();
    expect(validation.test(14)).toBeFalsy();
    expect(validation.test(15)).toBeTruthy();
    expect(validation.test(16)).toBeFalsy();
    expect(validation.test(17)).toBeFalsy();
    expect(validation.test(18)).toBeFalsy();
    expect(validation.test(19)).toBeTruthy();
    expect(validation.test(20)).toBeTruthy();
    expect(validation.test(21)).toBeFalsy();
  });

  test("random test 5", () => {
    const validation = v8n()
      .number()
      .not.maxLength(5) // Have no max length
      .not.minLength(3); // Have no min length

    expect(validation.test(2)).toBeTruthy();
    expect(validation.test(3)).toBeTruthy();
    expect(validation.test(4)).toBeTruthy();
    expect(validation.test(5)).toBeTruthy();
    expect(validation.test(6)).toBeTruthy();
  });

  test("random test 6", () => {
    const validation = v8n()
      .not.number()
      .not.string();

    expect(validation.test(1)).toBeFalsy();
    expect(validation.test("hello")).toBeFalsy();
    expect(validation.test(undefined)).toBeTruthy();
    expect(validation.test(null)).toBeTruthy();
    expect(validation.test(true)).toBeTruthy();
    expect(validation.test(false)).toBeTruthy();
    expect(validation.test({})).toBeTruthy();
    expect(validation.test([])).toBeTruthy();
    expect(validation.test(Symbol())).toBeTruthy();
  });

  test("random test 7", () => {
    const validation = v8n()
      .array()
      .not.empty()
      .minLength(3)
      .not.includes("a")
      .not.includes("b");

    expect(validation.test(["a", "b", "d"])).toBeFalsy();
    expect(validation.test(["a", "c", "d"])).toBeFalsy();
    expect(validation.test([])).toBeFalsy();
    expect(validation.test(["d", "e"])).toBeFalsy();
    expect(validation.test(["d", "e", "f"])).toBeTruthy();
  });

  test("random test 8", () => {
    const validation = v8n()
      .not.null()
      .between(10, 20)
      .not.equal(15);

    expect(validation.test(9)).toBeFalsy();
    expect(validation.test(21)).toBeFalsy();
    expect(validation.test(15)).toBeFalsy();
    expect(validation.test(10)).toBeTruthy();
    expect(validation.test(12)).toBeTruthy();
    expect(validation.test(17)).toBeTruthy();
    expect(validation.test(20)).toBeTruthy();
  });

  test("random test 9", async () => {
    v8n.extend({ asyncRule });

    const validation = v8n()
      .number()
      .asyncRule([10, 17, 20])
      .not.even();

    await expect(validation.testAsync("10")).rejects.toBeDefined();
    await expect(validation.testAsync(11)).rejects.toBeDefined();
    await expect(validation.testAsync(17)).resolves.toBe(17);
  });
});

function debugRules(validation) {
  return validation.chain.map(ruleId);
}

function ruleId({ name, modifiers, args }) {
  const modifiersStr = modifiers.map(it => it.name).join(".");
  const argsStr = args.map(parseArg).join(", ");
  return `${modifiersStr ? modifiersStr + "." : ""}${name}(${argsStr})`;
}

function parseArg(arg) {
  return typeof arg === "string" ? `"${arg}"` : `${arg}`;
}

function asyncRule(expected, delay = 50, exception) {
  return value =>
    new Promise(resolve => {
      setTimeout(() => {
        if (exception) {
          throw exception;
        }
        resolve(value == expected || expected.includes(value));
      }, delay);
    });
}
