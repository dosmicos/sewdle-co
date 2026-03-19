import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, History } from 'lucide-react';
import { useGenerationHistory } from '@/hooks/useGenerationHistory';

interface GenerationHistoryProps {
  onReuse: (record: any) => void;
}

const GenerationHistory = ({ onReuse }: GenerationHistoryProps) => {
  const [modeFilter, setModeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { generations: records, loading } = useGenerationHistory({
    mode: modeFilter === 'all' ? undefined : modeFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  });

  const modeBadge = (mode: string) => {
    switch (mode) {
      case 'template':
        return { label: 'Template', className: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'free':
        return { label: 'Libre', className: 'bg-green-100 text-green-800 border-green-200' };
      case 'edit':
        return { label: 'Edicion', className: 'bg-orange-100 text-orange-800 border-orange-200' };
      default:
        return { label: mode, className: '' };
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando historial...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Modo</Label>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="template">Template</SelectItem>
              <SelectItem value="free">Libre</SelectItem>
              <SelectItem value="edit">Edicion</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Desde</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="space-y-2">
          <Label>Hasta</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <History className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2 text-black">No hay generaciones registradas</h3>
            <p className="text-gray-600">Las imagenes que generes apareceran aqui.</p>
          </div>
        </Card>
      ) : (
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            {/* Header */}
            <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-medium text-gray-700">
                <div className="col-span-3">Fecha</div>
                <div className="col-span-2">Modo</div>
                <div className="col-span-4">Prompt</div>
                <div className="col-span-1">Resolucion</div>
                <div className="col-span-2">Acciones</div>
              </div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-100">
              {records.map((record) => {
                const badge = modeBadge(record.mode);
                return (
                  <div key={record.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <p className="text-sm text-gray-900">{formatDate(record.created_at)}</p>
                      </div>
                      <div className="col-span-2">
                        <Badge variant="outline" className={badge.className}>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="col-span-4">
                        <p className="text-sm text-gray-600 truncate">
                          {record.prompt && record.prompt.length > 60
                            ? `${record.prompt.substring(0, 60)}...`
                            : record.prompt || '-'}
                        </p>
                      </div>
                      <div className="col-span-1">
                        <Badge variant="secondary" className="text-xs">
                          {record.resolution || '1K'}
                        </Badge>
                      </div>
                      <div className="col-span-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onReuse(record)}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Re-usar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default GenerationHistory;
