import v8n, { CheckException } from "../v8n";

describe("rules chain", () => {
  const validation = v8n()
    .string()
    .lowercase()
    .first("a")
    .last("e")
    .length(3, 5);

  it("should chain rules", () => {
    expect(validation.rulesIds()).toEqual([
      "string()",
      "lowercase()",
      'first("a")',
      'last("e")',
      "length(3, 5)"
    ]);
  });
});

describe("execution functions", () => {
  const args = [1, 3];
  const validation = v8n().length(...args);

  describe("the 'test' function", () => {
    it("should return false for invalid value", () => {
      expect(validation.test("abcd")).toBeFalsy();
    });

    it("should return true for valid value", () => {
      expect(validation.test("ab")).toBeTruthy();
    });
  });

  describe("the 'check' function", () => {
    it("should throw exception for invalid value", () => {
      expect(() => validation.check("abcd")).toThrow();
    });

    it("should pass through for valid value", () => {
      expect(() => validation.check("abc")).not.toThrow();
    });

    describe("the thrown exception", () => {
      const value = "abcd";
      let exception;

      beforeEach(() => {
        try {
          validation.check(value);
        } catch (ex) {
          exception = ex;
        }
      });

      it("should have rule object", () => {
        expect(exception.rule).toMatchObject({
          name: "length",
          args
        });
      });

      it("should have the validated value", () => {
        expect(exception.value).toBe(value);
      });
    });
  });
});

describe("rules", () => {
  test("string", () => {
    const validation = v8n().string();
    expect(validation.test(123)).toBeFalsy();
    expect(validation.test(true)).toBeFalsy();
    expect(validation.test(false)).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
    expect(validation.test()).toBeFalsy();
    expect(validation.test(null)).toBeFalsy();
  });

  test("lowercase", () => {
    const validation = v8n().lowercase();
    expect(validation.test("aBc")).toBeFalsy();
    expect(validation.test("abc")).toBeTruthy();
    expect(validation.test(true)).toBeTruthy();
    expect(validation.test(1)).toBeFalsy();
  });

  test("first", () => {
    const validation = v8n().first("n");
    expect(validation.test("n")).toBeTruthy();
    expect(validation.test("nice")).toBeTruthy();
    expect(validation.test(null)).toBeTruthy();
    expect(validation.test("N")).toBeFalsy();
    expect(validation.test("wrong")).toBeFalsy();
    expect(validation.test(undefined)).toBeFalsy();
  });

  test("last", () => {
    const validation = v8n().last("d");
    expect(validation.test("d")).toBeTruthy();
    expect(validation.test("old")).toBeTruthy();
    expect(validation.test(undefined)).toBeTruthy();
    expect(validation.test("D")).toBeFalsy();
    expect(validation.test("don't")).toBeFalsy();
    expect(validation.test(null)).toBeFalsy();
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

  test("length", () => {
    const validation = v8n().length(3, 4);
    expect(validation.test("ab")).toBeFalsy();
    expect(validation.test("abc")).toBeTruthy();
    expect(validation.test("abcd")).toBeTruthy();
    expect(validation.test("abcde")).toBeFalsy();
    expect(validation.test([1, 2])).toBeFalsy();
    expect(validation.test([1, 2, 3])).toBeTruthy();
    expect(validation.test([1, 2, 3, 4])).toBeTruthy();
    expect(validation.test([1, 2, 3, 4, 5])).toBeFalsy();
  });

  test("type", () => {
    expect(
      v8n()
        .type("number")
        .test(1)
    ).toBeTruthy();

    expect(
      v8n()
        .type("object")
        .test([])
    ).toBeTruthy();

    expect(
      v8n()
        .type("boolean")
        .test("hey")
    ).toBeFalsy();
  });
});

describe("custom rules", () => {
  // Defines the custom rule
  v8n.customRules.myCustomRule = function myCustomRule(a, b) {
    return value => {
      return value === a || value === b;
    };
  };

  const validation = v8n()
    .string()
    .myCustomRule("abc", "cba")
    .lowercase();

  it("should be chainable", () => {
    expect(validation.rulesIds()).toEqual([
      "string()",
      'myCustomRule("abc", "cba")',
      "lowercase()"
    ]);
  });

  it("should be use in validation", () => {
    expect(validation.test("hello")).toBeFalsy();
  });
});
