import { z } from "zod";
import { type FruityviceRequest as $FruityviceRequest } from "./schema.ppx";
import { type FruityviceResponse as $FruityviceResponse } from "./schema.ppx";

export type FruityviceRequest = $FruityviceRequest;
export const FruityviceRequest = {
  SCHEMA: z
    .object({
      fruitName: z.string(),
      minSomething: z.union([z.number(), z.undefined(), z.null()]).optional(),
    })
    .transform((x): FruityviceRequest => x),
} as const;
export type FruityviceResponse = $FruityviceResponse;
export const FruityviceResponse = {
  SCHEMA: z
    .object({
      name: z.string(),
      id: z.number(),
      family: z.string(),
      genus: z.string(),
      order: z.string(),
      nutritions: z.object({
        carbohydrates: z.number(),
        protein: z.number(),
        fat: z.number(),
        calories: z.number(),
        sugar: z.number(),
      }),
    })
    .transform((x): FruityviceResponse => x),
} as const;
