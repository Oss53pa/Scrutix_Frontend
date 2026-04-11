/**
 * @module AtlasBanx
 * @file src/pages/legal/LegalPage.tsx
 * @description Page publique affichant les documents légaux d'AtlasBanx
 *              (CGU, Politique de confidentialité, Mentions légales, Cookies).
 *              Tirés dynamiquement depuis `atlasbanx.policy_versions`.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody, TabNav } from '../../components/ui';
import type { Tab } from '../../components/ui';
import { ConsentService, type PolicyVersion, type PolicyType } from '../../security';

const POLICY_LABELS: Record<PolicyType, string> = {
  cgu: 'CGU',
  privacy: 'Confidentialité',
  legal: 'Mentions légales',
  cookies: 'Cookies',
};

export default function LegalPage() {
  const [policies, setPolicies] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PolicyType>('cgu');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await ConsentService.getCurrentPolicies();
        if (cancelled) return;
        setPolicies(list);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: Tab[] = (Object.keys(POLICY_LABELS) as PolicyType[]).map((key) => ({
    id: key,
    label: POLICY_LABELS[key],
  }));

  const current = policies.find((p) => p.policyType === activeTab);

  return (
    <div className="min-h-screen bg-primary-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-900"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'application
          </Link>
          <h1 className="font-display text-4xl text-primary-900 mt-4">Documents légaux</h1>
          <p className="text-sm text-primary-600 mt-2">
            AtlasBanx — Atlas Studio. Ces documents sont versionnés et horodatés.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Politiques en vigueur
            </CardTitle>
          </CardHeader>
          <CardBody>
            <TabNav
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as PolicyType)}
            />

            <div className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-5 h-5 border-2 border-primary-900 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : current ? (
                <div>
                  <div className="text-xs text-primary-500 mb-4">
                    Version {current.version} — publiée le{' '}
                    {current.publishedAt.toLocaleDateString('fr-FR')}
                  </div>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-primary-800 leading-relaxed">
                    {current.content}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-primary-500">
                  Aucun document disponible pour cette section.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
