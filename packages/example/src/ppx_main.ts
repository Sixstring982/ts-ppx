import { Filesystem, runTsPpx } from "@ts-ppx/core";
import { ZodTsPpxPluginConfig } from "@ts-ppx/zod";
import { PrettierCodeFormatterPlugin } from "@ts-ppx/prettier";

runTsPpx({
  filesystem: Filesystem.makeFs(),
  sourceRoot: "./src",
  codeGenerators: [
    ZodTsPpxPluginConfig.make({
      transformPath: (path: string) => {
        return path.replace(".ppx.ts", ".ts");
      },
    }),
  ],
  codeFormatters: [
    PrettierCodeFormatterPlugin.make({
      parser: "typescript",
    }),
  ],
});
