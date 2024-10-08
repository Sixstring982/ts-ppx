import fs from "fs";
import {
  ScriptTarget,
  Node,
  createSourceFile,
  JSDocTag,
  SourceFile,
  ImportDeclaration,
  isImportDeclaration,
  isIdentifier,
  TypeReferenceNode,
  isNamedImports,
  SyntaxKind,
} from "typescript";
import { getJsDoc } from "tsutils";
import { Arrays } from "@ts-ppx/common";

export type Filesystem = Readonly<{
  readFile(filename: string): string;
  writeFile(filename: string, contents: string): void;
  readDir(dirName: string): readonly string[];
  stat(path: string): Readonly<{
    isDirectory(): boolean;
    isFile(): boolean;
  }>;
}>;

export const Filesystem = {
  makeFs: (): Filesystem => {
    return {
      readFile: (filename: string): string =>
        fs.readFileSync(filename).toString("utf8"),
      writeFile: (filename: string, contents: string): void =>
        fs.writeFileSync(filename, contents),
      readDir: (dirName: string): readonly string[] =>
        fs.readdirSync(dirName).map((path) => {
          return dirName + "/" + path;
        }),
      stat: (path: string) => fs.statSync(path),
    };
  },
  makeInMemoryFs: (): Filesystem => {
    const contentsByFilename = new Map<string, string>();

    return {
      readFile: (filename: string): string => {
        const content = contentsByFilename.get(filename);
        if (content === undefined)
          throw new Error(`File not found: "${filename}"!`);
        return content;
      },
      writeFile: (filename: string, content: string): void => {
        contentsByFilename.set(filename, content);
      },
      readDir: (_: string): readonly string[] => {
        return [...contentsByFilename.keys()];
      },
      stat: (path: string) => {
        if (!contentsByFilename.has(path)) throw new Error("File not found!");

        return { isDirectory: () => false, isFile: () => true };
      },
    };
  },
} as const;

export type GeneratedFileContents = Readonly<{
  imports: readonly string[];
  topLevelStatements: readonly string[];
}>;

export const GeneratedFileContents = {
  merge(
    a: GeneratedFileContents,
    b: GeneratedFileContents,
  ): GeneratedFileContents {
    return {
      imports: a.imports.concat(b.imports),
      topLevelStatements: a.topLevelStatements.concat(b.topLevelStatements),
    };
  },
} as const;

export type EnrichedImportDeclaration = Readonly<{
  importDeclaration: ImportDeclaration;
  importFilename: string;
}>;

export type CodeGeneratorPlugin = Readonly<{
  name: string;
  codegenPathFromSourcePath: (filename: string) => string;
  codegenImportFromSourceImport: (filename: string) => string;
  generateCode: (
    params: Readonly<{
      node: Node;
      sourceFile: SourceFile;
      codegenPathFromSourcePath: (filename: string) => string;
      codegenImportFromSourceImport: (filename: string) => string;
      findImportForTypeReference: (
        node: TypeReferenceNode,
      ) => EnrichedImportDeclaration | undefined;
      sourceFilename: string;
      targetFilename: string;
    }>,
  ) => GeneratedFileContents;
}>;

export type CodeFormatterPlugin = Readonly<{
  name: string;
  formatCode: (source: string) => string;
}>;

export type Config = Readonly<{
  sourceRoot: string;
  /** If unspecified, will read all files in sourceRoot. */
  sourcePattern?: RegExp;
  codeGenerators: readonly CodeGeneratorPlugin[];
  codeFormatters: readonly CodeFormatterPlugin[];
  filesystem: Filesystem;
}>;

export function runTsPpx(config: Config): void {
  const pluginsByName = new Map<string, CodeGeneratorPlugin>();
  for (const p of config.codeGenerators) {
    pluginsByName.set(p.name, p);
  }

  const generatedFilesByFilename = new Map<string, GeneratedFileContents>();

  for (const filename of genAllTargetFiles(config)) {
    const source = config.filesystem.readFile(filename);

    const sourceFile = createSourceFile(filename, source, ScriptTarget.Latest);

    const importDeclarations: ImportDeclaration[] = [];
    sourceFile.forEachChild((node) => {
      if (isImportDeclaration(node)) {
        importDeclarations.push(node);
      }
    });

    function findImportForTypeReference(
      n: TypeReferenceNode,
    ): EnrichedImportDeclaration | undefined {
      // Check if this type was imported. If it was, we need to import its
      // corresponding Zod schema.
      const importNames = importDeclarations.flatMap((x) => {
        if (!isIdentifier(n.typeName)) return [];

        const importClause = x.importClause;
        if (importClause === undefined) return [];

        const namedBindings = importClause.namedBindings;
        if (namedBindings === undefined) return [];
        if (!isNamedImports(namedBindings)) return [];

        for (const e of namedBindings.elements) {
          if (e.name.escapedText === n.typeName.escapedText) {
            return [x];
          }
        }
        return [];
      });

      if (!Arrays.isNonEmpty(importNames)) return undefined;

      let importFilename: string | undefined;
      importNames[0].forEachChild((x) => {
        if (x.kind !== SyntaxKind.StringLiteral) return;
        importFilename = x.getText(sourceFile);
      });

      if (importFilename === undefined) {
        throw new Error("Illegal state: Malformed import expression!");
      }

      return {
        importDeclaration: importNames[0],
        importFilename,
      };
    }

    sourceFile.forEachChild((node: Node) => {
      for (const doc of getJsDoc(node, sourceFile)) {
        for (const tag of doc.tags ?? []) {
          const tsPpxTag = parseTsPpxTag(tag);
          if (tsPpxTag === undefined) continue;
          if (tsPpxTag === "INVALID_TAG") {
            throw new Error("Malformed ts-ppx doc comment!");
          }

          for (const tag of tsPpxTag.ppxs) {
            const plugin = pluginsByName.get(tag);
            if (plugin === undefined) {
              throw new Error(`Code generator not registered: "${tag}"!`);
            }

            const targetFilename = plugin.codegenPathFromSourcePath(filename);
            const generatedCode = plugin.generateCode({
              node,
              sourceFile,
              codegenPathFromSourcePath: plugin.codegenPathFromSourcePath,
              codegenImportFromSourceImport:
                plugin.codegenImportFromSourceImport,
              findImportForTypeReference,
              sourceFilename: filename,
              targetFilename,
            });

            const existingCode = generatedFilesByFilename.get(targetFilename);
            if (existingCode === undefined) {
              generatedFilesByFilename.set(targetFilename, generatedCode);
            } else {
              generatedFilesByFilename.set(
                targetFilename,
                GeneratedFileContents.merge(existingCode, generatedCode),
              );
            }
          }
        }
      }
    });
  }

  for (const [filename, contents] of generatedFilesByFilename.entries()) {
    console.log(`Writing ${filename}...`);

    const source: string[] = [];
    for (const importStatement of [...new Set(contents.imports)]) {
      source.push(importStatement);
    }

    source.push("");

    for (const topLevelStatement of contents.topLevelStatements) {
      source.push(topLevelStatement);
    }

    let fullSource = source.join("\n");
    for (const p of config.codeFormatters) {
      fullSource = p.formatCode(fullSource);
    }
    config.filesystem.writeFile(filename, fullSource);
  }
}

function* genAllTargetFiles(config: Config): Generator<string> {
  yield* genTargetFilesInDirectory(config.sourceRoot, config);
}

function* genTargetFilesInDirectory(
  dir: string,
  config: Config,
): Generator<string> {
  for (const file of config.filesystem.readDir(dir)) {
    const stat = config.filesystem.stat(file);

    if (stat.isDirectory()) {
      yield* genTargetFilesInDirectory(file, config);
      continue;
    }

    if (stat.isFile()) {
      if (
        config.sourcePattern === undefined ||
        config.sourcePattern.test(file)
      ) {
        yield file;
      }
    }
  }
}

function parseTsPpxTag(
  tag: JSDocTag,
): Readonly<{ ppxs: readonly string[] }> | "INVALID_TAG" | undefined {
  const tagName = tag.tagName.escapedText.toString();
  if (tagName !== "ts-ppx") return;

  let comment = tag.comment?.toString();
  if (comment === undefined || comment.length === 0) return "INVALID_TAG";

  if (!comment.startsWith("(") || !comment.endsWith(")")) return "INVALID_TAG";
  comment = comment.slice(1, comment.length - 1);

  return {
    ppxs: comment.split(",").map((x) => x.trim()),
  };
}
