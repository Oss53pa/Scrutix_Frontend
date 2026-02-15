import { Code2, GitBranch, Cpu, Calculator, Search, Binary, Sigma, Clock } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from '../ui';

interface AlgorithmCardProps {
  title: string;
  icon: React.ReactNode;
  description: string;
  techniques: { name: string; detail: string }[];
  complexity?: string;
}

function AlgorithmCard({ title, icon, description, techniques, complexity }: AlgorithmCardProps) {
  return (
    <div className="p-4 border border-primary-200 rounded-lg bg-white">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary-100 rounded-lg">{icon}</div>
        <div>
          <h4 className="font-medium text-primary-900">{title}</h4>
          {complexity && (
            <span className="text-xs text-primary-500">Complexite: {complexity}</span>
          )}
        </div>
      </div>
      <p className="text-sm text-primary-600 mb-3">{description}</p>
      <div className="space-y-2">
        {techniques.map((tech, idx) => (
          <div key={idx} className="flex items-start gap-2 text-xs">
            <Code2 className="w-3 h-3 text-primary-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className="font-medium text-primary-800">{tech.name}:</span>{' '}
              <span className="text-primary-600">{tech.detail}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlgorithmsInfo() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary-600" />
            <CardTitle>Algorithmes de Detection</CardTitle>
          </div>
          <CardDescription>
            Techniques algorithmiques utilisees pour l'audit automatique des releves bancaires
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-primary-800">
              Scrutix utilise des algorithmes deterministes bases sur la theorie de l'information,
              la similarite de chaines et les calculs financiers. Ces algorithmes fonctionnent
              <strong> sans intelligence artificielle</strong> et produisent des resultats explicables et auditables.
            </p>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-2xl font-bold text-primary-600">4</p>
              <p className="text-xs text-primary-700">Core</p>
            </div>
            <div className="text-center p-3 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-2xl font-bold text-primary-600">8</p>
              <p className="text-xs text-primary-700">Etendus</p>
            </div>
            <div className="text-center p-3 bg-primary-50 rounded-lg border border-primary-200">
              <p className="text-2xl font-bold text-primary-600">6</p>
              <p className="text-xs text-primary-700">Audit Frais</p>
            </div>
          </div>

          {/* Core Algorithms */}
          <h3 className="text-sm font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Detecteurs Principaux (4)
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <AlgorithmCard
              title="Detection des Doublons"
              icon={<Search className="w-5 h-5 text-primary-600" />}
              description="Identifie les transactions dupliquees ou quasi-identiques dans une fenetre temporelle."
              complexity="O(n²)"
              techniques={[
                { name: 'Jaccard Index', detail: 'Similarite par intersection/union de tokens' },
                { name: 'Levenshtein', detail: 'Distance d\'edition entre descriptions' },
                { name: 'Decroissance exponentielle', detail: 'Poids temporel (plus proche = plus suspect)' },
                { name: 'Score composite', detail: 'Montant (40%) + Description (40%) + Date (20%)' },
              ]}
            />

            <AlgorithmCard
              title="Detection Frais Fantomes"
              icon={<Binary className="w-5 h-5 text-primary-600" />}
              description="Detecte les frais sans transaction de service associee dans une fenetre temporelle."
              complexity="O(n²)"
              techniques={[
                { name: 'Entropie Shannon', detail: 'H = -Sum(p_i × log2(p_i)) pour detecter textes suspects' },
                { name: 'Pattern matching', detail: 'Regex pour classifier frais vs services' },
                { name: 'Score multi-facteurs', detail: '7 criteres ponderes (description, service, montant...)' },
                { name: 'Detection recurrence', detail: 'Meme frais 2+ fois en 3 mois' },
              ]}
            />

            <AlgorithmCard
              title="Detection Surfacturation"
              icon={<Calculator className="w-5 h-5 text-primary-600" />}
              description="Compare les frais factures aux conditions contractuelles et a l'historique."
              complexity="O(n)"
              techniques={[
                { name: 'Comparaison tarifaire', detail: 'Frais vs conditions bancaires officielles' },
                { name: 'Baseline historique', detail: 'Moyenne mobile des frais passes (+20% seuil)' },
                { name: 'Classification service', detail: 'Regex pour type de service (virement, carte, DAB...)' },
                { name: 'Tolerance parametrable', detail: 'Defaut 2% au-dessus du tarif attendu' },
              ]}
            />

            <AlgorithmCard
              title="Verification Agios"
              icon={<Sigma className="w-5 h-5 text-primary-600" />}
              description="Recalcule les interets jour par jour selon la convention ACT/360."
              complexity="O(n×d)"
              techniques={[
                { name: 'ACT/360', detail: 'Convention bancaire standard (annee de 360 jours)' },
                { name: 'Calcul journalier', detail: 'Interet = Solde × (Taux / 360) par jour debiteur' },
                { name: 'Detection periode', detail: 'Identification automatique du mois de reference' },
                { name: 'Tolerance', detail: 'max(1 FCFA, 1% du theorique)' },
              ]}
            />
          </div>

          {/* Utility Functions */}
          <h3 className="text-sm font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <Code2 className="w-4 h-4" />
            Fonctions Utilitaires
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-primary-50 rounded-lg">
              <h5 className="font-medium text-primary-900 text-sm mb-2">Similarite</h5>
              <ul className="text-xs text-primary-600 space-y-1">
                <li>• Levenshtein Distance</li>
                <li>• Jaccard Similarity</li>
                <li>• Amount Similarity (tolerance %)</li>
                <li>• Time Similarity (decay)</li>
                <li>• Transaction Similarity (composite)</li>
              </ul>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <h5 className="font-medium text-primary-900 text-sm mb-2">Entropie</h5>
              <ul className="text-xs text-primary-600 space-y-1">
                <li>• Shannon Entropy (caracteres)</li>
                <li>• Word-Level Entropy</li>
                <li>• Normalized Entropy</li>
                <li>• Randomness Analysis</li>
                <li>• Fee Suspicion Score</li>
              </ul>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg">
              <h5 className="font-medium text-primary-900 text-sm mb-2">Classification</h5>
              <ul className="text-xs text-primary-600 space-y-1">
                <li>• Regex patterns (frais/services)</li>
                <li>• Service type mapping</li>
                <li>• Severity calculation</li>
                <li>• Confidence scoring</li>
                <li>• Evidence generation</li>
              </ul>
            </div>
          </div>

          {/* Thresholds Reference */}
          <h3 className="text-sm font-semibold text-primary-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Seuils par Defaut
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-primary-200">
                  <th className="text-left py-2 px-3 font-medium text-primary-700">Detecteur</th>
                  <th className="text-left py-2 px-3 font-medium text-primary-700">Parametre</th>
                  <th className="text-left py-2 px-3 font-medium text-primary-700">Valeur</th>
                  <th className="text-left py-2 px-3 font-medium text-primary-700">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                <tr>
                  <td className="py-2 px-3 text-primary-900">Doublons</td>
                  <td className="py-2 px-3 text-primary-600">similarityThreshold</td>
                  <td className="py-2 px-3 font-mono text-primary-600">0.85</td>
                  <td className="py-2 px-3 text-primary-500">85% similarite minimum</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Doublons</td>
                  <td className="py-2 px-3 text-primary-600">timeWindowDays</td>
                  <td className="py-2 px-3 font-mono text-primary-600">5</td>
                  <td className="py-2 px-3 text-primary-500">Fenetre de 5 jours</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Doublons</td>
                  <td className="py-2 px-3 text-primary-600">amountTolerance</td>
                  <td className="py-2 px-3 font-mono text-primary-600">0.01</td>
                  <td className="py-2 px-3 text-primary-500">1% tolerance montant</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Frais fantomes</td>
                  <td className="py-2 px-3 text-primary-600">entropyThreshold</td>
                  <td className="py-2 px-3 font-mono text-primary-600">2.5</td>
                  <td className="py-2 px-3 text-primary-500">Entropie minimum</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Frais fantomes</td>
                  <td className="py-2 px-3 text-primary-600">orphanWindowDays</td>
                  <td className="py-2 px-3 font-mono text-primary-600">1</td>
                  <td className="py-2 px-3 text-primary-500">Recherche service ±1 jour</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Frais fantomes</td>
                  <td className="py-2 px-3 text-primary-600">minConfidence</td>
                  <td className="py-2 px-3 font-mono text-primary-600">0.70</td>
                  <td className="py-2 px-3 text-primary-500">70% confiance minimum</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Surfacturation</td>
                  <td className="py-2 px-3 text-primary-600">tolerancePercentage</td>
                  <td className="py-2 px-3 font-mono text-primary-600">0.02</td>
                  <td className="py-2 px-3 text-primary-500">2% au-dessus du tarif</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Agios</td>
                  <td className="py-2 px-3 text-primary-600">toleranceAmount</td>
                  <td className="py-2 px-3 font-mono text-primary-600">1</td>
                  <td className="py-2 px-3 text-primary-500">1 FCFA de tolerance</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-primary-900">Agios</td>
                  <td className="py-2 px-3 text-primary-600">dayCountConvention</td>
                  <td className="py-2 px-3 font-mono text-primary-600">ACT/360</td>
                  <td className="py-2 px-3 text-primary-500">Standard bancaire</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Severity Legend */}
          <div className="mt-6 p-4 bg-primary-50 rounded-lg">
            <h4 className="text-sm font-medium text-primary-900 mb-3">Classification des Severites</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-600"></span>
                <span><strong>CRITICAL:</strong> {'>'}50K FCFA ou fraude</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                <span><strong>HIGH:</strong> {'>'}20K FCFA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                <span><strong>MEDIUM:</strong> {'>'}5K FCFA</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                <span><strong>LOW:</strong> {'<'}5K FCFA</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
