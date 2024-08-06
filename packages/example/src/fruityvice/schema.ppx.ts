/** @ts-ppx(zod) */
export type FruityviceRequest = Readonly<{
  fruitName: string;
  minSomething?: number | undefined | null;
}>;

/** @ts-ppx(zod) */
export type FruityviceResponse = Readonly<{
  name: string;
  id: number;
  family: string;
  genus: string;
  order: string;
  nutritions: Readonly<{
    carbohydrates: number;
    protein: number;
    fat: number;
    calories: number;
    sugar: number;
  }>
}>
