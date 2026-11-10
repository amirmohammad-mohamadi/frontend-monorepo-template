import { z } from "zod";

/** A route or query `id` that may be numeric or a string key (UUID, slug). */
export const idParamSchema = z.union([z.coerce.number().int().positive(), z.string().min(1)]);

export type IdParam = z.infer<typeof idParamSchema>;
