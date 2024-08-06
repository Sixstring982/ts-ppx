import { FruityviceRequest, FruityviceResponse } from "./schema";

export function fetchFruit(
  request: FruityviceRequest,
): Promise<FruityviceResponse> {
  const r = new Request(
    `https://fruityvice.com/api/fruit/${request.fruitName}`,
  );

  return fetch(r)
    .then((response) => response.json())
    .then((response) => {
      return FruityviceResponse.schema().parseAsync(response);
    });
}
