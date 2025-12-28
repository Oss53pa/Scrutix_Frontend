import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice, InvoiceLine, PaymentRecord, BillingConfig } from '../types';

interface BillingState {
  invoices: Invoice[];
  payments: PaymentRecord[];
  billingConfigs: BillingConfig[];

  // Invoice CRUD
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getInvoice: (id: string) => Invoice | undefined;
  getInvoicesByClient: (clientId: string) => Invoice[];
  getInvoicesByStatus: (status: Invoice['status']) => Invoice[];

  // Payment CRUD
  addPayment: (payment: Omit<PaymentRecord, 'id'>) => PaymentRecord;
  getPaymentsByInvoice: (invoiceId: string) => PaymentRecord[];

  // Billing config
  setBillingConfig: (clientId: string, config: Omit<BillingConfig, 'clientId'>) => void;
  getBillingConfig: (clientId: string) => BillingConfig | undefined;

  // Stats
  getMonthlyStats: (year: number, month: number) => {
    facturesEmises: number;
    encaisse: number;
    enAttente: number;
    successFees: number;
  };

  // Generate invoice number
  generateInvoiceNumber: () => string;
}

export const useBillingStore = create<BillingState>()(
  persist(
    (set, get) => ({
      invoices: [],
      payments: [],
      billingConfigs: [],

      addInvoice: (invoiceData) => {
        const now = new Date();
        const invoice: Invoice = {
          id: uuidv4(),
          ...invoiceData,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          invoices: [...state.invoices, invoice],
        }));
        return invoice;
      },

      updateInvoice: (id, updates) => {
        set((state) => ({
          invoices: state.invoices.map((inv) =>
            inv.id === id ? { ...inv, ...updates, updatedAt: new Date() } : inv
          ),
        }));
      },

      deleteInvoice: (id) => {
        set((state) => ({
          invoices: state.invoices.filter((inv) => inv.id !== id),
          payments: state.payments.filter((p) => p.invoiceId !== id),
        }));
      },

      getInvoice: (id) => {
        return get().invoices.find((inv) => inv.id === id);
      },

      getInvoicesByClient: (clientId) => {
        return get().invoices.filter((inv) => inv.clientId === clientId);
      },

      getInvoicesByStatus: (status) => {
        return get().invoices.filter((inv) => inv.status === status);
      },

      addPayment: (paymentData) => {
        const payment: PaymentRecord = {
          id: uuidv4(),
          ...paymentData,
        };
        set((state) => ({
          payments: [...state.payments, payment],
        }));

        // Update invoice status if fully paid
        const invoice = get().getInvoice(paymentData.invoiceId);
        if (invoice) {
          const totalPaid = get()
            .getPaymentsByInvoice(paymentData.invoiceId)
            .reduce((sum, p) => sum + p.montant, 0) + paymentData.montant;

          if (totalPaid >= invoice.total) {
            get().updateInvoice(paymentData.invoiceId, {
              status: 'paid',
              datePaiement: paymentData.datePaiement,
            });
          }
        }

        return payment;
      },

      getPaymentsByInvoice: (invoiceId) => {
        return get().payments.filter((p) => p.invoiceId === invoiceId);
      },

      setBillingConfig: (clientId, config) => {
        set((state) => {
          const existing = state.billingConfigs.findIndex((c) => c.clientId === clientId);
          if (existing >= 0) {
            const newConfigs = [...state.billingConfigs];
            newConfigs[existing] = { ...config, clientId };
            return { billingConfigs: newConfigs };
          }
          return {
            billingConfigs: [...state.billingConfigs, { ...config, clientId }],
          };
        });
      },

      getBillingConfig: (clientId) => {
        return get().billingConfigs.find((c) => c.clientId === clientId);
      },

      getMonthlyStats: (year, month) => {
        const { invoices, payments } = get();

        const monthInvoices = invoices.filter((inv) => {
          const date = new Date(inv.dateEmission);
          return date.getFullYear() === year && date.getMonth() === month;
        });

        const facturesEmises = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

        const encaisse = payments
          .filter((p) => {
            const date = new Date(p.datePaiement);
            return date.getFullYear() === year && date.getMonth() === month;
          })
          .reduce((sum, p) => sum + p.montant, 0);

        const enAttente = monthInvoices
          .filter((inv) => inv.status === 'sent' || inv.status === 'overdue')
          .reduce((sum, inv) => sum + inv.total, 0);

        const successFees = monthInvoices.reduce((sum, inv) => {
          const commissions = inv.lignes
            .filter((l) => l.type === 'commission')
            .reduce((s, l) => s + l.montant, 0);
          return sum + commissions;
        }, 0);

        return { facturesEmises, encaisse, enAttente, successFees };
      },

      generateInvoiceNumber: () => {
        const year = new Date().getFullYear();
        const invoices = get().invoices.filter((inv) =>
          inv.numero.startsWith(`${year}-`)
        );
        const nextNum = invoices.length + 1;
        return `${year}-${String(nextNum).padStart(4, '0')}`;
      },
    }),
    {
      name: 'auditech-billing',
      partialize: (state) => ({
        invoices: state.invoices,
        payments: state.payments,
        billingConfigs: state.billingConfigs,
      }),
    }
  )
);
