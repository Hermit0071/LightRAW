import { describe, expect, it } from "vitest";
import { normalizeLocale, translate } from "./i18n";

describe("interface language", () => {
  it("defaults unknown stored values to Chinese and translates both supported locales", () => {
    expect(normalizeLocale(null)).toBe("zh");
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("fr")).toBe("zh");
    expect(translate("zh", "导入", "Import")).toBe("导入");
    expect(translate("en", "导入", "Import")).toBe("Import");
  });
});
