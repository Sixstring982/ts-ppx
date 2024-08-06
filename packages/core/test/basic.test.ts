import { describe, expect, it } from "vitest";
import { Filesystem, runTsPpx } from "../src/index";
import { ZodTsPpsPluginConfig } from "../src/zod";

describe("runTsPpx", () => {
  it("Generates a Zod parser for an annotated type", () => {
    ////// Arrange
    const filesystem = Filesystem.makeInMemoryFs();
    filesystem.writeFile(
      "index.ts",
      [
        "/** @ts-ppx(zod) */",
        "export type MyType = Readonly<{",
        "  foo: string;",
        "  bar?: number;",
        "  baz: number | bigint | 'wonderful';",
        "  literals: 1 | 2n | '3z' | null;",
        "  booleans: true | false;",
        "}>;",
      ].join("\n"),
    );

    ////// Act
    runTsPpx({
      sourceRoot: "",
      sourcePattern: new RegExp(""),
      plugins: [
        ZodTsPpsPluginConfig.make({
          transformPath: (path) => `generated/${path}`,
        }),
      ],
      filesystem,
    });
    const actual = filesystem.readFile("generated/index.ts");

    ////// Assert
    const expected = [
      "export const MyType = {",
      "  SCHEMA: z.object({",
      "    foo: z.string(),",
      "    bar: z.number().optional(),",
      "    baz: z.union(z.number(), z.bigint(), z.literal('wonderful')),",
      "    literals: z.union(z.literal(1), z.literal(2n), z.literal('3z'), z.null()),",
      "    booleans: z.union(z.literal(true), z.literal(false)),",
      "  }).transform((x): MyType => x),",
      "} as const;",
    ].join("\n");

    expect(actual).toEqual(expected);
  });
});
