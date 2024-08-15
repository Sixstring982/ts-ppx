/** @ts-ppx(zod, fast-check) */
export type Nutritions = Readonly<{
  carbohydrates: number;
  protein: number;
  fat: number;
  calories: number;
  sugar: number;
}>;
