import fc from "fast-check";
import { Arbitrary } from "fast-check";
import { type FruityviceRequest as $FruityviceRequest } from "./../schema.ppx";
import { type FruityviceResponse as $FruityviceResponse } from "./../schema.ppx";
import { type Nutritions as $Nutritions } from "./../schema.ppx";

export type FruityviceRequest = $FruityviceRequest;
export function arbitraryFruityviceRequest(): Arbitrary<FruityviceRequest> {
  return fc.record({
    fruitName: fc.string(),
    minSomething: fc.oneof(fc.constant(undefined), fc.double()),
  });
}
export type FruityviceResponse = $FruityviceResponse;
export function arbitraryFruityviceResponse(): Arbitrary<FruityviceResponse> {
  return fc.record({
    name: fc.string(),
    id: fc.double(),
    family: fc.string(),
    genus: fc.string(),
    order: fc.string(),
    nutritions: arbitraryNutritions(),
  });
}
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
