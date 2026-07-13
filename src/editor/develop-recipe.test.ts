import { describe, expect, it } from "vitest";
import { createDefaultDevelopRecipe } from "./develop-recipe";

describe("develop recipe", () => {
  it("contains every phase-two edit as a neutral serializable instruction", () => {
    const recipe = createDefaultDevelopRecipe();
    expect(recipe.version).toBe(3);
    expect(recipe.layers).toEqual([]);
    expect(recipe.basic.whites).toBe(0);
    expect(recipe.basic.texture).toBe(0);
    expect(recipe.detail.sharpeningAmount).toBe(0);
    expect(recipe.curves.master).toHaveLength(2);
    expect(JSON.parse(JSON.stringify(recipe))).toEqual(recipe);
  });
});
