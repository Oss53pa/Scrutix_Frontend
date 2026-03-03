// ============================================================================
// SCRUTIX - DOCX Text Extractor
// Extraction de texte depuis fichiers DOCX via jszip
// ============================================================================

import JSZip from 'jszip';

/**
 * Extrait le texte brut d'un fichier DOCX
 * Utilise jszip (deja disponible via exceljs) pour dezipper
 * puis parse word/document.xml pour en extraire le texte
 */
export class DocxExtractor {
  /**
   * Extrait le texte d'un fichier DOCX
   */
  async extract(file: File | ArrayBuffer): Promise<string> {
    const data = file instanceof File ? await file.arrayBuffer() : file;
    const zip = await JSZip.loadAsync(data);

    const documentXml = zip.file('word/document.xml');
    if (!documentXml) {
      throw new Error('Fichier DOCX invalide: word/document.xml introuvable');
    }

    const xmlContent = await documentXml.async('text');
    return this.parseXmlToText(xmlContent);
  }

  /**
   * Parse le XML du document Word pour en extraire le texte
   * Gere les elements <w:t> (texte), <w:p> (paragraphes), <w:br> (sauts de ligne)
   */
  private parseXmlToText(xml: string): string {
    const paragraphs: string[] = [];

    // Extraire chaque paragraphe <w:p>...</w:p>
    const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pContent = pMatch[1];
      const texts: string[] = [];

      // Extraire le texte de chaque <w:t>...</w:t>
      const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;

      while ((tMatch = tRegex.exec(pContent)) !== null) {
        texts.push(this.decodeXmlEntities(tMatch[1]));
      }

      // Verifier les sauts de ligne <w:br/>
      if (pContent.includes('<w:br')) {
        texts.push('\n');
      }

      if (texts.length > 0) {
        paragraphs.push(texts.join(''));
      }
    }

    return paragraphs.join('\n\n');
  }

  /**
   * Decode les entites XML courantes
   */
  private decodeXmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
  }
}
