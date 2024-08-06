import {
  Node,
  TypeNode,
  TypeReferenceNode,
  isIdentifier,
  isPropertySignature,
  isTypeLiteralNode,
  isTypeReferenceNode,
  PropertySignature,
  SyntaxKind,
  isLiteralTypeNode,
  isUnionTypeNode,
  LiteralTypeNode,
  UnionTypeNode,
  isTypeAliasDeclaration,
  TypeLiteralNode,
} from "typescript";
import path from "path";
import { GeneratedFileContents, CodeGeneratorPlugin } from "@ts-ppx/core";

export type ZodTsPpxPluginConfig = CodeGeneratorPlugin;

export const ZodTsPpxPluginConfig = {
  make: (
    params: Readonly<{ transformPath: (filename: string) => string }>,
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
  sourceFilename,
  targetFilename,
}: Readonly<{
  node: Node;
  sourceFilename: string;
  targetFilename: string;
}>): GeneratedFileContents {
  if (!isTypeAliasDeclaration(node)) {
    throw new Error("Only type aliases can leverage the Zod ts-ppx plugin.");
  }

  const zodSchema = ZodSchemas.forTypeNode(node.type);

  const typeName = node.name.escapedText.toString();

  return {
    imports: [
      "import { z } from 'zod';",
      `import { type ${typeName} as $${typeName} } from '${importFilename(sourceFilename, targetFilename)}';`,
    ],
    topLevelStatements: [
      `export type ${typeName} = $${typeName};`,
      [
        `export const ${node.name.escapedText.toString()} = {`,
        `  SCHEMA: ${zodSchema}.transform((x): ${typeName} => x),`,
        `} as const;`,
      ].join("\n"),
    ],
  };
}

const ZodSchemas = {
  forPropertySignature: (n: PropertySignature): string => {
    if (n.type === undefined) {
      throw new Error("Types are required for properties.");
    }

    const schema = ZodSchemas.forTypeNode(n.type);

    if (n.questionToken !== undefined) {
      return `${schema}.optional()`;
    }

    return schema;
  },
  forTypeNode: (n: TypeNode): string => {
    switch (n.kind) {
      case SyntaxKind.TypeReference:
        if (!isTypeReferenceNode(n)) {
          throw new Error("Expected type reference!");
        }
        return ZodSchemas.forTypeReference(n);
      case SyntaxKind.TypeLiteral:
        if (!isTypeLiteralNode(n)) throw new Error("Expected type literal!");
        return ZodSchemas.forTypeLiteral(n);
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
        return ZodSchemas.forUnion(n);
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forTypeLiteral: (n: TypeLiteralNode): string => {
    const lines: string[] = ["z.object({"];

    n.forEachChild((child: Node) => {
      switch (child.kind) {
        case SyntaxKind.PropertySignature:
          if (!isPropertySignature(child)) {
            throw new Error("Expected property signature!");
          }
          if (!isIdentifier(child.name)) {
            throw new Error("Expected property name to be an identifier!");
          }
          const schema = ZodSchemas.forPropertySignature(child);
          lines.push(`  ${child.name.escapedText}: ${schema},`);
          return;
      }
      throw new Error(`Unhandled TypeLiteral child: ${SyntaxKind[child.kind]}`);
    });

    lines.push("})");

    return lines.join("\n");
  },
  forLiteral: (n: LiteralTypeNode["literal"]): string => {
    switch (n.kind) {
      case SyntaxKind.StringLiteral:
        return `z.literal('${n.text}')`;
      case SyntaxKind.NumericLiteral:
        return `z.literal(${n.text})`;
      case SyntaxKind.BigIntLiteral:
        return `z.literal(${n.text})`;
      case SyntaxKind.TrueKeyword:
        return `z.literal(true)`;
      case SyntaxKind.FalseKeyword:
        return `z.literal(false)`;
      case SyntaxKind.NullKeyword:
        return `z.null()`;
    }
    throw new Error(`Unhandled type node: ${SyntaxKind[n.kind]}`);
  },
  forStringKeyword: (_: TypeNode): string => "z.string()",
  forBigIntKeyword: (_: TypeNode): string => "z.bigint()",
  forNumberKeyword: (_: TypeNode): string => "z.number()",
  forUndefinedKeyword: (_: TypeNode): string => "z.undefined()",
  forTypeReference: (n: TypeReferenceNode): string => {
    if (!isIdentifier(n.typeName)) {
      throw new Error("Expected TypeReferenceNode to have an identifier!");
    }
    switch (n.typeName.escapedText) {
      case "Readonly": {
        const arg = n.typeArguments?.[0];
        if (arg === undefined) {
          throw new Error("Expected Readonly type to have an argument!");
        }
        return ZodSchemas.forTypeNode(arg);
      }
    }
    throw new Error(
      `Unsupported TypeName reference: ${SyntaxKind[n.typeName.kind]}`,
    );
  },
  forUnion: (n: UnionTypeNode): string => {
    const children: string[] = [];
    for (const child of n.types) {
      children.push(ZodSchemas.forTypeNode(child));
    }

    return `z.union([${children.join(", ")}])`;
  },
} as const;

