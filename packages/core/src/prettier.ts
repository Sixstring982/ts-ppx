import { CodeFormatterPlugin } from ".";
import prettier from "@prettier/sync";
import { Options } from "prettier";

export type PrettierCodeFormatterPlugin = CodeFormatterPlugin;
export const PrettierCodeFormatterPlugin = {
  make: (options?: Options): PrettierCodeFormatterPlugin => {
    return {
      name: "prettier",
      formatCode: (source: string): string => {
        return prettier.format(source, options);
      },
    };
  },
};
