import { Info, Shield, Brain, Globe, Database, Cpu, BookOpen, Zap } from 'lucide-react';
import { Card, CardBody } from '../ui';

export function AboutSettings() {
  return (
    <div className="space-y-6">
      {/* Main Info Card */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Info className="w-6 h-6 text-primary-600" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <h4 className="font-display text-primary-900 text-2xl">Scrutix</h4>
                <p className="text-sm text-primary-600 mt-2">
                  Scrutix est une application d'audit bancaire pour cabinets d'expertise comptable
                  en Afrique (CEMAC & UEMOA). Elle permet de detecter automatiquement les anomalies
                  dans les releves bancaires grace a des algorithmes avances et l'intelligence artificielle.
                </p>
              </div>

              <div className="pt-4 border-t border-primary-100">
                <h5 className="font-medium text-primary-900 mb-3">Informations systeme</h5>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-primary-500">Version</p>
                    <p className="font-medium text-primary-900">1.1.0</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Zones supportees</p>
                    <p className="font-medium text-primary-900">CEMAC, UEMOA</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Devises</p>
                    <p className="font-medium text-primary-900">XAF, XOF, EUR</p>
                  </div>
                  <div>
                    <p className="text-primary-500">Stockage</p>
                    <p className="font-medium text-primary-900">Local (IndexedDB)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Detection Modules */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Shield className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h5 className="font-medium text-primary-900">18 Modules de Detection</h5>
                <p className="text-xs text-primary-500 mt-1 mb-2">
                  Algorithmes deterministes sans IA
                </p>
                <div className="text-xs text-primary-600 space-y-2">
                  <div>
                    <p className="font-medium text-primary-700">Core (4):</p>
                    <p>Doublons, Frais fantomes, Surfacturation, Agios</p>
                  </div>
                  <div>
                    <p className="font-medium text-primary-700">Etendus (8):</p>
                    <p>Dates valeur, Suspects, Conformite, Tresorerie, Rapprochement, Multi-banques, OHADA, LCB-FT</p>
                  </div>
                  <div>
                    <p className="font-medium text-primary-700">Audit Frais (6):</p>
                    <p>Tenue compte, Cartes, Paiements, International, Services, Packages</p>
                  </div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Multi-AI Support */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Brain className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h5 className="font-medium text-primary-900">Multi-IA</h5>
                <p className="text-xs text-primary-500 mt-1 mb-2">
                  Support de plusieurs providers d'IA
                </p>
                <ul className="text-xs text-primary-600 space-y-1">
                  <li>• Claude (Anthropic) - Sonnet & Opus</li>
                  <li>• OpenAI (GPT-4 Turbo, GPT-4o)</li>
                  <li>• Mistral AI (Large, Medium)</li>
                  <li>• Google Gemini (1.5 Pro, Flash)</li>
                  <li>• Ollama (Llama 3.1, local)</li>
                  <li>• Endpoint personnalise</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Regulatory Sources */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <BookOpen className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h5 className="font-medium text-primary-900">Sources Reglementaires</h5>
                <p className="text-xs text-primary-500 mt-1 mb-2">
                  References officielles CEMAC & UEMOA
                </p>
                <ul className="text-xs text-primary-600 space-y-1">
                  <li>• BEAC - Banque des Etats de l'Afrique Centrale</li>
                  <li>• COBAC - Commission Bancaire</li>
                  <li>• BCEAO - Banque Centrale Afrique de l'Ouest</li>
                  <li>• Commission Bancaire UMOA</li>
                  <li>• Sources personnalisees</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Technical Features */}
        <Card>
          <CardBody>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <Zap className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h5 className="font-medium text-primary-900">Fonctionnalites</h5>
                <p className="text-xs text-primary-500 mt-1 mb-2">
                  Outils d'analyse et de reporting
                </p>
                <ul className="text-xs text-primary-600 space-y-1">
                  <li>• Import CSV, Excel, PDF (OCR)</li>
                  <li>• Mapping automatique des colonnes</li>
                  <li>• Rapports PDF professionnels</li>
                  <li>• Export Excel des anomalies</li>
                  <li>• Chat IA pour analyse contextuelle</li>
                  <li>• Sauvegarde locale et cloud</li>
                </ul>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Technologies */}
      <Card>
        <CardBody>
          <h5 className="font-medium text-primary-900 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Technologies
          </h5>
          <div className="flex flex-wrap gap-2">
            {[
              'React 18',
              'TypeScript 5.5',
              'Tailwind CSS',
              'Zustand',
              'Vite',
              'IndexedDB',
              'jsPDF',
              'SheetJS',
              'Tesseract.js',
              'Recharts',
            ].map((tech) => (
              <span
                key={tech}
                className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium"
              >
                {tech}
              </span>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-primary-100">
            <h5 className="font-medium text-primary-900 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Providers IA Supportes
            </h5>
            <div className="flex flex-wrap gap-2">
              {[
                'Claude AI',
                'OpenAI',
                'Mistral AI',
                'Google Gemini',
                'Ollama (Local)',
                'Custom API',
              ].map((provider) => (
                <span
                  key={provider}
                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-medium"
                >
                  {provider}
                </span>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Footer */}
      <div className="text-center">
        <p className="text-xs text-primary-400">
          Developpe avec les meilleurs standards pour les cabinets d'expertise comptable africains.
        </p>
        <p className="text-xs text-primary-300 mt-1">
          Atlas Studio - 2024-2025
        </p>
      </div>
    </div>
  );
}
