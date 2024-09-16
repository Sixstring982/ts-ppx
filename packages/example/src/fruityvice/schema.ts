import { z } from "zod";
import { type FruityviceRequest as $FruityviceRequest } from "./schema.ppx";
import { type FruityviceResponse as $FruityviceResponse } from "./schema.ppx";
import { Nutritions } from "./nutritions";

export type FruityviceRequest = $FruityviceRequest;
export const FruityviceRequest = {
  schema: () =>
    z
      .object({
        fruitName: z.string(),
        minSomething: z.number().optional(),
      })
      .transform((x): FruityviceRequest => x),
} as const;
export type FruityviceResponse = $FruityviceResponse;
export const FruityviceResponse = {
  schema: () =>
    z
      .object({
        name: z.string(),
        id: z.number(),
        family: z.string(),
        genus: z.string(),
        order: z.string(),
        nutritions: Nutritions.schema(),
      })
      .transform((x): FruityviceResponse => x),
} as const;
