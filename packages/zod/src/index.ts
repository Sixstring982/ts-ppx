import {
  CodeGeneratorPlugin,
  EnrichedImportDeclaration,
  GeneratedFileContents,
} from "@ts-ppx/core";
import path from "path";
import {
  LiteralTypeNode,
  Node,
  PropertySignature,
  SourceFile,
  SyntaxKind,
  TypeLiteralNode,
  TypeNode,
  TypeReferenceNode,
  UnionTypeNode,
  isIdentifier,
  isLiteralTypeNode,
  isPropertySignature,
  isTypeAliasDeclaration,
  isTypeLiteralNode,
  isTypeReferenceNode,
  isUnionTypeNode,
} from "typescript";

export type ZodTsPpxPluginConfig = CodeGeneratorPlugin;

export const ZodTsPpxPluginConfig = {
  make: (
    params: Readonly<{
      codegenPathFromSourcePath: (filename: string) => string;
      codegenImportFromSourceImport: (filename: string) => string;
    }>,
  ): ZodTsPpxPluginConfig => ({
    ...params,
    name: "zod",
    generateCode: generateZodTypings,
  }),
} as const;

function importFilename(sourceFilename: string, targetFilename: string) {
  let p = path.relative(path.dirname(targetFilename), sourceFilename);
  if (!p.startsWith("../") || !p.startsWith("./")) {
    p = `./${p}`;
  }

  return p.replace(/.tsx?$/, "");
}

function generateZodTypings({
  node,
  sourceFile,
  codegenImportFromSourceImport,
  codegenPathFromSourcePath,
  findImportForTypeReference,
  sourceFilename,
  targetFilename,
}: Readonly<{
  node: Node;
  sourceFile: SourceFile;
  codegenPathFromSourcePath: (filename: string) => string;
  codegenImportFromSourceImport: (filename: string) => string;
  findImportForTypeReference: (
    node: TypeReferenceNode,
  ) => EnrichedImportDeclaration | undefined;
  sourceFilename: string;
  targetFilename: string;
}>): GeneratedFileContents {
  if (!isTypeAliasDeclaration(node)) {
    throw new Error("Only type aliases can leverage the Zod ts-ppx plugin.");
  }

  const context: Context = {
    sourceFile,
    findImportForTypeReference,
    codegenPathFromSourcePath,
    codegenImportFromSourceImport,
  };

  const { schema, imports } = ZodSchemas.forTypeNode(node.type, context);

  const typeName = node.name.escapedText.toString();

  return {
    imports: [
      "import { z } from 'zod';",
      `import { type ${typeName} as $${typeName} } from '${importFilename(sourceFilename, targetFilename)}';`,
      ...(imports ?? []),
    ],
    topLevelStatements: [
      `export type ${typeName} = $${typeName};`,
      [
        `export const ${node.name.escapedText.toString()} = {`,
        `  schema: () => ${schema}.transform((x): ${typeName} => x),`,
        `} as const;`,
      ].join("\n"),
    ],
  };
}

type Context = Readonly<{
  sourceFile: SourceFile;
  findImportForTypeReference: (
    node: TypeReferenceNode,
  ) => EnrichedImportDeclaration | undefined;
  codegenPathFromSourcePath: (filename: string) => string;
  codegenImportFromSourceImport: (filename: string) => string;
}>;

type GeneratedCode = Readonly<{
  schema: string;
  imports: readonly string[];
}>;
const GeneratedCode = {
  mapSchema: (
    g: GeneratedCode,
    f: (schema: string) => string,
  ): GeneratedCode => {
    return {
      schema: f(g.schema),
      imports: g.imports,
    };
  },
} as const;

const ZodSchemas = {
  forPropertySignature: (n: PropertySignature, c: Context): GeneratedCode => {
    if (n.type === undefined) {
      throw new Error("Types are required for properties.");
    }

    const schema = ZodSchemas.forTypeNode(n.type, c);

    if (n.questionToken !== undefined) {
      return GeneratedCode.mapSchema(schema, (x) => `${x}.optional()`);
    }

    return schema;
  },
  forTypeNode: (n: TypeNode, c: Context): GeneratedCode => {
    switch (n.kind) {
      case SyntaxKind.TypeReference:
        if (!isTypeReferenceNode(n)) {
          throw new Error("Expected type reference!");
        }
        return ZodSchemas.forTypeReference(n, c);
      case SyntaxKind.TypeLiteral:
        if (!isTypeLiteralNode(n)) throw new Error("Expected type literal!");
        return ZodSchemas.forTypeLiteral(n, c);
      case SyntaxKind.LiteralType:
        if (!isLiteralTypeNode(n)) throw new Error("Expected literal type!");
        return ZodSchemas.forLiteral(n.literal);
      case SyntaxKind.BigIntKeyword:
        return ZodSchemas.forBigIntKeyword(n);
      case SyntaxKind.StringKeyword:
        return ZodSchemas.forStringKeyword(n);
      case SyntaxKind.NumberKeyword:
        return ZodSchemas.forNumberKeyword(n);
      case SyntaxKind.UndefinedKeyword:
        return ZodSchemas.forUndefinedKeyword(n);
      case SyntaxKind.UnionType:
        if (!isUnionTypeNode(n)) throw new Error("Expected union type!");
        return ZodSchemas.forUnion(n, c);
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forTypeLiteral: (n: TypeLiteralNode, c: Context): GeneratedCode => {
    const lines: string[] = ["z.object({"];
    const imports: string[] = [];

    n.forEachChild((child: Node) => {
      switch (child.kind) {
        case SyntaxKind.PropertySignature:
          if (!isPropertySignature(child)) {
            throw new Error("Expected property signature!");
          }
          if (!isIdentifier(child.name)) {
            throw new Error("Expected property name to be an identifier!");
          }
          const schema = ZodSchemas.forPropertySignature(child, c);
          lines.push(`  ${child.name.escapedText}: ${schema.schema},`);
          imports.push(...schema.imports);
          return;
      }
      throw new Error(`Unhandled TypeLiteral child: ${SyntaxKind[child.kind]}`);
    });

    lines.push("})");

    return { schema: lines.join("\n"), imports };
  },
  forLiteral: (n: LiteralTypeNode["literal"]): GeneratedCode => {
    switch (n.kind) {
      case SyntaxKind.StringLiteral:
        return { schema: `z.literal('${n.text}')`, imports: [] };
      case SyntaxKind.NumericLiteral:
        return { schema: `z.literal(${n.text})`, imports: [] };
      case SyntaxKind.BigIntLiteral:
        return { schema: `z.literal(${n.text})`, imports: [] };
      case SyntaxKind.TrueKeyword:
        return { schema: `z.literal(true)`, imports: [] };
      case SyntaxKind.FalseKeyword:
        return { schema: `z.literal(false)`, imports: [] };
      case SyntaxKind.NullKeyword:
        return { schema: `z.null()`, imports: [] };
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forStringKeyword: (_: TypeNode): GeneratedCode => ({
    schema: "z.string()",
    imports: [],
  }),
  forBigIntKeyword: (_: TypeNode): GeneratedCode => ({
    schema: "z.bigint()",
    imports: [],
  }),
  forNumberKeyword: (_: TypeNode): GeneratedCode => ({
    schema: "z.number()",
    imports: [],
  }),
  forUndefinedKeyword: (_: TypeNode): GeneratedCode => ({
    schema: "z.undefined()",
    imports: [],
  }),
  forTypeReference: (n: TypeReferenceNode, c: Context): GeneratedCode => {
    if (!isIdentifier(n.typeName)) {
      throw new Error("Expected TypeReferenceNode to have an identifier!");
    }
    switch (n.typeName.escapedText) {
      case "Readonly": {
        const arg = n.typeArguments?.[0];
        if (arg === undefined) {
          throw new Error("Expected Readonly type to have an argument!");
        }
        return ZodSchemas.forTypeNode(arg, c);
      }
    }

    // Check if this type was imported. If it was, we need to import its
    // corresponding Zod schema.
    const importDeclaration = c.findImportForTypeReference(n);
    if (importDeclaration === undefined) {
      return { schema: `${n.typeName.escapedText}.schema()`, imports: [] };
    }

    const imports = [
      `import { ${n.typeName.escapedText} } from ${c.codegenImportFromSourceImport(importDeclaration.importFilename)};`,
    ];

    return { schema: `${n.typeName.escapedText}.schema()`, imports };
  },
  forUnion: (n: UnionTypeNode, c: Context): GeneratedCode => {
    const children: GeneratedCode[] = [];
    for (const child of n.types) {
      children.push(ZodSchemas.forTypeNode(child, c));
    }

    return {
      schema: `z.union([${children.map((x) => x.schema).join(", ")}])`,
      imports: children.flatMap((x) => x.imports ?? []),
    };
  },
} as const;
