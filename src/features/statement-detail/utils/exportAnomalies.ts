// ============================================================================
// exportAnomalies — exports d'audit niveau international (Excel/Word/PDF)
// ============================================================================
// Produit un dossier d'anomalies de qualité audit-grade, conforme aux
// standards internationaux :
//   - ISA 240 (Auditor's responsibilities relating to fraud)
//   - ISA 315 (Risk assessment)
//   - GAFI/FATF Recommendations (LCB-FT)
//   - Basel Committee on Banking Supervision
//   - OHADA AUDCIF
//   - Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)
//
// Pour chaque anomalie : identification, synthèse, détails de détection
// (algorithme + confiance + règle), PREUVE (transaction, impact solde,
// référence convention), workflow de validation (qualifiée/validée/signée),
// chaîne d'audit (hash SHA-256), recommandation, cadre réglementaire.
// ============================================================================

import ExcelJS from 'exceljs';
import type {
  Anomaly,
  AnomalyComment,
  AnomalyType,
  AuditEntry,
} from '../types/statement.types';

export interface ExportContext {
  statementLabel?: string;
  periodLabel?: string;
  clientLabel?: string;
  bankLabel?: string;
  /** Catégorie tarifaire du client (« Particulier résident », « Entreprise PM »…). */
  clientTypeLabel?: string;
  /** Cabinet auditeur — pour signer le rapport. */
  cabinetName?: string;
  /** Trace audit (chaîne de hash). */
  auditTrail?: AuditEntry[];
  /** Commentaires associés aux anomalies. */
  comments?: AnomalyComment[];
}

// ============================================================================
// Référentiel réglementaire par type d'anomalie
// ============================================================================

interface RegulatoryRef {
  code: string;
  description: string;
  framework: 'ISA' | 'GAFI/FATF' | 'BCEAO' | 'COBAC' | 'Basel' | 'OHADA' | 'Convention';
}

const REGULATORY_FRAMEWORK: Record<AnomalyType, RegulatoryRef[]> = {
  commission_excessive: [
    { code: 'BCEAO 015-2009', description: 'Instruction sur les conditions générales de banque', framework: 'BCEAO' },
    { code: 'Convention tarifaire', description: 'Grille tarifaire signée client/banque', framework: 'Convention' },
  ],
  agio_errone: [
    { code: 'BCEAO 015-2009 Art. 8', description: 'Calcul des intérêts débiteurs (méthode ACT/360)', framework: 'BCEAO' },
    { code: 'OHADA AUDCIF Art. 35', description: 'Comptabilisation des charges financières', framework: 'OHADA' },
  ],
  frais_double: [
    { code: 'Convention tarifaire', description: 'Principe de non-cumul des frais', framework: 'Convention' },
    { code: 'ISA 240 §A38', description: 'Indicateurs de risque de fraude', framework: 'ISA' },
  ],
  convention_violee: [
    { code: 'Convention tarifaire', description: 'Application stricte des conditions signées', framework: 'Convention' },
  ],
  date_valeur_abusive: [
    { code: 'BCEAO 015-2009 Art. 12', description: 'Dates de valeur conventionnelles', framework: 'BCEAO' },
  ],
  frais_non_justifie: [
    { code: 'BCEAO 015-2009 Art. 5', description: 'Obligation de support contractuel pour facturation', framework: 'BCEAO' },
    { code: 'ISA 240 §A38', description: 'Anomalies sans justification documentaire', framework: 'ISA' },
  ],
  lcb_ft: [
    { code: 'GAFI Rec. 10-12', description: 'Vigilance à l\'égard de la clientèle (CDD)', framework: 'GAFI/FATF' },
    { code: 'GAFI Rec. 20', description: 'Déclaration des opérations suspectes (DOS)', framework: 'GAFI/FATF' },
    { code: 'Directive UEMOA 04/2007/CM', description: 'Lutte contre le blanchiment de capitaux', framework: 'BCEAO' },
  ],
  pays_gafi_risque: [
    { code: 'GAFI Rec. 19', description: 'Pays à haut risque — vigilance renforcée', framework: 'GAFI/FATF' },
    { code: 'BCEAO Instruction 007/2017', description: 'Liste des pays à risque', framework: 'BCEAO' },
  ],
  beneficiaire_inedit: [
    { code: 'GAFI Rec. 11', description: 'Conservation des informations sur les bénéficiaires', framework: 'GAFI/FATF' },
    { code: 'ISA 315 §A85', description: 'Identification des risques liés aux contreparties', framework: 'ISA' },
  ],
  montant_anormal: [
    { code: 'ISA 240 §A39', description: 'Outliers statistiques et indicateurs de fraude', framework: 'ISA' },
    { code: 'Basel III Pillar 3', description: 'Disclosure des risques opérationnels', framework: 'Basel' },
  ],
  doublon_transaction: [
    { code: 'ISA 240 §A37', description: 'Erreurs ou fraudes par duplication d\'écritures', framework: 'ISA' },
    { code: 'OHADA AUDCIF Art. 17', description: 'Principe de non-compensation', framework: 'OHADA' },
  ],
  autre: [
    { code: 'ISA 315', description: 'Identification des risques d\'anomalies significatives', framework: 'ISA' },
  ],
};

// ============================================================================
// Helpers
// ============================================================================

function fcfa(centimes: number | undefined): string {
  if (!centimes) return '0';
  const u = Math.round(centimes / 100);
  return new Intl.NumberFormat('fr-FR').format(u).replace(/ /g, ' ');
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function fmtDateTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function severityFr(s: string): string {
  return s === 'critical' ? 'CRITIQUE' : s === 'high' ? 'HAUTE' : s === 'medium' ? 'MOYENNE' : 'FAIBLE';
}
function statusFr(s: string): string {
  return s === 'detected' ? 'Détectée' : s === 'qualified' ? 'Qualifiée'
    : s === 'validated' ? 'Validée' : s === 'signed' ? 'Signée'
    : s === 'closed' ? 'Clôturée' : s === 'false_positive' ? 'Faux positif' : s;
}
function sevColorRgb(severity: string): [number, number, number] {
  return severity === 'critical' ? [185, 28, 28]
    : severity === 'high' ? [194, 65, 12]
    : severity === 'medium' ? [161, 98, 7]
    : [107, 114, 128];
}
function sevColorHex(s: string): string {
  return s === 'critical' ? '#b91c1c' : s === 'high' ? '#c2410c' : s === 'medium' ? '#a16207' : '#6b7280';
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function workflowProgress(a: Anomaly): { step: number; label: string }[] {
  return [
    { step: 1, label: `Détectée le ${fmtDateTime(a.createdAt)}` },
    { step: a.qualifiedBy ? 2 : 0, label: a.qualifiedBy ? `Qualifiée par ${a.qualifiedBy.userHandle} le ${fmtDateTime(a.qualifiedBy.at)}` : 'Qualification en attente' },
    { step: a.validatedBy ? 3 : 0, label: a.validatedBy ? `Validée par ${a.validatedBy.userHandle} le ${fmtDateTime(a.validatedBy.at)}` : 'Validation en attente' },
    { step: a.signedBy ? 4 : 0, label: a.signedBy ? `Signée par ${a.signedBy.userHandle} le ${fmtDateTime(a.signedBy.at)}` : 'Signature DG en attente' },
  ];
}

function reportRef(): string {
  // Référence interne unique pour ce rapport (sert dans la pagination + footer).
  const d = new Date();
  const id = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ATB-${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${id}`;
}

// ============================================================================
// PDF — HTML+browser-print pour rendu premium (Dosis, gradients, encodage OK)
// ============================================================================
// La version précédente utilisait jsPDF en mode texte. Limitations rencontrées :
//   - police helvetica forcée (l'app utilise Dosis)
//   - encodage WinAnsi cassait les diacritiques (« Période » → « P é r i o d e »)
//   - aucun support des gradients / ombres / cartes premium
//   - rendu plat, qualité visuelle inférieure aux autres rapports de l'app
//
// Nouvelle approche : on construit un document HTML complet avec la police
// Dosis (Google Fonts), les couleurs canon de Tailwind, et la pagination
// pilotée par @page. On l'ouvre dans une fenêtre dédiée et on déclenche
// window.print() — l'utilisateur enregistre en PDF via le dialog natif du
// navigateur (qui propose « Enregistrer au format PDF » par défaut).
//
// Avantages :
//   - typographie native (Dosis, kerning correct, ligatures, diacritiques)
//   - CSS complet (cartes, ombres, dégradés, KPI tiles colorées)
//   - identique à l'écran (cohérence visuelle parfaite)
//   - taille de fichier plus légère (texte vectoriel, pas d'embed font)

export function exportAnomaliesPdf(anomalies: Anomaly[], ctx: ExportContext = {}): void {
  const REF = reportRef();
  // L'auto-print est embarqué DANS le HTML pour ne pas dépendre d'une
  // référence à la fenêtre depuis le parent (certains navigateurs/options
  // bloquent ce canal — ex. `noopener` annule la valeur de retour de
  // window.open). En l'inscrivant dans le document, le print fire de
  // façon fiable dès que les fonts sont chargées.
  const html = buildAnomaliesReportHtml(anomalies, ctx, REF, /*autoPrint*/ true);

  // ⚠ Ne JAMAIS passer 'noopener' aux features : ça force window.open à
  // retourner null, et `win.document.write` n'est plus possible.
  const win = window.open('about:blank', '_blank', 'width=900,height=1200');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return;
  }

  // Fallback : pop-up bloquée → on télécharge un .html que l'utilisateur
  // peut ouvrir et imprimer manuellement. Conserve toute la mise en page.
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `atlasbanx-dossier-anomalies-${dateStamp()}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ============================================================================
// HTML report builder — pourrait être réutilisé pour le rendu d'aperçu écran
// ============================================================================

function buildAnomaliesReportHtml(
  anomalies: Anomaly[],
  ctx: ExportContext,
  refId: string,
  autoPrint: boolean = false,
): string {
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  const sev = {
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    high:     anomalies.filter((a) => a.severity === 'high').length,
    medium:   anomalies.filter((a) => a.severity === 'medium').length,
    low:      anomalies.filter((a) => a.severity === 'low').length,
  };

  // Script auto-print : attend que la police Dosis soit chargée + 300ms,
  // puis déclenche le print dialog. Sans this script, l'utilisateur doit
  // appuyer Ctrl+P manuellement (fonctionne aussi, mais moins fluide).
  const autoPrintScript = autoPrint ? `
<script>
(function() {
  function ready() {
    var doc = document;
    function fire() {
      try { window.focus(); window.print(); } catch (e) {}
    }
    // Attend les fonts si possible (Dosis depuis Google Fonts).
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () { setTimeout(fire, 300); });
    } else {
      setTimeout(fire, 800);
    }
  }
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
})();
</script>` : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Dossier d'anomalies bancaires · ${escapeHtml(refId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dosis:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  ${REPORT_CSS}
</style>
${autoPrintScript}
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════════
     PAGE DE COUVERTURE
═══════════════════════════════════════════════════════════════════════ -->
<section class="page cover">
  <header class="cover-band">
    <p class="eyebrow">AtlasBanx · Audit bancaire UEMOA/CEMAC</p>
    <h1>Dossier d'anomalies bancaires</h1>
    <p class="lede">Rapport d'audit — conforme aux standards internationaux</p>
    <div class="cover-ref">
      <span class="ref-label">Réf.</span>
      <span class="ref-value">${escapeHtml(refId)}</span>
      <span class="ref-meta">Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  </header>

  <div class="cover-body">

    <!-- Cabinet -->
    <div class="cabinet-block">
      <p class="cabinet-name">${escapeHtml(ctx.cabinetName ?? 'AtlasBanx')}</p>
      ${ctx.clientLabel ? `<p class="cabinet-sub">Client : <strong>${escapeHtml(ctx.clientLabel)}</strong></p>` : ''}
    </div>

    <!-- KPI tiles -->
    <div class="kpi-row">
      <div class="kpi-tile">
        <p class="kpi-label">Anomalies</p>
        <p class="kpi-value">${anomalies.length}</p>
      </div>
      <div class="kpi-tile critical">
        <p class="kpi-label">Critiques</p>
        <p class="kpi-value">${sev.critical}</p>
      </div>
      <div class="kpi-tile high">
        <p class="kpi-label">Hautes</p>
        <p class="kpi-value">${sev.high}</p>
      </div>
      <div class="kpi-tile gold">
        <p class="kpi-label">Récupérable</p>
        <p class="kpi-value">${fcfa(totalRecovery)}</p>
        <p class="kpi-unit">FCFA</p>
      </div>
    </div>

    <!-- Infos relevé -->
    <h2 class="section-title">Informations du relevé</h2>
    <table class="info-table">
      <tr><th>Relevé</th><td>${escapeHtml(ctx.statementLabel ?? '—')}</td></tr>
      <tr><th>Période</th><td>${escapeHtml(ctx.periodLabel ?? '—')}</td></tr>
      <tr><th>Banque</th><td>${escapeHtml(ctx.bankLabel ?? '—')}</td></tr>
      ${ctx.clientTypeLabel ? `<tr><th>Catégorie tarifaire</th><td><span class="pill pill-tier">${escapeHtml(ctx.clientTypeLabel)}</span> <span class="muted">— barème appliqué pour la détection</span></td></tr>` : ''}
      <tr><th>Sévérités</th><td>${sev.critical} critique(s) · ${sev.high} haute(s) · ${sev.medium} moyenne(s) · ${sev.low} faible(s)</td></tr>
    </table>

    <!-- Méthodologie -->
    <h2 class="section-title">Méthodologie &amp; cadre normatif</h2>
    <p class="method-intro">
      Le présent dossier a été établi par confrontation automatique des opérations du relevé aux conditions
      tarifaires conventionnelles et aux indicateurs de risque définis par&nbsp;:
    </p>
    <div class="norm-grid">
      <div class="norm-chip"><span class="norm-code">ISA 240</span> Responsabilités de l'auditeur · fraudes</div>
      <div class="norm-chip"><span class="norm-code">ISA 315</span> Évaluation des risques d'anomalies</div>
      <div class="norm-chip"><span class="norm-code">GAFI / FATF</span> Lutte anti-blanchiment (LCB-FT)</div>
      <div class="norm-chip"><span class="norm-code">Basel BCBS</span> Saines pratiques bancaires</div>
      <div class="norm-chip"><span class="norm-code">OHADA AUDCIF</span> Droit comptable Afrique francophone</div>
      <div class="norm-chip"><span class="norm-code">BCEAO / COBAC</span> Régulation UEMOA &amp; CEMAC</div>
    </div>
    <p class="method-outro">
      19 algorithmes déterministes appliqués à 100 % des opérations, complétés par analyse statistique
      des écarts et revue manuelle par auditeur qualifié. Chaque entrée tracée par chaîne SHA-256.
    </p>
  </div>
  <footer class="page-footer">
    <span>AtlasBanx · Dossier d'anomalies bancaires</span>
    <span class="footer-ref">${escapeHtml(refId)}</span>
  </footer>
</section>

<!-- ═══════════════════════════════════════════════════════════════════════
     FICHE PAR ANOMALIE
═══════════════════════════════════════════════════════════════════════ -->
${anomalies.map((a, idx) => renderAnomalyCardHtml(a, idx + 1, anomalies.length, ctx)).join('')}

<!-- ═══════════════════════════════════════════════════════════════════════
     CHAÎNE D'AUDIT
═══════════════════════════════════════════════════════════════════════ -->
${(ctx.auditTrail && ctx.auditTrail.length > 0) ? `
<section class="page audit-page">
  <h1 class="page-title">Chaîne d'audit (SHA-256)</h1>
  <p class="page-subtitle">Toute modification d'une entrée invalide la chaîne en aval. Conservation 10 ans minimum (OHADA AUDCIF).</p>
  <table class="audit-table">
    <thead>
      <tr><th>Date/heure</th><th>Acteur</th><th>Action</th><th>Hash (court)</th></tr>
    </thead>
    <tbody>
      ${ctx.auditTrail.slice(0, 50).map((e) => `
        <tr>
          <td>${fmtDateTime(e.createdAt)}</td>
          <td>${escapeHtml(e.actor.handle)} <span class="role-pill">${escapeHtml(e.actor.role)}</span></td>
          <td>${escapeHtml(e.action)}</td>
          <td class="hash">${escapeHtml(e.hash.slice(0, 24))}…</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <footer class="page-footer">
    <span>Chaîne d'audit immuable</span>
    <span class="footer-ref">AtlasBanx · ${escapeHtml(refId)}</span>
  </footer>
</section>
` : ''}

<!-- Footer générique sur chaque page via @page CSS -->
</body>
</html>`;
}

function renderAnomalyCardHtml(
  a: Anomaly,
  index: number,
  total: number,
  ctx: ExportContext,
): string {
  const refs = REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre;
  const wf = workflowProgress(a);
  const myComments = (ctx.comments ?? []).filter((c) => c.anomalyId === a.id);

  return `
<section class="page anomaly-card sev-${a.severity}">
  <header class="anomaly-band">
    <div class="band-left">
      <span class="sev-pill">${severityFr(a.severity)}</span>
      <span class="anomaly-counter">Anomalie ${index} / ${total}</span>
    </div>
    <div class="band-right">
      <span class="status-pill">${statusFr(a.status)}</span>
    </div>
  </header>

  <h1 class="anomaly-title">${escapeHtml(a.title)}</h1>
  <p class="anomaly-meta">
    <span class="muted">ID</span> <code>${escapeHtml(a.id)}</code>
    <span class="dot">·</span>
    <span class="muted">Type</span> <code>${escapeHtml(a.type)}</code>
  </p>

  <!-- 1. Synthèse -->
  <h2 class="anomaly-section">1. Synthèse</h2>
  <p class="anomaly-desc">${escapeHtml(a.description || a.title)}</p>

  <!-- 2. Transaction (preuve) -->
  <h2 class="anomaly-section">2. Transaction incriminée — preuve</h2>
  <table class="data-table">
    <tr><th>Date opération</th><td>${fmtDate(a.transaction.date)}</td></tr>
    <tr><th>Libellé</th><td><code>${escapeHtml(a.transaction.label || '—')}</code></td></tr>
    <tr><th>Montant</th><td><strong class="${a.transaction.amountCentimes < 0 ? 'text-debit' : 'text-credit'}">${fcfa(Math.abs(a.transaction.amountCentimes))} FCFA</strong> <span class="muted">(${a.transaction.amountCentimes < 0 ? 'débit' : 'crédit'})</span></td></tr>
    ${a.transaction.balanceAfterCentimes != null ? `<tr><th>Solde après opération</th><td>${fcfa(a.transaction.balanceAfterCentimes)} FCFA</td></tr>` : ''}
    <tr><th>Page PDF source</th><td>${a.transaction.pdfPage ? `p. ${a.transaction.pdfPage}` : '—'}</td></tr>
    <tr><th>ID transaction</th><td><code class="small">${escapeHtml(a.transaction.id)}</code></td></tr>
  </table>

  <!-- 3. Détection -->
  <h2 class="anomaly-section">3. Détails de détection</h2>
  <table class="data-table">
    <tr><th>Algorithme</th><td><code>${escapeHtml(a.detection.algorithm)}</code></td></tr>
    <tr><th>Confiance</th><td><div class="confidence-bar"><div class="confidence-fill" style="width:${(a.detection.confidence * 100).toFixed(1)}%"></div></div> <strong>${(a.detection.confidence * 100).toFixed(1)}%</strong></td></tr>
    <tr><th>Règle déclenchée</th><td>${escapeHtml(a.detection.rule || '—')}</td></tr>
    <tr><th>Récupérable estimé</th><td>${a.potentialRecoveryCentimes ? `<strong class="text-recovery">${fcfa(a.potentialRecoveryCentimes)} FCFA</strong>` : '<span class="muted">Non quantifiable — signalement</span>'}</td></tr>
    ${a.conventionLabel ? `<tr><th>Convention référencée</th><td>${escapeHtml(a.conventionLabel)}</td></tr>` : ''}
  </table>

  ${a.conventionEvidence ? `
  <!-- 3 bis. PREUVE TARIFAIRE (élément central pour réclamation) -->
  <h2 class="anomaly-section evidence-section">3 bis. Preuve tarifaire — convention vs facturé</h2>
  <div class="evidence-card">
    <div class="evidence-tier">
      <span class="tier-label">Barème applicable :</span>
      <strong>${escapeHtml(a.conventionEvidence.tierAppliedLabel)}</strong>
    </div>
    <div class="evidence-amounts">
      <div class="amount-block convention">
        <p class="amount-label">Tarif conventionnel</p>
        <p class="amount-value">${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.conventionAmount))}</p>
        <p class="amount-unit">FCFA</p>
      </div>
      <div class="amount-arrow">→</div>
      <div class="amount-block actual">
        <p class="amount-label">Tarif appliqué</p>
        <p class="amount-value">${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.actualAmount))}</p>
        <p class="amount-unit">FCFA</p>
      </div>
      <div class="amount-equals">=</div>
      <div class="amount-block excess">
        <p class="amount-label">Écart récupérable</p>
        <p class="amount-value">+${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.excessAmount))}</p>
        <p class="amount-unit">FCFA</p>
      </div>
    </div>
    ${a.conventionEvidence.note ? `<p class="evidence-note">${escapeHtml(a.conventionEvidence.note)}</p>` : ''}
    ${a.conventionEvidence.tierAppliedKey ? `<p class="evidence-ref"><span class="muted">Référence interne :</span> <code>${escapeHtml(a.conventionEvidence.tierAppliedKey)}</code></p>` : ''}
  </div>
  ` : ''}

  <!-- 4. Cadre réglementaire -->
  <h2 class="anomaly-section">4. Cadre réglementaire applicable</h2>
  <table class="data-table reg-table">
    <thead><tr><th>Réf.</th><th>Cadre</th><th>Description</th></tr></thead>
    <tbody>
      ${refs.map((r) => `<tr><td><code>${escapeHtml(r.code)}</code></td><td><span class="framework-pill">${escapeHtml(r.framework)}</span></td><td>${escapeHtml(r.description)}</td></tr>`).join('')}
    </tbody>
  </table>

  <!-- 5. Workflow -->
  <h2 class="anomaly-section">5. Workflow de validation</h2>
  <ol class="workflow-list">
    ${wf.map((w) => `<li class="${w.step > 0 ? 'done' : 'pending'}"><span class="wf-marker">${w.step > 0 ? '✓' : '○'}</span> ${escapeHtml(w.label)}</li>`).join('')}
  </ol>

  ${myComments.length > 0 ? `
  <!-- 6. Discussion -->
  <h2 class="anomaly-section">6. Discussion (${myComments.length})</h2>
  <div class="comments-list">
    ${myComments.map((c) => `
      <div class="comment">
        <div class="comment-head">
          <strong>${escapeHtml(c.author.handle)}</strong>
          <span class="role-pill">${escapeHtml(c.author.role)}</span>
          <span class="muted">${fmtDateTime(c.createdAt)}</span>
        </div>
        <p class="comment-body">${escapeHtml(c.content)}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
  <footer class="page-footer">
    <span>Anomalie ${index} / ${total} — ${severityFr(a.severity)}</span>
    <span class="footer-ref">AtlasBanx · ${escapeHtml(a.id.slice(0, 8))}</span>
  </footer>
</section>`;
}

// ============================================================================
// CSS — typographie Dosis + couleurs canon Tailwind + pagination A4
// ============================================================================

const REPORT_CSS = `
  /* @page n'apporte que les marges d'impression (footer auto-paginé). On
     gère le padding réel via .page pour que SCREEN et PRINT soient identiques.
     Si on s'appuyait sur @page margin: 12mm 14mm, l'aperçu écran (avant
     « Enregistrer en PDF ») afficherait le contenu collé aux bords. */
  @page {
    size: A4 portrait;
    margin: 0;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Dosis', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #070b1f;
    background: #f5f2e8;
    font-weight: 400;
  }
  code, .hash, .small {
    font-family: 'JetBrains Mono', 'SF Mono', Consolas, monospace;
    font-size: 0.85em;
    color: #1e2640;
  }
  .small { font-size: 0.75em; }

  /* ─── Page A4 ── padding intérieur uniforme 14mm partout ──────────────
     Pas de min-height: chaque page prend la hauteur naturelle de son
     contenu. La pagination physique reste correcte à l'impression grâce
     à page-break-after: always (chaque .page démarre sur une nouvelle
     feuille A4). Évite le vide de plusieurs cm en aperçu écran quand
     le contenu d'une section est court (ex. couverture). */
  .page {
    width: 210mm;
    padding: 14mm;
    margin: 8mm auto;
    background: #fff;
    box-shadow: 0 4px 20px rgba(15, 14, 10, 0.08);
    page-break-after: always;
    page-break-inside: avoid;
    position: relative;
  }
  .page:last-child { page-break-after: auto; }
  @media print {
    body { background: #fff; }
    .page { margin: 0 auto; box-shadow: none; padding: 14mm; }
  }

  /* ─── Cover page ──────────────────────────────────────────────────────── */
  .cover-band {
    background: linear-gradient(135deg, #070b1f 0%, #1e2640 60%, #2f3852 100%);
    color: #fff;
    padding: 16mm 14mm 12mm 14mm;
    /* Full-bleed : la bande dégradée touche les bords du papier en remontant
       à travers le padding 14mm de .page. */
    margin: -14mm -14mm 8mm -14mm;
    position: relative;
    overflow: hidden;
  }
  .cover-band::after {
    content: ''; position: absolute; top: -20mm; right: -20mm;
    width: 80mm; height: 80mm; border-radius: 50%;
    background: radial-gradient(circle, rgba(201,149,74,0.25), transparent 60%);
  }
  .cover-band .eyebrow {
    font-size: 8pt; letter-spacing: 0.2em; text-transform: uppercase;
    color: #c9954a; margin: 0 0 6mm 0; font-weight: 600;
  }
  .cover-band h1 {
    font-size: 28pt; margin: 0; font-weight: 700; letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .cover-band .lede { font-size: 12pt; margin: 4mm 0 0 0; font-weight: 300; opacity: 0.85; }
  .cover-ref {
    margin-top: 10mm; display: inline-flex; gap: 4mm; align-items: center;
    background: rgba(255,255,255,0.08); padding: 3mm 5mm; border-radius: 4px;
    border: 1px solid rgba(201,149,74,0.4);
  }
  .ref-label { font-size: 8pt; color: #c9954a; font-weight: 600; }
  .ref-value { font-size: 10pt; font-family: 'JetBrains Mono', monospace; color: #fff; }
  .ref-meta { font-size: 8pt; color: rgba(255,255,255,0.7); margin-left: 4mm; }

  .cover-body { padding: 0; }
  .cabinet-block { margin-bottom: 8mm; padding: 4mm 5mm; border-left: 4px solid #c9954a; background: #fbf9f3; }
  .cabinet-name { font-size: 13pt; font-weight: 700; margin: 0; color: #070b1f; }
  .cabinet-sub { font-size: 10pt; margin: 1mm 0 0 0; color: #475066; }

  .kpi-row {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm;
    margin: 6mm 0 10mm 0;
  }
  .kpi-tile {
    background: #fbf9f3; border: 1px solid #ece7d6; border-radius: 8px;
    padding: 5mm 4mm; text-align: center;
  }
  .kpi-tile.critical { background: #fef2f2; border-color: #fecaca; }
  .kpi-tile.critical .kpi-value { color: #b91c1c; }
  .kpi-tile.high { background: #fff7ed; border-color: #fed7aa; }
  .kpi-tile.high .kpi-value { color: #c2410c; }
  .kpi-tile.gold { background: linear-gradient(135deg, #fbf8f0, #f4ecd4); border-color: #dec078; }
  .kpi-tile.gold .kpi-value { color: #8a5e30; }
  .kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: 0.12em; color: #6a7388; margin: 0 0 2mm 0; font-weight: 600; }
  .kpi-value { font-size: 22pt; margin: 0; font-weight: 700; color: #070b1f; line-height: 1; }
  .kpi-unit { font-size: 8pt; color: #6a7388; margin: 1mm 0 0 0; }

  .section-title {
    font-size: 13pt; margin: 8mm 0 3mm 0; padding-bottom: 2mm;
    border-bottom: 2px solid #070b1f; color: #070b1f; font-weight: 700;
  }
  .info-table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  .info-table th {
    text-align: left; padding: 2mm 4mm 2mm 0; color: #6a7388; font-weight: 600;
    width: 38mm; vertical-align: top; font-size: 9pt; letter-spacing: 0.02em;
  }
  .info-table td { padding: 2mm 0; color: #1e2640; }
  .pill { display: inline-block; padding: 1mm 3mm; border-radius: 12px; font-size: 9pt; font-weight: 600; }
  .pill-tier { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .muted { color: #6a7388; font-size: 9pt; }

  .method-intro, .method-outro { font-size: 9.5pt; line-height: 1.55; color: #1e2640; margin: 3mm 0; }
  .norm-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 2mm;
    margin: 3mm 0;
  }
  .norm-chip {
    background: #fbf9f3; border: 1px solid #ece7d6; border-radius: 4px;
    padding: 2mm 3mm; font-size: 9pt;
  }
  .norm-code {
    display: inline-block; min-width: 28mm; font-weight: 700;
    color: #8a5e30; font-family: 'JetBrains Mono', monospace; font-size: 8.5pt;
  }

  /* ─── Anomaly card ─── */
  .anomaly-card { padding-top: 14mm; }
  .anomaly-band {
    display: flex; justify-content: space-between; align-items: center;
    padding: 4mm 14mm;
    /* Full-bleed : bandeau coloré sévérité jusqu'aux bords du papier */
    margin: -14mm -14mm 6mm -14mm;
    color: #fff;
  }
  .sev-critical .anomaly-band { background: linear-gradient(90deg, #7f1d1d, #b91c1c); }
  .sev-high .anomaly-band     { background: linear-gradient(90deg, #9a3412, #c2410c); }
  .sev-medium .anomaly-band   { background: linear-gradient(90deg, #92400e, #d97706); }
  .sev-low .anomaly-band      { background: linear-gradient(90deg, #475066, #6a7388); }

  .band-left, .band-right { display: flex; align-items: center; gap: 3mm; }
  .sev-pill { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); padding: 1mm 4mm; border-radius: 4px; font-weight: 700; font-size: 9pt; letter-spacing: 0.05em; }
  .anomaly-counter { font-size: 9pt; opacity: 0.85; font-weight: 500; }
  .status-pill { background: rgba(255,255,255,0.15); padding: 1mm 3mm; border-radius: 12px; font-size: 8.5pt; font-weight: 600; }

  .anomaly-title { font-size: 18pt; margin: 4mm 0 1mm 0; font-weight: 700; color: #070b1f; line-height: 1.2; }
  .anomaly-meta { font-size: 9pt; color: #6a7388; margin: 0 0 6mm 0; }
  .anomaly-meta .dot { margin: 0 2mm; color: #c8ccd6; }
  .anomaly-meta code { background: #fbf9f3; padding: 0.5mm 2mm; border-radius: 3px; }

  .anomaly-section {
    font-size: 11pt; margin: 6mm 0 2mm 0;
    color: #070b1f; font-weight: 700;
    padding: 1.5mm 3mm; background: #f5f2e8;
    border-left: 3px solid #c9954a; border-radius: 0 4px 4px 0;
  }
  .anomaly-section.evidence-section {
    background: linear-gradient(90deg, #fef3c7, #fef9e7);
    border-left-color: #ca8a04; color: #713f12;
  }
  .anomaly-desc { font-size: 10.5pt; line-height: 1.55; margin: 2mm 0 0 0; color: #1e2640; }

  /* Tables génériques */
  .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 2mm 0; }
  .data-table th {
    text-align: left; padding: 2mm 4mm 2mm 1mm; color: #475066; font-weight: 600;
    width: 38mm; vertical-align: top; font-size: 9pt; border-bottom: 1px solid #f1ede2;
  }
  .data-table td { padding: 2mm 1mm; border-bottom: 1px solid #f1ede2; color: #070b1f; }
  .data-table tr:last-child th, .data-table tr:last-child td { border-bottom: none; }
  .data-table.reg-table thead th { background: #fbf9f3; color: #475066; font-size: 9pt; font-weight: 700; padding: 2mm 3mm; border-bottom: 2px solid #ece7d6; }
  .data-table.reg-table tbody td { padding: 2mm 3mm; }

  .text-debit { color: #b91c1c; }
  .text-credit { color: #15803d; }
  .text-recovery { color: #15803d; }

  /* Confidence bar */
  .confidence-bar { display: inline-block; width: 30mm; height: 2mm; background: #ece7d6; border-radius: 1mm; overflow: hidden; vertical-align: middle; margin-right: 2mm; }
  .confidence-fill { height: 100%; background: linear-gradient(90deg, #c9954a, #b07c3c); }

  /* Framework pills */
  .framework-pill { display: inline-block; padding: 0.5mm 2mm; border-radius: 3px; background: #eef2ff; color: #4338ca; font-size: 8.5pt; font-weight: 600; }

  /* ─── Evidence card (preuve tarifaire) — TRÈS visible ─── */
  .evidence-card {
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
    border: 2px solid #fcd34d; border-radius: 8px;
    padding: 5mm; margin: 3mm 0 4mm 0;
    box-shadow: 0 1px 3px rgba(252, 211, 77, 0.3);
  }
  .evidence-tier { font-size: 10pt; margin-bottom: 4mm; color: #92400e; }
  .evidence-tier .tier-label { color: #a16207; font-weight: 600; margin-right: 2mm; }
  .evidence-tier strong { color: #713f12; font-weight: 700; font-size: 11pt; }

  .evidence-amounts {
    display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 2mm;
    align-items: center;
  }
  .amount-block {
    background: #fff; border-radius: 6px; padding: 4mm 3mm;
    text-align: center; border: 1px solid;
  }
  .amount-block.convention { border-color: #86efac; }
  .amount-block.convention .amount-value { color: #15803d; }
  .amount-block.actual { border-color: #fca5a5; }
  .amount-block.actual .amount-value { color: #b91c1c; }
  .amount-block.excess { border-color: #fca5a5; background: #fef2f2; }
  .amount-block.excess .amount-value { color: #991b1b; font-weight: 800; }
  .amount-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #6a7388; margin: 0 0 1mm 0; font-weight: 600; }
  .amount-value { font-size: 16pt; margin: 0; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .amount-unit { font-size: 8pt; color: #6a7388; margin: 1mm 0 0 0; }
  .amount-arrow, .amount-equals { font-size: 18pt; color: #ca8a04; font-weight: 700; }

  .evidence-note { font-size: 9.5pt; line-height: 1.5; color: #713f12; margin: 4mm 0 0 0; padding: 2mm 3mm; background: rgba(255,255,255,0.5); border-radius: 4px; font-style: italic; }
  .evidence-ref { font-size: 8.5pt; color: #92400e; margin: 2mm 0 0 0; }
  .evidence-ref code { background: rgba(255,255,255,0.5); padding: 0.5mm 2mm; border-radius: 3px; }

  /* Workflow */
  .workflow-list { margin: 2mm 0; padding: 0; list-style: none; }
  .workflow-list li { padding: 2mm 0 2mm 8mm; position: relative; font-size: 10pt; line-height: 1.4; }
  .workflow-list li .wf-marker { position: absolute; left: 0; top: 1mm; width: 6mm; height: 6mm; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 700; }
  .workflow-list li.done .wf-marker { background: #dcfce7; color: #15803d; }
  .workflow-list li.pending .wf-marker { background: #f5f2e8; color: #6a7388; border: 1px dashed #c8ccd6; }
  .workflow-list li.done { color: #070b1f; }
  .workflow-list li.pending { color: #6a7388; }

  /* Comments */
  .comments-list { margin: 2mm 0; }
  .comment { margin-bottom: 3mm; padding: 3mm 4mm; background: #fbf9f3; border-radius: 6px; border-left: 3px solid #ece7d6; }
  .comment-head { display: flex; gap: 2mm; align-items: center; font-size: 9pt; margin-bottom: 1mm; }
  .comment-head strong { color: #070b1f; }
  .comment-body { font-size: 9.5pt; line-height: 1.4; margin: 0; color: #1e2640; }
  .role-pill { background: #e0e7ff; color: #4338ca; padding: 0.3mm 2mm; border-radius: 8px; font-size: 7.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Audit page */
  .audit-page .page-title { font-size: 20pt; font-weight: 700; color: #070b1f; margin: 0 0 2mm 0; padding-bottom: 3mm; border-bottom: 2px solid #c9954a; }
  .audit-page .page-subtitle { color: #6a7388; font-size: 9pt; font-style: italic; margin: 0 0 6mm 0; }
  .audit-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  .audit-table thead th { background: #070b1f; color: #fff; padding: 2mm 3mm; text-align: left; font-weight: 600; font-size: 8.5pt; }
  .audit-table tbody td { padding: 2mm 3mm; border-bottom: 1px solid #f1ede2; vertical-align: top; }
  .audit-table .hash { font-family: 'JetBrains Mono', monospace; font-size: 7.5pt; color: #475066; }

  /* Footer interne sur chaque page — en fin de contenu, pas absolument
     positionné (sinon dépendrait d'un min-height qui crée des vides). */
  .page-footer {
    margin-top: 10mm;
    padding-top: 3mm;
    border-top: 1px solid #ece7d6;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #9ba3b4;
  }
  .page-footer .footer-ref {
    font-family: 'JetBrains Mono', monospace;
  }

  /* Print-specific */
  @media print {
    .cover-band { -webkit-print-color-adjust: exact; }
  }
`;


// ============================================================================
// Word — HTML enrichi (compatible MS Word + LibreOffice)
// ============================================================================

export async function exportAnomaliesWord(anomalies: Anomaly[], ctx: ExportContext = {}): Promise<void> {
  const REF = reportRef();
  const totalRecovery = anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0);
  const sev = {
    critical: anomalies.filter((a) => a.severity === 'critical').length,
    high:     anomalies.filter((a) => a.severity === 'high').length,
    medium:   anomalies.filter((a) => a.severity === 'medium').length,
    low:      anomalies.filter((a) => a.severity === 'low').length,
  };

  // Style général
  const css = `
    body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1e2640; }
    h1 { color: #1e2640; font-size: 20pt; margin-bottom: 4px; }
    h2 { color: #1e2640; font-size: 14pt; border-bottom: 2px solid #1e2640; padding-bottom: 4px; margin-top: 24px; }
    h3 { color: #1e2640; font-size: 12pt; margin-top: 16px; }
    h4 { color: #1e2640; font-size: 10pt; background: #f3f2e8; padding: 4px 8px; margin: 12px 0 6px 0; }
    .cover { background: #1e2640; color: #fff; padding: 24px; }
    .cover h1 { color: #fff; }
    .meta-box { background: #f8f7f4; border-left: 4px solid #c9954a; padding: 12px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 8px 0; }
    th { background: #1e2640; color: #fff; padding: 5px; text-align: left; }
    td { padding: 4px 6px; border-bottom: 1px solid #ddd; vertical-align: top; }
    .anomaly-card { page-break-before: always; margin-top: 24px; }
    .sev-pill { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 9pt; color: white; }
    .footer { font-size: 7pt; color: #888; margin-top: 32px; border-top: 1px solid #ccc; padding-top: 6px; }
    .note { font-size: 8pt; color: #666; font-style: italic; }
  `;

  const coverHtml = `
    <div class="cover">
      <h1>Dossier d'anomalies bancaires</h1>
      <p>Rapport d'audit — conforme aux standards internationaux</p>
      <p><b>Réf. ${REF}</b> · Généré le ${new Date().toLocaleString('fr-FR')}</p>
    </div>
    <div class="meta-box">
      <p><b>Cabinet :</b> ${escapeHtml(ctx.cabinetName ?? 'AtlasBanx')}</p>
      <p><b>Relevé :</b> ${escapeHtml(ctx.statementLabel ?? '—')}</p>
      <p><b>Période :</b> ${escapeHtml(ctx.periodLabel ?? '—')}</p>
      <p><b>Client :</b> ${escapeHtml(ctx.clientLabel ?? '—')} · <b>Banque :</b> ${escapeHtml(ctx.bankLabel ?? '—')}</p>
      ${ctx.clientTypeLabel ? `<p><b>Catégorie tarifaire :</b> <span style="background:#fef3c7;padding:2px 6px;border-radius:3px;">${escapeHtml(ctx.clientTypeLabel)}</span> <span style="color:#888;font-size:9pt;">(barème applicable pour la détection)</span></p>` : ''}
      <p><b>Anomalies :</b> ${anomalies.length} (${sev.critical} critique, ${sev.high} haute, ${sev.medium} moyenne, ${sev.low} faible)</p>
      <p><b>Récupérable estimé :</b> ${fcfa(totalRecovery)} FCFA</p>
    </div>
    <h2>Méthodologie &amp; cadre normatif</h2>
    <p>Le présent dossier a été établi par confrontation automatique des opérations du relevé aux conditions tarifaires conventionnelles et aux indicateurs de risque définis par :</p>
    <ul>
      <li><b>ISA 240</b> — Responsabilités de l'auditeur relatives aux fraudes</li>
      <li><b>ISA 315</b> — Identification et évaluation des risques d'anomalies significatives</li>
      <li><b>Recommandations GAFI/FATF</b> — LCB-FT</li>
      <li><b>Basel Committee on Banking Supervision</b></li>
      <li><b>OHADA AUDCIF</b></li>
      <li><b>Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)</b></li>
    </ul>
    <p>19 algorithmes déterministes appliqués à 100 % des opérations + analyse statistique + revue manuelle par auditeur qualifié. Chaque entrée tracée par chaîne SHA-256.</p>
  `;

  const anomaliesHtml = anomalies.map((a, idx) => {
    const refs = REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre;
    const wf = workflowProgress(a);
    const myComments = (ctx.comments ?? []).filter((c) => c.anomalyId === a.id);
    return `
      <div class="anomaly-card">
        <h2><span class="sev-pill" style="background:${sevColorHex(a.severity)};">${severityFr(a.severity)}</span> Anomalie ${idx + 1} / ${anomalies.length} — ${escapeHtml(a.title)}</h2>
        <p><b>Statut :</b> ${statusFr(a.status)} · <b>ID :</b> ${escapeHtml(a.id)} · <b>Type :</b> ${escapeHtml(a.type)}</p>

        <h4>1. Synthèse</h4>
        <p>${escapeHtml(a.description || a.title)}</p>

        <h4>2. Transaction incriminée (preuve)</h4>
        <table>
          <tr><td><b>Date opération</b></td><td>${fmtDate(a.transaction.date)}</td></tr>
          <tr><td><b>Libellé</b></td><td>${escapeHtml(a.transaction.label || '—')}</td></tr>
          <tr><td><b>Montant</b></td><td>${fcfa(Math.abs(a.transaction.amountCentimes))} FCFA (${a.transaction.amountCentimes < 0 ? 'débit' : 'crédit'})</td></tr>
          <tr><td><b>Solde après opération</b></td><td>${a.transaction.balanceAfterCentimes != null ? `${fcfa(a.transaction.balanceAfterCentimes)} FCFA` : '—'}</td></tr>
          <tr><td><b>Page PDF source</b></td><td>${a.transaction.pdfPage ? `p. ${a.transaction.pdfPage}` : '—'}</td></tr>
          <tr><td><b>ID transaction</b></td><td><span style="font-family:monospace;font-size:8pt">${escapeHtml(a.transaction.id)}</span></td></tr>
        </table>

        <h4>3. Détails de détection</h4>
        <table>
          <tr><td><b>Algorithme</b></td><td><span style="font-family:monospace;font-size:9pt">${escapeHtml(a.detection.algorithm)}</span></td></tr>
          <tr><td><b>Confiance</b></td><td>${(a.detection.confidence * 100).toFixed(1)}%</td></tr>
          <tr><td><b>Règle déclenchée</b></td><td>${escapeHtml(a.detection.rule || '—')}</td></tr>
          <tr><td><b>Récupérable estimé</b></td><td>${a.potentialRecoveryCentimes ? `<b>${fcfa(a.potentialRecoveryCentimes)} FCFA</b>` : 'Non quantifiable (signalement)'}</td></tr>
          ${a.conventionLabel ? `<tr><td><b>Convention référencée</b></td><td>${escapeHtml(a.conventionLabel)}</td></tr>` : ''}
        </table>

        ${a.conventionEvidence ? `
          <h4 style="background:#fef3c7;color:#a16207;">3 bis. Preuve tarifaire (convention vs facturé)</h4>
          <table style="background:#fffbeb;border:1px solid #fde68a;">
            <tr><td><b>Barème applicable</b></td><td><b>${escapeHtml(a.conventionEvidence.tierAppliedLabel)}</b></td></tr>
            <tr><td><b>Tarif conventionnel</b></td><td style="color:#15803d;font-family:monospace;">${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.conventionAmount))} FCFA</td></tr>
            <tr><td><b>Tarif appliqué</b></td><td style="color:#b91c1c;font-family:monospace;font-weight:bold;">${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.actualAmount))} FCFA</td></tr>
            <tr style="background:#fef3c7;"><td><b>Écart (récupérable)</b></td><td style="color:#b91c1c;font-family:monospace;font-weight:bold;font-size:11pt;">+${new Intl.NumberFormat('fr-FR').format(Math.round(a.conventionEvidence.excessAmount))} FCFA</td></tr>
            ${a.conventionEvidence.note ? `<tr><td><b>Note</b></td><td>${escapeHtml(a.conventionEvidence.note)}</td></tr>` : ''}
            ${a.conventionEvidence.tierAppliedKey ? `<tr><td><b>Référence interne</b></td><td><span style="font-family:monospace;font-size:8pt;color:#888;">${escapeHtml(a.conventionEvidence.tierAppliedKey)}</span></td></tr>` : ''}
          </table>
        ` : ''}

        <h4>4. Cadre réglementaire applicable</h4>
        <table>
          <thead><tr><th>Réf.</th><th>Cadre</th><th>Description</th></tr></thead>
          <tbody>
            ${refs.map((r) => `<tr><td>${escapeHtml(r.code)}</td><td>${r.framework}</td><td>${escapeHtml(r.description)}</td></tr>`).join('')}
          </tbody>
        </table>

        <h4>5. Workflow de validation</h4>
        <table>
          ${wf.map((w) => `<tr><td style="width:20px;">${w.step > 0 ? '✓' : '○'}</td><td>${escapeHtml(w.label)}</td></tr>`).join('')}
        </table>

        ${myComments.length > 0 ? `
          <h4>6. Discussion (${myComments.length})</h4>
          <table>
            <thead><tr><th>Date</th><th>Auteur</th><th>Commentaire</th></tr></thead>
            <tbody>
              ${myComments.map((c) => `<tr><td>${fmtDateTime(c.createdAt)}</td><td>${escapeHtml(c.author.handle)}</td><td>${escapeHtml(c.content)}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>
    `;
  }).join('');

  // Chaîne d'audit
  const auditHtml = ctx.auditTrail && ctx.auditTrail.length > 0 ? `
    <h2 style="page-break-before:always;">Chaîne d'audit (SHA-256)</h2>
    <p class="note">Toute modification d'une entrée invalide la chaîne en aval. Conservation 10 ans minimum (OHADA).</p>
    <table>
      <thead><tr><th>Date/heure</th><th>Acteur</th><th>Action</th><th>Hash (court)</th></tr></thead>
      <tbody>
        ${ctx.auditTrail.slice(0, 100).map((e) => `<tr><td>${fmtDateTime(e.createdAt)}</td><td>${escapeHtml(e.actor.handle)} (${e.actor.role})</td><td>${escapeHtml(e.action)}</td><td style="font-family:monospace;font-size:8pt">${escapeHtml(e.hash.slice(0, 24))}…</td></tr>`).join('')}
      </tbody>
    </table>
  ` : '';

  const html = `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8">
<title>Dossier d'anomalies AtlasBanx</title>
<style>${css}</style>
</head>
<body>
  ${coverHtml}
  ${anomaliesHtml}
  ${auditHtml}
  <div class="footer">AtlasBanx · Réf. ${REF} · Plateforme d'audit bancaire UEMOA/CEMAC</div>
</body>
</html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  downloadBlob(blob, `atlasbanx-dossier-anomalies-${dateStamp()}.doc`);
}

// ============================================================================
// Excel — workbook multi-feuilles (Cover · Anomalies · Workflow · Audit)
// ============================================================================

export async function exportAnomaliesExcel(anomalies: Anomaly[], ctx: ExportContext = {}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'AtlasBanx';
  wb.created = new Date();
  const REF = reportRef();

  // ── Feuille 1 : Synthèse exécutive ─────────────────────────────────────────
  const cover = wb.addWorksheet('Synthèse', { pageSetup: { orientation: 'portrait' } });
  cover.mergeCells('A1:F1');
  cover.getCell('A1').value = 'Dossier d\'anomalies bancaires — AtlasBanx';
  cover.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF1E2640' } };
  cover.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  cover.getRow(1).height = 28;

  cover.getCell('A2').value = `Rapport d'audit international · Réf. ${REF}`;
  cover.getCell('A2').font = { italic: true, color: { argb: 'FF888888' } };

  const meta = [
    ['Cabinet',             ctx.cabinetName ?? 'AtlasBanx'],
    ['Relevé',              ctx.statementLabel ?? '—'],
    ['Période',             ctx.periodLabel ?? '—'],
    ['Client',              ctx.clientLabel ?? '—'],
    ['Banque',              ctx.bankLabel ?? '—'],
    ['Anomalies',           anomalies.length],
    ['  Critiques',         anomalies.filter((a) => a.severity === 'critical').length],
    ['  Hautes',            anomalies.filter((a) => a.severity === 'high').length],
    ['  Moyennes',          anomalies.filter((a) => a.severity === 'medium').length],
    ['  Faibles',           anomalies.filter((a) => a.severity === 'low').length],
    ['Récupérable estimé',  anomalies.reduce((s, a) => s + (a.potentialRecoveryCentimes ?? 0), 0) / 100],
    ['Généré le',           new Date().toLocaleString('fr-FR')],
  ];
  meta.forEach((row, i) => {
    const r = cover.getRow(4 + i);
    r.getCell(1).value = row[0] as string;
    r.getCell(1).font = { bold: true };
    r.getCell(2).value = row[1] as string | number;
    if (row[0] === 'Récupérable estimé') r.getCell(2).numFmt = '#,##0" FCFA"';
  });

  // Méthodologie
  const methStart = 4 + meta.length + 2;
  cover.getCell(`A${methStart}`).value = 'Méthodologie & cadre normatif';
  cover.getCell(`A${methStart}`).font = { bold: true, size: 12, color: { argb: 'FF1E2640' } };
  const methText = [
    'ISA 240 — Responsabilités de l\'auditeur relatives aux fraudes',
    'ISA 315 — Identification et évaluation des risques d\'anomalies significatives',
    'Recommandations GAFI/FATF — LCB-FT',
    'Basel Committee on Banking Supervision',
    'OHADA AUDCIF',
    'Instructions BCEAO (UEMOA) / Règlements COBAC (CEMAC)',
  ];
  methText.forEach((t, i) => {
    cover.getCell(`A${methStart + 1 + i}`).value = `· ${t}`;
  });

  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 55;

  // ── Feuille 2 : Anomalies (détaillé) ───────────────────────────────────────
  const ws = wb.addWorksheet('Anomalies', { pageSetup: { orientation: 'landscape', paperSize: 9 }, views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = [
    'ID', 'Sévérité', 'Type', 'Statut', 'Titre', 'Description',
    'Date transaction', 'Libellé transaction', 'Montant tx (FCFA)', 'Solde après (FCFA)', 'Page PDF',
    'Algorithme', 'Confiance', 'Règle', 'Convention',
    'Récupérable (FCFA)',
    // Preuve tarifaire — confrontation convention vs facturé
    'Barème applicable', 'Tarif conventionnel (FCFA)', 'Tarif appliqué (FCFA)', 'Écart (FCFA)',
    'Qualifiée par', 'Qualifiée le', 'Validée par', 'Validée le', 'Signée par', 'Signée le',
    'Créée le', 'Cadre réglementaire',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' }, bottom: { style: 'thin' } };
  });

  for (const a of anomalies) {
    const refs = (REGULATORY_FRAMEWORK[a.type] ?? REGULATORY_FRAMEWORK.autre)
      .map((r) => `${r.code} (${r.framework})`).join(' · ');
    const ce = a.conventionEvidence;
    const row = ws.addRow([
      a.id, severityFr(a.severity), a.type, statusFr(a.status), a.title, a.description,
      a.transaction.date, a.transaction.label,
      Math.round(Math.abs(a.transaction.amountCentimes) / 100),
      a.transaction.balanceAfterCentimes != null ? Math.round(a.transaction.balanceAfterCentimes / 100) : '',
      a.transaction.pdfPage ?? '',
      a.detection.algorithm,
      a.detection.confidence,
      a.detection.rule,
      a.conventionLabel ?? '',
      a.potentialRecoveryCentimes != null ? Math.round(a.potentialRecoveryCentimes / 100) : 0,
      ce?.tierAppliedLabel ?? '',
      ce ? Math.round(ce.conventionAmount) : '',
      ce ? Math.round(ce.actualAmount) : '',
      ce ? Math.round(ce.excessAmount) : '',
      a.qualifiedBy?.userHandle ?? '',
      a.qualifiedBy ? fmtDateTime(a.qualifiedBy.at) : '',
      a.validatedBy?.userHandle ?? '',
      a.validatedBy ? fmtDateTime(a.validatedBy.at) : '',
      a.signedBy?.userHandle ?? '',
      a.signedBy ? fmtDateTime(a.signedBy.at) : '',
      fmtDateTime(a.createdAt),
      refs,
    ]);
    const sevColor =
      a.severity === 'critical' ? 'FFB91C1C' :
      a.severity === 'high'     ? 'FFC2410C' :
      a.severity === 'medium'   ? 'FFA16207' : 'FF6B7280';
    row.getCell(2).font = { bold: true, color: { argb: sevColor } };
    row.getCell(9).numFmt  = '#,##0';
    row.getCell(10).numFmt = '#,##0';
    row.getCell(13).numFmt = '0.0%';
    row.getCell(16).numFmt = '#,##0';
    row.getCell(16).font   = { bold: true };
    // Preuve tarifaire — colorisation pour lisibilité immédiate
    row.getCell(18).numFmt = '#,##0';
    row.getCell(18).font   = { color: { argb: 'FF15803D' } };          // convention en vert
    row.getCell(19).numFmt = '#,##0';
    row.getCell(19).font   = { color: { argb: 'FFB91C1C' }, bold: true }; // appliqué en rouge
    row.getCell(20).numFmt = '#,##0';
    row.getCell(20).font   = { color: { argb: 'FFB91C1C' }, bold: true }; // écart en rouge gras
    row.alignment = { vertical: 'top', wrapText: true };
  }

  ws.columns.forEach((c, i) => {
    const widths = [
      38, 10, 22, 12, 36, 50, 12, 36, 16, 16, 8, 32, 10, 36, 28, 16,
      28, 18, 18, 14, // preuve tarifaire (4 cols)
      14, 18, 14, 18, 14, 18, 18, 60,
    ];
    c.width = widths[i] ?? 16;
  });

  // ── Feuille 3 : Workflow ──────────────────────────────────────────────────
  const wfWs = wb.addWorksheet('Workflow', { views: [{ state: 'frozen', ySplit: 1 }] });
  const wfHeader = wfWs.addRow(['Anomalie', 'Sévérité', 'Étape', 'Statut', 'Acteur', 'Date/heure']);
  wfHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wfHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
  for (const a of anomalies) {
    const steps: Array<[string, string, string]> = [
      ['1. Détection',        '✓',  fmtDateTime(a.createdAt)],
      ['2. Qualification',    a.qualifiedBy ? '✓' : '○', a.qualifiedBy ? `${a.qualifiedBy.userHandle} · ${fmtDateTime(a.qualifiedBy.at)}` : 'En attente'],
      ['3. Validation senior', a.validatedBy ? '✓' : '○', a.validatedBy ? `${a.validatedBy.userHandle} · ${fmtDateTime(a.validatedBy.at)}` : 'En attente'],
      ['4. Signature DG',      a.signedBy ? '✓' : '○', a.signedBy ? `${a.signedBy.userHandle} · ${fmtDateTime(a.signedBy.at)}` : 'En attente'],
    ];
    for (const [step, ok, detail] of steps) {
      wfWs.addRow([a.title, severityFr(a.severity), step, ok, '', detail]);
    }
  }
  wfWs.columns = [{ width: 42 }, { width: 12 }, { width: 22 }, { width: 8 }, { width: 18 }, { width: 36 }];

  // ── Feuille 4 : Audit trail (chaîne de hash) ──────────────────────────────
  if (ctx.auditTrail && ctx.auditTrail.length > 0) {
    const aWs = wb.addWorksheet('Audit Trail', { views: [{ state: 'frozen', ySplit: 1 }] });
    const aHeader = aWs.addRow(['Date/heure', 'Acteur', 'Rôle', 'Entité', 'Action', 'Hash', 'Hash précédent']);
    aHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    aHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
    for (const e of ctx.auditTrail) {
      aWs.addRow([
        fmtDateTime(e.createdAt),
        e.actor.handle,
        e.actor.role,
        e.entityId,
        e.action,
        e.hash,
        e.prevHash ?? '(racine)',
      ]);
    }
    aWs.columns = [{ width: 20 }, { width: 18 }, { width: 12 }, { width: 38 }, { width: 18 }, { width: 70 }, { width: 70 }];
  }

  // ── Feuille 5 : Commentaires ──────────────────────────────────────────────
  if (ctx.comments && ctx.comments.length > 0) {
    const cWs = wb.addWorksheet('Commentaires', { views: [{ state: 'frozen', ySplit: 1 }] });
    const cHeader = cWs.addRow(['Anomalie', 'Date/heure', 'Auteur', 'Rôle', 'Commentaire']);
    cHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cHeader.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E2640' } }; });
    for (const c of ctx.comments) {
      const a = anomalies.find((x) => x.id === c.anomalyId);
      cWs.addRow([a?.title ?? c.anomalyId, fmtDateTime(c.createdAt), c.author.handle, c.author.role, c.content]);
    }
    cWs.columns = [{ width: 42 }, { width: 20 }, { width: 18 }, { width: 14 }, { width: 80 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `atlasbanx-dossier-anomalies-${dateStamp()}.xlsx`);
}
