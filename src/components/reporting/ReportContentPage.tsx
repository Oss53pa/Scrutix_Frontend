import { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import type { FullReport, ReportViewerPage, ReportViewerSection } from '../../types';
import { formatCurrency } from '../../utils';
import { ReportTable } from './ReportTable';
import { ReportChart } from './ReportChart';

// Content types for ContentSection
type AlertContent = {
  type: 'alert';
  severity: 'error' | 'warning' | 'success' | 'info';
  title?: string;
  message: string;
};

type ListContent = {
  type: 'list';
  items: string[];
};

type SectionContent = string | AlertContent | ListContent;

interface ReportContentPageProps {
  page: ReportViewerPage;
  report: FullReport;
  pageNumber: number;
  totalPages: number;
}

export function ReportContentPage({
  page,
  report,
  pageNumber,
  totalPages,
}: ReportContentPageProps) {
  // Get currency from report config
  const currency = report.config.currency || 'XAF';

  // Render section based on type
  const renderSection = (section: ReportViewerSection) => {
    if (!section.visible) return null;

    switch (section.type) {
      case 'summary':
        return (
          <SummarySection
            key={section.id}
            title={section.title}
            statistics={report.statistics}
            currency={currency}
          />
        );

      case 'table': {
        const tableData = report.tables.find((t) => t.id === section.content?.tableId);
        if (!tableData) return null;
        return (
          <div key={section.id} className="mb-8">
            {section.title && (
              <h3 className="text-lg font-semibold text-primary-900 mb-4">
                {section.title}
              </h3>
            )}
            <ReportTable data={tableData} currency={currency} />
          </div>
        );
      }

      case 'chart': {
        const chartData = report.charts.find((c) => c.id === section.content?.chartId);
        if (!chartData) return null;
        return (
          <div key={section.id} className="mb-8">
            {section.title && (
              <h3 className="text-lg font-semibold text-primary-900 mb-4">
                {section.title}
              </h3>
            )}
            <ReportChart data={chartData} />
          </div>
        );
      }

      case 'content':
        return (
          <ContentSection
            key={section.id}
            title={section.title}
            content={section.content}
          />
        );

      case 'toc':
        return (
          <TableOfContents
            key={section.id}
            pages={report.pages}
            totalPages={totalPages}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-[297mm] flex flex-col bg-white">
      {/* Header */}
      {page.header?.show && (
        <div className="flex-shrink-0 px-12 py-6 border-b border-primary-200 flex items-center justify-between">
          {page.header.logo && (
            <img src={page.header.logo} alt="" className="h-8 object-contain" />
          )}
          <span className="text-sm text-primary-500">
            {page.header.title || report.config.title}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-12 py-8">
        {page.sections.map(renderSection)}
      </div>

      {/* Footer */}
      {page.footer?.show && (
        <div className="flex-shrink-0 px-12 py-4 border-t border-primary-200 flex items-center justify-between text-sm text-primary-500">
          <span>{page.footer.text || report.config.clientName}</span>
          {page.footer.showPageNumber && (
            <span>
              Page {pageNumber} / {totalPages}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Summary section with statistics
function SummarySection({
  title,
  statistics,
  currency,
}: {
  title?: string;
  statistics: FullReport['statistics'];
  currency: string;
}) {
  return (
    <div className="mb-8">
      {title && (
        <h2 className="text-2xl font-bold text-primary-900 mb-6">{title}</h2>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statistics.map((stat) => (
          <div
            key={stat.id}
            className="p-4 rounded-lg border border-primary-200 bg-primary-50"
          >
            <p className="text-sm text-primary-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-primary-900">
              {typeof stat.value === 'number'
                ? formatCurrency(stat.value, currency)
                : stat.value}
            </p>
            {stat.change !== undefined && (
              <div
                className={`flex items-center gap-1 text-sm mt-1 ${
                  stat.changeType === 'increase'
                    ? 'text-green-600'
                    : stat.changeType === 'decrease'
                    ? 'text-red-600'
                    : 'text-primary-500'
                }`}
              >
                {stat.changeType === 'increase' ? (
                  <TrendingUp className="w-4 h-4" />
                ) : stat.changeType === 'decrease' ? (
                  <TrendingDown className="w-4 h-4" />
                ) : null}
                <span>{stat.change > 0 ? '+' : ''}{stat.change}%</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Generic content section
function ContentSection({
  title,
  content,
}: {
  title?: string;
  content: SectionContent;
}) {
  if (!content) return null;

  return (
    <div className="mb-8">
      {title && (
        <h2 className="text-xl font-bold text-primary-900 mb-4">{title}</h2>
      )}

      {/* Handle different content types */}
      {typeof content === 'string' && (
        <div className="prose prose-primary max-w-none">
          <p className="text-primary-700 leading-relaxed whitespace-pre-wrap">
            {content}
          </p>
        </div>
      )}

      {typeof content === 'object' && content.type === 'alert' && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            content.severity === 'error'
              ? 'bg-red-50 text-red-800'
              : content.severity === 'warning'
              ? 'bg-amber-50 text-amber-800'
              : content.severity === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-blue-50 text-blue-800'
          }`}
        >
          {content.severity === 'error' ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          ) : content.severity === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 flex-shrink-0" />
          )}
          <div>
            {content.title && (
              <p className="font-semibold mb-1">{content.title}</p>
            )}
            <p>{content.message}</p>
          </div>
        </div>
      )}

      {typeof content === 'object' && content.type === 'list' && (
        <ul className="space-y-2">
          {content.items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-primary-700">
              <span className="w-2 h-2 rounded-full bg-primary-400 mt-2 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Table of contents
function TableOfContents({
  pages,
  totalPages,
}: {
  pages: ReportViewerPage[];
  totalPages: number;
}) {
  const tocItems = useMemo(() => {
    const items = [
      { title: 'Page de garde', page: 1 },
    ];

    pages.forEach((page, index) => {
      const firstSection = page.sections.find((s) => s.title);
      if (firstSection?.title) {
        items.push({
          title: firstSection.title,
          page: index + 2,
        });
      }
    });

    items.push({ title: 'Couverture arrière', page: totalPages });

    return items;
  }, [pages, totalPages]);

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-primary-900 mb-6">
        Table des matières
      </h2>

      <div className="space-y-3">
        {tocItems.map((item, index) => (
          <div
            key={index}
            className="flex items-end gap-2 text-primary-700"
          >
            <span className="font-medium">{item.title}</span>
            <span className="flex-1 border-b border-dotted border-primary-300 mb-1" />
            <span className="text-primary-500">{item.page}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
