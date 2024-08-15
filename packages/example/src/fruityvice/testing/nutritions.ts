import fc from "fast-check";
import { Arbitrary } from "fast-check";
import { type Nutritions as $Nutritions } from "./../nutritions.ppx";

export type Nutritions = $Nutritions;
export function arbitraryNutritions(): Arbitrary<Nutritions> {
  return fc.record({
    carbohydrates: fc.double(),
    protein: fc.double(),
    fat: fc.double(),
    calories: fc.double(),
    sugar: fc.double(),
  });
}
