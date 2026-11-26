import { describe, expect, it } from "vitest";
import { toF } from "../src/ui/units";

describe("toF", () => {
  it("converts single values, ranges and millions", () => {
    expect(toF("464 °C")).toBe("867 °F");
    expect(toF("−173 to 427 °C")).toBe("−279 to 801 °F");
    expect(toF("~15 million °C")).toBe("~27 million °F");
    expect(toF("Cloud tops near −200 °C and winds")).toBe("Cloud tops near −328 °F and winds");
    expect(toF("15 °C average")).toBe("59 °F average");
    expect(toF("427 °C DAYSIDE")).toBe("801 °F DAYSIDE");
  });
});
