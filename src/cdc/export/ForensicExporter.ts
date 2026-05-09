// ============================================================================
// CDC — Forensic Export (ZIP scellé)
// ============================================================================
// CDC §8.3 :
//   « Export forensique d'un dossier d'audit : ZIP scellé contenant relevé
//     source, conventions applicables, résolutions, calculs, écarts détectés,
//     signature numérique. »
//
// Structure du ZIP livré :
//   forensic-{auditId}-{date}.zip
//   ├── manifest.json              ← métadonnées + index + signature globale
//   ├── statement/
//   │   └── source.{ext}           ← le PDF/CSV/OFX source
//   ├── conventions/
//   │   ├── L2-{bankCode}.json     ← conditions L2 résolues
//   │   ├── L4-{agreementId}.pdf   ← PDF des conventions client (si dispos)
//   │   └── ...
//   ├── resolutions/
//   │   └── chain.jsonl            ← receipts signés en JSON Lines (1 par ligne)
//   ├── calculations/
//   │   ├── agios.json
//   │   ├── commissions.json
//   │   └── cpfd.json
//   ├── ecarts/
//   │   └── ecarts.json            ← écarts détectés avec scoring
//   └── signatures/
//       └── seal.json              ← signature globale du manifest
//
// La signature globale :
//   - SHA-256 sur la concaténation triée des hashes de tous les fichiers
//   - HMAC-SHA256 de ce digest avec la clé Atlas Studio
//   - Toute altération du ZIP casse la vérification
// ============================================================================

import JSZip from 'jszip';
import type {
  Ecart,
  ResolutionResult,
  AgiosResult,
  CommissionMouvementResult,
  CpfdResult,
  CdcAuditSession,
  Agreement,
  AgreementCondition,
  BankReferenceVersion,
} from '../types';
import { ReceiptSigner, createDevSigner, canonicalize } from '../resolution/ReceiptSigner';

// ============================================================================
// Types
// ============================================================================

export interface ForensicBundle {
  /** Session d'audit racine. */
  session: CdcAuditSession;
  /** Le contenu binaire du fichier source (relevé bancaire). */
  statementFile: { name: string; bytes: Uint8Array; mimeType: string };
  /** Receipts signés produits par le moteur, ordonnés. */
  receipts: ResolutionResult[];
  /** Conventions applicables (L4/L5) avec leurs conditions. */
  agreements: Array<{ agreement: Agreement; conditions: AgreementCondition[]; pdfBytes?: Uint8Array }>;
  /** Versions du référentiel banque utilisées (L2). */
  bankReferenceVersions: BankReferenceVersion[];
  /** Résultats des calculs financiers. */
  calculations: {
    agios?: AgiosResult;
    commissions?: CommissionMouvementResult[];
    cpfd?: CpfdResult;
  };
  /** Écarts détectés avec scoring. */
  ecarts: Ecart[];
}

export interface ForensicManifest {
  schema: 'atlasbanx-forensic-v1';
  generatedAt: string;
  generator: string;
  auditSessionId: string;
  tenantId: string;
  organizationId: string;
  accountId: string;
  periodStart: string;
  periodEnd: string;
  totals: {
    operations: number;
    ecarts: number;
    impactCentimes: string;
  };
  files: Array<{
    path: string;
    sha256: string;
    sizeBytes: number;
  }>;
  /** Hash global = SHA-256(canonical(files trié par path)). */
  globalHash: string;
  /** Signature HMAC-SHA256 du globalHash. */
  globalSignature: string;
  /** ID de la clé utilisée pour la signature globale. */
  signatureKeyId: string;
  /** Tête de chaîne des receipts (pour vérification rapide). */
  receiptChainHead: string | null;
}

// ============================================================================
// Crypto helpers
// ============================================================================

function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && (globalThis as { crypto?: Crypto }).crypto?.subtle) {
    return (globalThis as { crypto: Crypto }).crypto;
  }
  throw new Error('[ForensicExporter] Web Crypto API non disponible');
}

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let h = '';
  for (let i = 0; i < b.length; i++) h += b[i].toString(16).padStart(2, '0');
  return h;
}

async function sha256Bytes(input: Uint8Array): Promise<string> {
  const buf = await getCrypto().subtle.digest('SHA-256', input);
  return bytesToHex(buf);
}

async function hmacSha256(input: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await getCrypto().subtle.importKey(
    'raw', enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await getCrypto().subtle.sign('HMAC', cryptoKey, enc.encode(input));
  return bytesToHex(sig);
}

// ============================================================================
// Serialization helpers — bigint-safe JSON
// ============================================================================

function safeJson(value: unknown, pretty = true): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) return v.toISOString();
    return v;
  }, pretty ? 2 : 0);
}

// ============================================================================
// ForensicExporter
// ============================================================================

export interface ExporterConfig {
  /** Clé HMAC pour la signature globale du manifest. */
  signingKey: string;
  /** Identifiant de la clé. */
  signingKeyId: string;
  /** Nom du générateur (apparaîtra dans le manifest). */
  generator?: string;
}

export class ForensicExporter {
  private config: ExporterConfig;

  constructor(config: ExporterConfig) {
    this.config = config;
  }

  /**
   * Génère le ZIP forensique scellé. Renvoie un Blob prêt à télécharger.
   */
  async exportBundle(bundle: ForensicBundle): Promise<{ blob: Blob; manifest: ForensicManifest }> {
    const zip = new JSZip();
    const fileEntries: ForensicManifest['files'] = [];

    // ===== 1. statement/source.{ext} =====
    const stmtPath = `statement/${bundle.statementFile.name}`;
    zip.file(stmtPath, bundle.statementFile.bytes);
    fileEntries.push({
      path: stmtPath,
      sha256: await sha256Bytes(bundle.statementFile.bytes),
      sizeBytes: bundle.statementFile.bytes.byteLength,
    });

    // ===== 2. conventions/ =====
    for (const ag of bundle.agreements) {
      const path = `conventions/L${ag.agreement.layer}-${ag.agreement.id}.json`;
      const content = safeJson({ agreement: ag.agreement, conditions: ag.conditions });
      zip.file(path, content);
      fileEntries.push({
        path,
        sha256: await sha256Bytes(new TextEncoder().encode(content)),
        sizeBytes: new TextEncoder().encode(content).byteLength,
      });
      if (ag.pdfBytes) {
        const pdfPath = `conventions/L${ag.agreement.layer}-${ag.agreement.id}.pdf`;
        zip.file(pdfPath, ag.pdfBytes);
        fileEntries.push({
          path: pdfPath,
          sha256: await sha256Bytes(ag.pdfBytes),
          sizeBytes: ag.pdfBytes.byteLength,
        });
      }
    }

    // ===== 3. conventions/L2-* (référentiel banque) =====
    for (const v of bundle.bankReferenceVersions) {
      const path = `conventions/L2-${v.id}.json`;
      const content = safeJson(v);
      zip.file(path, content);
      fileEntries.push({
        path,
        sha256: await sha256Bytes(new TextEncoder().encode(content)),
        sizeBytes: new TextEncoder().encode(content).byteLength,
      });
    }

    // ===== 4. resolutions/chain.jsonl =====
    // JSON Lines : 1 receipt par ligne, ordre = ordre de signature
    let chainHead: string | null = null;
    const lines = bundle.receipts.map((r) => {
      chainHead = r.receipt.receiptHash;
      return safeJson({
        value: r.value,
        formula: r.formula,
        receipt: r.receipt,
        resolvedAt: r.resolvedAt,
      }, false);
    });
    const chainContent = lines.join('\n') + (lines.length > 0 ? '\n' : '');
    zip.file('resolutions/chain.jsonl', chainContent);
    fileEntries.push({
      path: 'resolutions/chain.jsonl',
      sha256: await sha256Bytes(new TextEncoder().encode(chainContent)),
      sizeBytes: new TextEncoder().encode(chainContent).byteLength,
    });

    // ===== 5. calculations/ =====
    if (bundle.calculations.agios) {
      const c = safeJson(bundle.calculations.agios);
      zip.file('calculations/agios.json', c);
      fileEntries.push({
        path: 'calculations/agios.json',
        sha256: await sha256Bytes(new TextEncoder().encode(c)),
        sizeBytes: new TextEncoder().encode(c).byteLength,
      });
    }
    if (bundle.calculations.commissions) {
      const c = safeJson(bundle.calculations.commissions);
      zip.file('calculations/commissions.json', c);
      fileEntries.push({
        path: 'calculations/commissions.json',
        sha256: await sha256Bytes(new TextEncoder().encode(c)),
        sizeBytes: new TextEncoder().encode(c).byteLength,
      });
    }
    if (bundle.calculations.cpfd) {
      const c = safeJson(bundle.calculations.cpfd);
      zip.file('calculations/cpfd.json', c);
      fileEntries.push({
        path: 'calculations/cpfd.json',
        sha256: await sha256Bytes(new TextEncoder().encode(c)),
        sizeBytes: new TextEncoder().encode(c).byteLength,
      });
    }

    // ===== 6. ecarts/ecarts.json =====
    const ecartsContent = safeJson(bundle.ecarts);
    zip.file('ecarts/ecarts.json', ecartsContent);
    fileEntries.push({
      path: 'ecarts/ecarts.json',
      sha256: await sha256Bytes(new TextEncoder().encode(ecartsContent)),
      sizeBytes: new TextEncoder().encode(ecartsContent).byteLength,
    });

    // ===== 7. manifest.json + signatures/seal.json =====
    fileEntries.sort((a, b) => a.path.localeCompare(b.path));
    const globalHash = await sha256Bytes(
      new TextEncoder().encode(canonicalize(fileEntries)),
    );
    const globalSignature = await hmacSha256(globalHash, this.config.signingKey);

    const manifest: ForensicManifest = {
      schema: 'atlasbanx-forensic-v1',
      generatedAt: new Date().toISOString(),
      generator: this.config.generator ?? 'AtlasBanx CDC v1.0',
      auditSessionId: bundle.session.id,
      tenantId: bundle.session.tenantId,
      organizationId: bundle.session.organizationId,
      accountId: bundle.session.accountId,
      periodStart: bundle.session.periodStart.toISOString().slice(0, 10),
      periodEnd: bundle.session.periodEnd.toISOString().slice(0, 10),
      totals: {
        operations: bundle.session.totalOperations,
        ecarts: bundle.session.totalEcarts,
        impactCentimes: bundle.session.totalImpactCentimes.toString(),
      },
      files: fileEntries,
      globalHash,
      globalSignature,
      signatureKeyId: this.config.signingKeyId,
      receiptChainHead: chainHead,
    };

    const manifestContent = safeJson(manifest);
    zip.file('manifest.json', manifestContent);

    // Sceau séparé (juste le hash + signature, en clair)
    const seal = {
      schema: 'atlasbanx-forensic-seal-v1',
      auditSessionId: bundle.session.id,
      sealedAt: new Date().toISOString(),
      globalHash,
      globalSignature,
      signatureAlgo: 'hmac-sha256',
      signatureKeyId: this.config.signingKeyId,
      verification: 'Pour vérifier ce sceau : hmac-sha256(globalHash, key) doit égaler globalSignature.',
    };
    zip.file('signatures/seal.json', safeJson(seal));

    // ===== 8. README =====
    zip.file('README.txt', README_TEMPLATE
      .replace('{{auditId}}', bundle.session.id)
      .replace('{{generatedAt}}', manifest.generatedAt)
      .replace('{{globalHash}}', globalHash)
      .replace('{{generator}}', manifest.generator),
    );

    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return { blob, manifest };
  }

  /**
   * Vérifie qu'un ZIP forensique est intact :
   *   1. Recalcule les hashes des fichiers et compare au manifest
   *   2. Recalcule le globalHash
   *   3. Vérifie la signature HMAC
   *   4. Vérifie la chaîne de receipts (si présente)
   */
  async verify(zipBlob: Blob): Promise<{
    ok: true;
    manifest: ForensicManifest;
    chainOk: boolean;
  } | {
    ok: false;
    reason: string;
  }> {
    const zip = await JSZip.loadAsync(zipBlob);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) return { ok: false, reason: 'manifest.json manquant' };
    const manifest = JSON.parse(await manifestFile.async('string')) as ForensicManifest;

    // 1. Vérifier chaque fichier
    for (const entry of manifest.files) {
      const f = zip.file(entry.path);
      if (!f) return { ok: false, reason: `fichier manquant: ${entry.path}` };
      const bytes = await f.async('uint8array');
      const hash = await sha256Bytes(bytes);
      if (hash !== entry.sha256) {
        return { ok: false, reason: `hash invalide pour ${entry.path}` };
      }
    }

    // 2. Recalcul globalHash
    const filesSorted = [...manifest.files].sort((a, b) => a.path.localeCompare(b.path));
    const recalc = await sha256Bytes(new TextEncoder().encode(canonicalize(filesSorted)));
    if (recalc !== manifest.globalHash) {
      return { ok: false, reason: 'globalHash incohérent' };
    }

    // 3. Vérifier signature
    const expectedSig = await hmacSha256(manifest.globalHash, this.config.signingKey);
    if (expectedSig !== manifest.globalSignature) {
      return { ok: false, reason: 'globalSignature invalide' };
    }

    // 4. Vérifier la chaîne de receipts si présente
    let chainOk = true;
    const chainFile = zip.file('resolutions/chain.jsonl');
    if (chainFile) {
      const text = await chainFile.async('string');
      const lines = text.split('\n').filter((l) => l.trim());
      const receipts = lines.map((l) => JSON.parse(l).receipt);
      const verifier = new ReceiptSigner({
        key: this.config.signingKey,
        keyId: this.config.signingKeyId,
      });
      const cv = await verifier.verifyChain(receipts);
      chainOk = cv.ok;
    }

    return { ok: true, manifest, chainOk };
  }
}

// ============================================================================
// Factory : exporter dev
// ============================================================================

export function createDevExporter(tenantId: string): ForensicExporter {
  return new ForensicExporter({
    signingKey: `atlasbanx-cdc-dev-${tenantId}-v1`,
    signingKeyId: `dev-${tenantId.slice(0, 8)}`,
    generator: 'AtlasBanx CDC v1.0 (dev)',
  });
}

// ============================================================================
// README embarqué
// ============================================================================

const README_TEMPLATE = `ATLASBANX — DOSSIER FORENSIQUE D'AUDIT
=========================================

Audit ID    : {{auditId}}
Généré le   : {{generatedAt}}
Générateur  : {{generator}}
Hash global : {{globalHash}}

CONTENU
-------
- statement/      : le relevé bancaire source dans son format original
- conventions/    : conventions applicables (L2 référentiel, L3-L5 client)
- resolutions/    : chaîne signée de receipts (chain.jsonl)
- calculations/   : résultats des calculs (agios, commissions, CPFD)
- ecarts/         : écarts détectés avec scoring matérialité/confiance
- manifest.json   : index complet + hashes + signature globale
- signatures/seal.json : sceau cryptographique séparé

VÉRIFICATION
------------
1. Pour chaque fichier listé dans manifest.json, recalculer son SHA-256 et
   comparer à la valeur indiquée. Une différence indique une altération.
2. Le globalHash est le SHA-256 de la liste canonicalisée des fichiers.
3. La globalSignature est le HMAC-SHA256(globalHash, clé Atlas Studio).
4. La chaîne de receipts (resolutions/chain.jsonl) est tamper-evident :
   chaque receipt référence le hash du précédent.

USAGE LÉGAL
-----------
Ce dossier constitue une pièce probante pour la défense d'un calcul
d'audit AtlasBanx. Il est destiné à être joint à une réclamation
bancaire ou à un dossier judiciaire éventuel. Sa validité repose sur
l'intégrité cryptographique vérifiable a posteriori.

Mention : « Pour information, sous réserve de validation par expert
comptable assermenté. »

—
Atlas Studio · Confidentiel · Conservation 10 ans (OHADA)
`;
