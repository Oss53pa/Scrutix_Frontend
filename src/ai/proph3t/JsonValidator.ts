// ============================================================================
// SCRUTIX - PROPH3T JSON Validator
// Extraction et validation robuste de JSON depuis les reponses LLM
// ============================================================================

/**
 * Utilitaire de validation JSON pour les reponses PROPH3T
 * Gere les cas courants: markdown fences, JSON partiel, caracteres parasites
 */
export class JsonValidator {
  /**
   * Extrait le JSON d'une reponse LLM potentiellement enveloppee
   * Gere: ```json ... ```, texte avant/apres, JSON partiel
   */
  static extractJson(text: string): string {
    // 1. Strip markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      return fenceMatch[1].trim();
    }

    // 2. Try to find JSON array
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    const objectMatch = text.match(/\{[\s\S]*\}/);

    // Prefer array if it comes first (most detection results are arrays)
    if (arrayMatch && (!objectMatch || arrayMatch.index! <= objectMatch.index!)) {
      return arrayMatch[0];
    }

    // 3. Try JSON object
    if (objectMatch) {
      return objectMatch[0];
    }

    // 4. Return trimmed text as last resort
    return text.trim();
  }

  /**
   * Parse JSON avec retry apres nettoyage
   * Tente d'abord le parse direct, puis nettoie les caracteres problematiques
   */
  static safeParse<T>(text: string): T | null {
    // Attempt 1: Direct parse
    try {
      return JSON.parse(text) as T;
    } catch {
      // Continue to cleanup
    }

    // Attempt 2: Extract and parse
    const extracted = JsonValidator.extractJson(text);
    try {
      return JSON.parse(extracted) as T;
    } catch {
      // Continue to cleanup
    }

    // Attempt 3: Cleanup common issues
    try {
      const cleaned = extracted
        // Remove trailing commas before ] or }
        .replace(/,\s*([\]}])/g, '$1')
        // Remove control characters except newlines/tabs
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        // Fix single quotes to double quotes (naive but common)
        .replace(/'/g, '"')
        // Remove BOM
        .replace(/^\uFEFF/, '');

      return JSON.parse(cleaned) as T;
    } catch {
      return null;
    }
  }

  /**
   * Valide qu'un objet parse possede les cles requises
   */
  static validateShape<T extends Record<string, unknown>>(
    data: unknown,
    requiredKeys: (keyof T)[]
  ): data is T {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;
    return requiredKeys.every((key) => key in obj);
  }

  /**
   * Parse et valide en une seule etape
   */
  static parseAndValidate<T extends Record<string, unknown>>(
    text: string,
    requiredKeys: (keyof T)[]
  ): T | null {
    const parsed = JsonValidator.safeParse<T>(text);
    if (!parsed) return null;

    // Si c'est un tableau, valider chaque element
    if (Array.isArray(parsed)) {
      const valid = parsed.every((item) =>
        JsonValidator.validateShape(item, requiredKeys)
      );
      return valid ? parsed : null;
    }

    // Valider l'objet
    if (JsonValidator.validateShape<T>(parsed, requiredKeys)) {
      return parsed;
    }

    return null;
  }
}
