import { Filesystem, runTsPpx } from "@ts-ppx/core";
import { FastCheckCodeGeneratorPlugin } from "@ts-ppx/fast-check";
import { PrettierCodeFormatterPlugin } from "@ts-ppx/prettier";
import { ZodTsPpxPluginConfig } from "@ts-ppx/zod";
import path from "path";

runTsPpx({
  filesystem: Filesystem.makeFs(),
  sourceRoot: "./src",
  codeGenerators: [
    ZodTsPpxPluginConfig.make({
      codegenImportFromSourceImport: (path: string) => {
        return path.replace(".ppx", "");
      },
      codegenPathFromSourcePath: (path: string) => {
        return path.replace(".ppx", "");
      },
    }),
    FastCheckCodeGeneratorPlugin.make({
      codegenImportFromSourceImport: (path: string) => {
        return path.replace(".ppx", "");
      },
      codegenPathFromSourcePath: (filename) => {
        const dir = path.dirname(filename);
        let base = path.basename(filename);
        base = base.replace(".ppx", "");

        return path.join(dir, "testing", base);
      },
    }),
  ],
  codeFormatters: [
    PrettierCodeFormatterPlugin.make({
      parser: "typescript",
    }),
  ],
});
