import type { Context } from "./types/Context";

export const handler = async (_: unknown, ctx: Context): Promise<unknown> => {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  // const url = new URL("/version", ctx.config.BASE_URL);

  // const response = await fetch(url, {
  //   method: "GET",
  // });

  // const data = await response.json();

  return {
    value: 1,
  };
};
