import { z } from "zod";
import { type Nutritions as $Nutritions } from "./nutritions.ppx";

export type Nutritions = $Nutritions;
export const Nutritions = {
  schema: () =>
    z
      .object({
        carbohydrates: z.number(),
        protein: z.number(),
        fat: z.number(),
        calories: z.number(),
        sugar: z.number(),
      })
      .transform((x): Nutritions => x),
} as const;
