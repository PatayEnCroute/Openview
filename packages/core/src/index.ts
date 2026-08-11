import { z } from 'zod';

/**
 * Schéma Zod officiel pour la validation d'un Template Openview.
 */
export const TemplateSchema = z.object({
  id: z.string().min(1, 'Template ID is required'),
  name: z.string().min(1, 'Template name is required'),
  version: z.string().default('1.0.0'),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type TemplateSchema = z.infer<typeof TemplateSchema>;

/**
 * Fonction de validation d'un template brut
 */
export function parseTemplateSchema(rawSchema: unknown): TemplateSchema {
  return TemplateSchema.parse(rawSchema);
}
