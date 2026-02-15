import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Globe,
  FileText,
  Percent,
  Clock,
  AlertTriangle,
  ExternalLink,
  Building2,
  Scale,
} from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardBody, Badge } from '../ui';
import { useRegulatoryStore } from '../../store/regulatoryStore';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export function RegulatoryDataPanel() {
  const {
    rates,
    documents,
    lastUpdated,
    isLoading,
    error,
    fetchData,
    getRatesByZone,
    getUsuryRate,
  } = useRegulatoryStore();

  const [activeZone, setActiveZone] = useState<'CEMAC' | 'UEMOA'>('CEMAC');

  useEffect(() => {
    // Charger les données au montage si pas encore chargées
    if (rates.length === 0) {
      fetchData();
    }
  }, []);

  const handleRefresh = () => {
    fetchData(true);
  };

  const zoneRates = getRatesByZone(activeZone);
  const usuryRate = getUsuryRate(activeZone);

  const zoneDocuments = documents.filter(d => {
    const sources = activeZone === 'CEMAC' ? ['BEAC', 'COBAC'] : ['BCEAO', 'CB_UMOA'];
    return sources.includes(d.source);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-primary-900">
            Données Réglementaires
          </h2>
          <p className="text-sm text-primary-500">
            Taux et règlements BEAC/COBAC/BCEAO en temps réel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-primary-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Mis à jour {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: fr })}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg text-primary-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Zone Selector */}
      <div className="flex gap-2">
        {(['CEMAC', 'UEMOA'] as const).map((zone) => (
          <button
            key={zone}
            onClick={() => setActiveZone(zone)}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              activeZone === zone
                ? 'border-primary-600 bg-primary-50'
                : 'border-primary-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <Globe className="w-5 h-5 text-primary-600" />
              <span className="font-semibold text-primary-900">{zone}</span>
            </div>
            <p className="text-xs text-primary-500">
              {zone === 'CEMAC'
                ? 'Cameroun, Gabon, Congo, Tchad, RCA, GE'
                : 'Côte d\'Ivoire, Sénégal, Mali, Burkina, Bénin...'}
            </p>
          </button>
        ))}
      </div>

      {/* Taux d'Usure */}
      <Card className="border-2 border-primary-300 bg-primary-50">
        <CardBody className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-primary-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-800">
                  Taux d'Usure (plafond légal)
                </p>
                <p className="text-xs text-primary-600">
                  Tout taux supérieur est illégal et sanctionnable
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-700">{usuryRate}%</p>
              <p className="text-xs text-primary-600">annuel maximum</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Taux Directeurs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="w-5 h-5 text-primary-600" />
            Taux Directeurs {activeZone === 'CEMAC' ? 'BEAC' : 'BCEAO'}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {zoneRates.length === 0 ? (
            <p className="text-sm text-primary-500 text-center py-4">
              Aucun taux chargé. Cliquez sur "Actualiser".
            </p>
          ) : (
            <div className="space-y-3">
              {zoneRates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between p-3 bg-primary-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-primary-900">
                      {rate.name}
                    </p>
                    <p className="text-xs text-primary-500">
                      En vigueur depuis le{' '}
                      {new Date(rate.effectiveDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-900">
                      {rate.value}{rate.unit}
                    </p>
                    <Badge variant="secondary" className="text-xs">
                      {rate.source}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Règlements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-primary-600" />
            Règlements Applicables
          </CardTitle>
        </CardHeader>
        <CardBody>
          {zoneDocuments.length === 0 ? (
            <p className="text-sm text-primary-500 text-center py-4">
              Aucun règlement chargé.
            </p>
          ) : (
            <div className="space-y-3">
              {zoneDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 border border-primary-200 rounded-lg hover:bg-primary-50 transition"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary-500" />
                      <Badge variant="secondary" className="text-xs">
                        {doc.source}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {doc.reference}
                      </Badge>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <p className="text-sm font-medium text-primary-900 mb-1">
                    {doc.title}
                  </p>
                  <p className="text-xs text-primary-600">{doc.summary}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {doc.keywords.slice(0, 4).map((keyword, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 bg-primary-100 text-primary-600 rounded"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary-600" />
            Sources Officielles
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            {activeZone === 'CEMAC' ? (
              <>
                <a
                  href="https://www.beac.int"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                >
                  <Globe className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-primary-900">BEAC</p>
                    <p className="text-xs text-primary-500">Banque Centrale CEMAC</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-primary-400 ml-auto" />
                </a>
                <a
                  href="https://www.sgcobac.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                >
                  <Globe className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-primary-900">COBAC</p>
                    <p className="text-xs text-primary-500">Commission Bancaire</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-primary-400 ml-auto" />
                </a>
              </>
            ) : (
              <>
                <a
                  href="https://www.bceao.int"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                >
                  <Globe className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-primary-900">BCEAO</p>
                    <p className="text-xs text-primary-500">Banque Centrale UEMOA</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-primary-400 ml-auto" />
                </a>
                <a
                  href="https://www.cb.uemoa.int"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 border border-primary-200 rounded-lg hover:bg-primary-50"
                >
                  <Globe className="w-4 h-4 text-primary-500" />
                  <div>
                    <p className="text-sm font-medium text-primary-900">CB-UMOA</p>
                    <p className="text-xs text-primary-500">Commission Bancaire</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-primary-400 ml-auto" />
                </a>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
