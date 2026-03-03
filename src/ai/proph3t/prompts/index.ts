// ============================================================================
// SCRUTIX - PROPH3T Optimized Prompt Templates
// Templates de prompts optimises pour modeles locaux avec few-shot examples
// ============================================================================

import { AIDetectionType } from '../../types';

// ----------------------------------------------------------------------------
// Template Interface
// ----------------------------------------------------------------------------

export interface PromptTemplate {
  /** Prompt systeme */
  systemPrompt: string;
  /** Exemples few-shot (3-5 par type) */
  fewShotExamples: Array<{
    input: string;
    output: string;
  }>;
  /** Schema JSON attendu en sortie */
  outputSchema: string;
  /** Nombre max de transactions par batch (plus petit pour modeles locaux) */
  maxInputTransactions: number;
}

// ----------------------------------------------------------------------------
// Categorization Template
// ----------------------------------------------------------------------------

export const CATEGORIZATION_TEMPLATE: PromptTemplate = {
  systemPrompt: `Tu es un expert comptable specialise dans l'audit bancaire CEMAC/UEMOA.
Categorise chaque transaction selon son libelle.
Reponds UNIQUEMENT en JSON valide, sans texte autour.`,

  fewShotExamples: [
    {
      input: '{"id":"1","description":"FRAIS TENUE DE COMPTE T1 2024","amount":-2500}',
      output: '{"transactionId":"1","category":"Frais bancaires","confidence":0.98,"type":"FEE"}',
    },
    {
      input: '{"id":"2","description":"VIR RECU SALAIRE MARS","amount":850000}',
      output: '{"transactionId":"2","category":"Salaires","confidence":0.95,"type":"CREDIT"}',
    },
    {
      input: '{"id":"3","description":"RETRAIT DAB AKWA 15H32","amount":-100000}',
      output: '{"transactionId":"3","category":"Retrait DAB","confidence":0.97,"type":"ATM"}',
    },
    {
      input: '{"id":"4","description":"PRLVT ORANGE CAMEROUN","amount":-25000}',
      output: '{"transactionId":"4","category":"Telecom","confidence":0.92,"type":"DEBIT"}',
    },
    {
      input: '{"id":"5","description":"COM/VIREMENT SWIFT","amount":-15000}',
      output: '{"transactionId":"5","category":"Frais bancaires","confidence":0.96,"type":"FEE"}',
    },
  ],

  outputSchema: `[{"transactionId":"string","category":"string","confidence":number,"type":"DEBIT|CREDIT|FEE|INTEREST|TRANSFER|CARD|ATM|CHECK|OTHER"}]`,

  maxInputTransactions: 30,
};

// ----------------------------------------------------------------------------
// Report Template
// ----------------------------------------------------------------------------

export const REPORT_TEMPLATE: PromptTemplate = {
  systemPrompt: `Tu es un expert-comptable redigeant un rapport d'audit bancaire professionnel.
Utilise un ton formel, precis et actionnable. Redige en francais.
Structure: resume executif, constats cles, analyse detaillee, recommandations, conclusion.
Reponds UNIQUEMENT en JSON valide.`,

  fewShotExamples: [
    {
      input: '{"client":"SARL Exemple","anomalies":5,"amount":150000,"period":"T1 2024"}',
      output: '{"title":"Rapport d\'audit bancaire - SARL Exemple - T1 2024","executiveSummary":"L\'audit des releves bancaires...","keyFindings":["5 anomalies detectees representant 150 000 FCFA"],"detailedAnalysis":"L\'analyse approfondie...","recommendations":["Reclamer le remboursement"],"conclusion":"En conclusion..."}',
    },
  ],

  outputSchema: `{"title":"string","executiveSummary":"string","keyFindings":["string"],"detailedAnalysis":"string","recommendations":["string"],"conclusion":"string"}`,

  maxInputTransactions: 30,
};

// ----------------------------------------------------------------------------
// Fraud Template
// ----------------------------------------------------------------------------

export const FRAUD_TEMPLATE: PromptTemplate = {
  systemPrompt: `Tu es un expert en detection de fraude bancaire pour les entreprises africaines.
Analyse les transactions pour detecter des patterns de fraude potentielle:
1. Fractionnement (structuration)
2. Transactions rondes suspectes
3. Beneficiaires inconnus recurrents
4. Double facturation deguisee
5. Virements circulaires
Reponds UNIQUEMENT en JSON valide.`,

  fewShotExamples: [
    {
      input: '{"transactions":[{"amount":-490000},{"amount":-490000},{"amount":-490000}]}',
      output: '[{"transactionId":"PATTERN","isSuspicious":true,"riskScore":0.85,"reasons":["3 virements de 490 000 FCFA juste sous le seuil de 500 000 - possible structuration"],"recommendation":"Verifier les beneficiaires et la justification economique"}]',
    },
    {
      input: '{"transactions":[{"amount":-50000,"description":"NORMAL"}]}',
      output: '[]',
    },
  ],

  outputSchema: `[{"transactionId":"string","isSuspicious":boolean,"riskScore":number,"reasons":["string"],"recommendation":"string"}]`,

  maxInputTransactions: 30,
};

// ----------------------------------------------------------------------------
// Detection Templates Map
// ----------------------------------------------------------------------------

/**
 * Templates de detection par type
 * Chaque template inclut un prompt systeme optimise et des exemples few-shot
 */
export const DETECTION_TEMPLATES: Record<AIDetectionType, PromptTemplate> = {
  [AIDetectionType.DUPLICATES]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Detecte les transactions en double ou frais factures plusieurs fois.
Criteres: memes montants a dates proches, descriptions similaires, meme beneficiaire.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","date":"2024-01-15","amount":-2500,"description":"FRAIS TDC"},{"id":"2","date":"2024-01-15","amount":-2500,"description":"FRAIS TENUE COMPTE"}]',
        output: '[{"transactionIds":["1","2"],"severity":"HIGH","confidence":0.92,"amount":2500,"description":"Double facturation frais tenue de compte","recommendation":"Reclamer remboursement du doublon","evidence":["Meme montant 2500 FCFA","Meme date 15/01","Libelles similaires"]}]',
      },
      {
        input: '[{"id":"1","date":"2024-01-15","amount":-2500,"description":"FRAIS TDC"},{"id":"2","date":"2024-02-15","amount":-2500,"description":"FRAIS TDC"}]',
        output: '[]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.GHOST_FEES]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Identifie les frais fantomes sans justification.
Criteres: frais sans transaction associee, libelles vagues, montants inhabituels.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-3500,"description":"FRAIS DIVERS"}]',
        output: '[{"transactionIds":["1"],"severity":"MEDIUM","confidence":0.78,"amount":3500,"description":"Frais non identifie - libelle vague FRAIS DIVERS","recommendation":"Demander justificatif detaille a la banque","evidence":["Libelle generique","Pas de reference a un service specifique"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.OVERCHARGES]: {
    systemPrompt: `Tu es un auditeur bancaire expert CEMAC/UEMOA. Detecte les surfacturations par rapport aux conditions bancaires.
Criteres: frais superieurs aux tarifs convenus, commissions excessives, ecarts significatifs.
Raisonne etape par etape (Chain-of-Thought) avant de conclure.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '{"transactions":[{"id":"1","amount":-5000,"description":"FRAIS TDC"}],"conditions":{"TDC":2500}}',
        output: '[{"transactionIds":["1"],"severity":"HIGH","confidence":0.95,"amount":2500,"description":"Surfacturation frais TDC: 5000 facture vs 2500 contractuel","recommendation":"Reclamer la difference de 2500 FCFA","evidence":["Tarif contractuel: 2500 FCFA","Montant facture: 5000 FCFA","Ecart: +100%"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.INTEREST_ERRORS]: {
    systemPrompt: `Tu es un auditeur bancaire expert en calcul d'agios CEMAC/UEMOA. Verifie les calculs d'interets.
Criteres: taux appliques vs contractuels, base de calcul, periodes.
Convention: ACT/360 pour la zone CEMAC. Taux debiteur max BEAC.
Raisonne etape par etape.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '{"transactions":[{"id":"1","amount":-45000,"description":"AGIOS T1 2024"}],"rate":0.18}',
        output: '[{"transactionIds":["1"],"severity":"MEDIUM","confidence":0.72,"amount":45000,"description":"Agios a verifier - montant potentiellement eleve pour la periode","recommendation":"Demander le detail du calcul des agios","evidence":["Montant agios: 45000 FCFA","Taux contractuel: 18%","Verification calcul necessaire"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.VALUE_DATE]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Analyse les ecarts entre dates d'operation et dates de valeur.
Criteres: decalages excessifs defavorables, non-respect delais reglementaires, impact sur agios.
Reglementation CEMAC: J+1 max pour virements recus, J pour remises cheques.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","date":"2024-01-15","valueDate":"2024-01-18","amount":500000,"description":"VIR RECU"}]',
        output: '[{"transactionIds":["1"],"severity":"MEDIUM","confidence":0.88,"amount":500000,"description":"Date de valeur J+3 pour virement recu (norme: J+1)","recommendation":"Reclamer 2 jours de valeur","evidence":["Date operation: 15/01","Date valeur: 18/01","Ecart: 3 jours vs 1 jour reglementaire"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.SUSPICIOUS]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Identifie les transactions suspectes ou inhabituelles.
Criteres: montants anormalement eleves, frequence inhabituelle, patterns atypiques.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-5000000,"description":"VIR SORTANT URGENT","date":"2024-01-15 23:45"}]',
        output: '[{"transactionIds":["1"],"severity":"HIGH","confidence":0.82,"amount":5000000,"description":"Virement sortant de montant eleve a heure tardive","recommendation":"Verifier l\'autorisation et le beneficiaire","evidence":["Montant eleve: 5M FCFA","Heure inhabituelle: 23h45","Libelle: URGENT"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.COMPLIANCE]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Verifie la conformite aux conditions contractuelles.
Criteres: respect des plafonds, application correcte des tarifs, conformite aux engagements.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '{"transactions":[{"id":"1","amount":-10000,"description":"COM MOUVEMENT DEBITEUR"}],"conditions":{"mouvement":0.025}}',
        output: '[{"transactionIds":["1"],"severity":"MEDIUM","confidence":0.75,"amount":10000,"description":"Commission mouvement a verifier vs taux contractuel","recommendation":"Comparer avec le taux contractuel de 0.025%","evidence":["Commission: 10000 FCFA","Taux contractuel: 0.025% du mouvement debiteur"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.CASHFLOW]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Detecte les anomalies de tresorerie.
Criteres: incoherences de soldes, mouvements inhabituels, ecarts de rapprochement.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","balance":500000},{"id":"2","amount":-100000,"balance":350000}]',
        output: '[{"transactionIds":["2"],"severity":"MEDIUM","confidence":0.85,"amount":50000,"description":"Ecart de solde inexplique: solde attendu 400000, solde reel 350000","recommendation":"Verifier les operations manquantes entre ces deux transactions","evidence":["Solde precedent: 500000","Operation: -100000","Solde attendu: 400000","Solde reel: 350000"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.RECONCILIATION]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Identifie les ecarts de rapprochement bancaire.
Criteres: transactions non rapprochees, ecarts persistants, erreurs de saisie potentielles.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-150000,"description":"CHQ 1234567"},{"id":"2","amount":-15000,"description":"CHQ 1234567"}]',
        output: '[{"transactionIds":["1","2"],"severity":"HIGH","confidence":0.88,"amount":135000,"description":"Possible erreur de saisie cheque: 150000 vs 15000","recommendation":"Verifier le montant du cheque 1234567","evidence":["Meme reference cheque","Ecart de facteur 10","Possible erreur virgule"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.MULTI_BANK]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Analyse les incoherences multi-banques.
Criteres: virements inter-bancaires non recus, doublons entre banques, incoherences de dates.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","bankCode":"AFRI","amount":-500000,"description":"VIR VERS SGBC"},{"id":"2","bankCode":"SGBC","amount":480000,"description":"VIR RECU AFRI"}]',
        output: '[{"transactionIds":["1","2"],"severity":"MEDIUM","confidence":0.80,"amount":20000,"description":"Ecart de 20000 FCFA sur virement inter-bancaire","recommendation":"Verifier les frais de virement et reconcilier","evidence":["Virement emis: 500000 (AFRI)","Virement recu: 480000 (SGBC)","Ecart: 20000 FCFA"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.OHADA]: {
    systemPrompt: `Tu es un expert comptable OHADA. Verifie la conformite aux normes OHADA (SYSCOHADA revise).
Criteres: respect des normes comptables, documentation, classement des operations.
References: Acte Uniforme OHADA, Plan comptable SYSCOHADA revise.
Raisonne etape par etape.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-2500000,"description":"ACHAT MATERIEL INFORMATIQUE"}]',
        output: '[{"transactionIds":["1"],"severity":"LOW","confidence":0.70,"amount":2500000,"description":"Achat materiel > seuil immobilisation OHADA - verifier comptabilisation","recommendation":"S\'assurer que l\'achat est immobilise (compte 244x) et non charge","evidence":["Montant: 2 500 000 FCFA","Seuil immobilisation OHADA generalement 250 000 FCFA","Verifier classement comptable"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.AML_LCB_FT]: {
    systemPrompt: `Tu es un expert en conformite LCB-FT (Lutte Contre le Blanchiment et Financement du Terrorisme).
Detecte les indicateurs de blanchiment selon les regles GABAC/GIABA.
Criteres: fractionnement, montants sous seuils, transactions circulaires, beneficiaires a risque.
Seuil de declaration CEMAC: 5 000 000 FCFA.
Raisonne etape par etape.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-4900000},{"id":"2","amount":-4900000},{"id":"3","amount":-4900000}]',
        output: '[{"transactionIds":["1","2","3"],"severity":"CRITICAL","confidence":0.90,"amount":14700000,"description":"Structuration potentielle: 3 virements de 4.9M juste sous le seuil de 5M FCFA","recommendation":"URGENT: Transmettre au responsable conformite pour declaration de soupcon","evidence":["3 virements quasi-identiques","Montant juste sous seuil 5M FCFA","Total: 14.7M FCFA en 3 operations"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },

  [AIDetectionType.FEES]: {
    systemPrompt: `Tu es un auditeur bancaire expert. Analyse complete des frais bancaires.
Criteres: comparaison grilles tarifaires, evolution dans le temps, frais caches.
Categories: tenue de compte, cartes, virements, cheques, international, DAB/GAB.
Reponds UNIQUEMENT en JSON valide.`,
    fewShotExamples: [
      {
        input: '[{"id":"1","amount":-2500,"description":"FRAIS TDC"},{"id":"2","amount":-3500,"description":"FRAIS TDC"}]',
        output: '[{"transactionIds":["1","2"],"severity":"MEDIUM","confidence":0.82,"amount":1000,"description":"Variation frais tenue de compte: 2500 puis 3500 FCFA","recommendation":"Verifier si augmentation justifiee et conforme au contrat","evidence":["Frais TDC precedent: 2500 FCFA","Frais TDC recent: 3500 FCFA","Augmentation: +40%"]}]',
      },
    ],
    outputSchema: `[{"transactionIds":["string"],"severity":"LOW|MEDIUM|HIGH|CRITICAL","confidence":number,"amount":number,"description":"string","recommendation":"string","evidence":["string"]}]`,
    maxInputTransactions: 30,
  },
};

/**
 * Construit un prompt augmente par le RAG avec des references reglementaires
 */
export function buildRAGAugmentedPrompt(
  basePrompt: string,
  ragContext: string,
  sources: Array<{ title: string; source: string }>
): string {
  if (!ragContext || sources.length === 0) {
    return basePrompt;
  }

  const sourceList = sources
    .map((s, i) => `  [Ref.${i + 1}] ${s.title} (${s.source})`)
    .join('\n');

  return `${basePrompt}

[REFERENCES REGLEMENTAIRES]
${ragContext}

Sources disponibles:
${sourceList}

Instruction: Cite les references pertinentes avec [Ref.N] dans ta reponse.`;
}

/**
 * Construit un prompt de detection complet avec few-shot examples
 */
export function buildOptimizedDetectionPrompt(
  type: AIDetectionType,
  transactionData: string,
  conditionsContext: string
): string {
  const template = DETECTION_TEMPLATES[type];

  const examples = template.fewShotExamples
    .map(
      (ex, i) =>
        `Exemple ${i + 1}:\nEntree: ${ex.input}\nSortie: ${ex.output}`
    )
    .join('\n\n');

  return `${template.systemPrompt}

${examples}

Maintenant analyse ces transactions:
${transactionData}

${conditionsContext}

Schema de sortie attendu:
${template.outputSchema}

Si aucune anomalie, retourne: []`;
}
