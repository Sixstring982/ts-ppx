import { fetchFruit } from "./fruityvice/service";

fetchFruit({
  fruitName: "banana",
}).then((response) => {
  console.log(response);
});
