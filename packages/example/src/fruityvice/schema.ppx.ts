import { Nutritions } from "./nutritions";

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
