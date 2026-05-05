import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface AttributionRow {
  source: string;
  icon?: React.ReactNode;
  budget: number | null;
  spend: number;
  cv: number;
  roas: number;
  clicks: number;
  impressions: number;
}

interface AttributionTableProps {
  rows: AttributionRow[];
  formatCurrency: (amount: number) => string;
}

const AttributionTable: React.FC<AttributionTableProps> = ({ rows, formatCurrency }) => {
  const totals = rows.reduce(
    (acc, row) => ({
      budget: null,
      spend: acc.spend + row.spend,
      cv: acc.cv + row.cv,
      roas: 0,
      clicks: acc.clicks + row.clicks,
      impressions: acc.impressions + row.impressions,
    }),
    { budget: null as number | null, spend: 0, cv: 0, roas: 0, clicks: 0, impressions: 0 }
  );
  totals.roas = totals.spend > 0 ? totals.cv / totals.spend : 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50/60">
            <TableHead className="text-xs font-medium text-gray-500">Source</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 text-right">Budget</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 text-right">Spend</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 text-right">CV</TableHead>
            <TableHead className="text-xs font-medium text-gray-400 text-right">ROAS (Contexto)</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 text-right">Clicks</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 text-right">Impressions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.source} className="hover:bg-gray-50/40">
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  {row.icon}
                  {row.source}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm">
                {row.budget != null ? formatCurrency(row.budget) : '-'}
              </TableCell>
              <TableCell className="text-right text-sm">{formatCurrency(row.spend)}</TableCell>
              <TableCell className="text-right text-sm">{formatCurrency(row.cv)}</TableCell>
              <TableCell className="text-right text-sm text-gray-400">{row.roas.toFixed(2)}</TableCell>
              <TableCell className="text-right text-sm">{row.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right text-sm">{row.impressions.toLocaleString()}</TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-gray-50/60 font-semibold border-t-2">
            <TableCell>
              <span className="text-sm text-gray-500">Total</span>
            </TableCell>
            <TableCell className="text-right text-sm">-</TableCell>
            <TableCell className="text-right text-sm">{formatCurrency(totals.spend)}</TableCell>
            <TableCell className="text-right text-sm">{formatCurrency(totals.cv)}</TableCell>
            <TableCell className="text-right text-sm text-gray-400">{totals.roas.toFixed(2)}</TableCell>
            <TableCell className="text-right text-sm">{totals.clicks.toLocaleString()}</TableCell>
            <TableCell className="text-right text-sm">{totals.impressions.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default AttributionTable;
