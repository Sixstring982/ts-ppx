/** @ts-ppx(zod, fast-check) */
export type FruityviceRequest = Readonly<{
  fruitName: string;
  minSomething?: number;
}>;

/** @ts-ppx(zod, fast-check) */
export type FruityviceResponse = Readonly<{
  name: string;
  id: number;
  family: string;
  genus: string;
  order: string;
  nutritions: Nutritions;
}>;

/** @ts-ppx(zod, fast-check) */
export type Nutritions = Readonly<{
  carbohydrates: number;
  protein: number;
  fat: number;
  calories: number;
  sugar: number;
}>;
