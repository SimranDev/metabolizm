// Deterministic parsing of a pasted USDA FoodData Central food JSON via the
// same mapper the bulk import (scripts/import-usda.ts) uses. If a rough-text
// parse is ever wanted again, it comes back as a hosted-API provider here.
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { mapUsdaFood } from "./usda-mapper";

const parseBodySchema = z.object({
  // Real FDC food objects average ~18 KB; cap stays under Fastify's 1 MiB bodyLimit.
  text: z.string().trim().min(1).max(1_000_000),
});

const HINT = "paste a USDA food JSON, or fill the form manually";

/**
 * Accept a single food object, a one-element array, or a one-element
 * {foods|FoundationFoods|SRLegacyFoods: [...]} wrapper.
 */
function unwrapFood(json: unknown): { food: unknown } | { error: string } {
  if (Array.isArray(json)) {
    if (json.length !== 1) {
      return { error: `JSON contains ${json.length} foods; paste exactly one` };
    }
    return { food: json[0] };
  }
  if (json !== null && typeof json === "object") {
    const record = json as Record<string, unknown>;
    for (const key of ["foods", "FoundationFoods", "SRLegacyFoods"]) {
      const wrapped = record[key];
      if (Array.isArray(wrapped)) {
        if (wrapped.length !== 1) {
          return {
            error: `"${key}" contains ${wrapped.length} foods; paste exactly one (or use the bulk import script)`,
          };
        }
        return { food: wrapped[0] };
      }
    }
    return { food: json };
  }
  return { error: "JSON is not a USDA food object" };
}

export function registerParseRoute(app: FastifyInstance): void {
  app.post("/api/parse", async (request, reply) => {
    const body = parseBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({
        error: "validation_failed",
        message: z.prettifyError(body.error),
      });
    }

    let json: unknown;
    try {
      json = JSON.parse(body.data.text);
    } catch {
      return reply.code(422).send({
        error: "unrecognized_input",
        message: `Input is not valid JSON — ${HINT}`,
      });
    }

    const unwrapped = unwrapFood(json);
    if ("error" in unwrapped) {
      return reply.code(422).send({
        error: "unrecognized_input",
        message: `${unwrapped.error} — ${HINT}`,
      });
    }

    const result = mapUsdaFood(unwrapped.food);
    if (!result.ok) {
      return reply.code(422).send({
        error: "unrecognized_input",
        message: `${result.detail} — ${HINT}`,
      });
    }

    const warnings = [...result.warnings];
    if (result.unknownNutrients.length > 0) {
      const names = result.unknownNutrients
        .slice(0, 5)
        .map((u) => u.name || String(u.id));
      warnings.push(
        `ignored ${result.unknownNutrients.length} FDC nutrients with no registry mapping: ${names.join(", ")}${
          result.unknownNutrients.length > 5 ? ", …" : ""
        }`,
      );
    }
    return reply.send({
      food: { ...result.input, sourceRef: result.sourceRef },
      warnings,
    });
  });
}
