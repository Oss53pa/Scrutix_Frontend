/**
 * @module AtlasBanx
 * @file src/import/ConnectorRegistry.ts
 * @description Registre extensible de connecteurs d'import.
 *              Architecture plugin : chaque connecteur implémente
 *              l'interface BankConnector et s'enregistre au boot.
 * @author Atlas Studio
 * @version 1.0.0
 */

import type { BankConnector, ConnectorType } from './types';

const FEATURE_FLAG_API_CONNECTORS = false;

class ConnectorRegistryImpl {
  private connectors = new Map<string, BankConnector>();

  register(connector: BankConnector): void {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): BankConnector | undefined {
    return this.connectors.get(id);
  }

  list(type?: ConnectorType): BankConnector[] {
    const all = Array.from(this.connectors.values());
    if (!type) return all;
    return all.filter((c) => c.type === type);
  }

  listAvailable(type?: ConnectorType): BankConnector[] {
    return this.list(type).filter((c) => c.isAvailable());
  }

  isApiConnectorsEnabled(): boolean {
    return FEATURE_FLAG_API_CONNECTORS;
  }
}

// Singleton
export const ConnectorRegistry = new ConnectorRegistryImpl();

// ============================================================================
// API CONNECTOR STUBS — non activés (feature flag = false)
// ============================================================================

const apiStubs: BankConnector[] = [
  {
    id: 'wave_ci',
    name: 'Wave CI (API)',
    country: ['CI'],
    type: 'api',
    isAvailable: () => FEATURE_FLAG_API_CONNECTORS,
    import: async () => { throw new Error('Wave API non encore disponible'); },
  },
  {
    id: 'mtn_mfs',
    name: 'MTN Mobile Money (API)',
    country: ['CI', 'CM', 'SN'],
    type: 'api',
    isAvailable: () => FEATURE_FLAG_API_CONNECTORS,
    import: async () => { throw new Error('MTN MFS API non encore disponible'); },
  },
  {
    id: 'orange_money',
    name: 'Orange Money (API)',
    country: ['CI', 'SN', 'ML', 'BF'],
    type: 'api',
    isAvailable: () => FEATURE_FLAG_API_CONNECTORS,
    import: async () => { throw new Error('Orange Money API non encore disponible'); },
  },
  {
    id: 'cinetpay',
    name: 'CinetPay Reporting (API)',
    country: ['CI', 'SN', 'CM'],
    type: 'api',
    isAvailable: () => FEATURE_FLAG_API_CONNECTORS,
    import: async () => { throw new Error('CinetPay API non encore disponible'); },
  },
];

// Enregistrement des stubs
for (const stub of apiStubs) {
  ConnectorRegistry.register(stub);
}
