import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFilteredOrders } from '@/hooks/useFilteredOrders';
import { useUserContext } from '@/hooks/useUserContext';
import { useWorkshops } from '@/hooks/useWorkshops';
import { useOrderActions } from '@/hooks/useOrderActions';
import { usePermissions } from '@/hooks/usePermissions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Download, ListChecks, Package, TrendingUp } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import OrderEditModal from '@/components/OrderEditModal';
import OrderCard from '@/components/OrderCard';
import OrderFilters from '@/components/OrderFilters';
import OrdersEmptyState from '@/components/OrdersEmptyState';

const OrdersPage = () => {
  const navigate = useNavigate();
  const { orders, loading, refetch } = useFilteredOrders();
  const { isAdmin } = useUserContext();
  const { hasPermission } = usePermissions();
  const { workshops } = useWorkshops();
  const { deleteOrder } = useOrderActions();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'summary'>('orders');
  const [summaryDueFilter, setSummaryDueFilter] = useState<'all' | 'overdue' | 'today' | 'next3' | 'next7' | 'no_due'>('all');
  
  // Query params for filters
  const [searchParams, setSearchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';
  const selectedWorkshop = searchParams.get('workshop') || 'all';
  const selectedStatus = searchParams.get('status') || 'all';

  const updateFilters = (updates: { search?: string; workshop?: string; status?: string }) => {
    const newParams = new URLSearchParams(searchParams);
    
    if (updates.search !== undefined) {
      if (updates.search) {
        newParams.set('search', updates.search);
      } else {
        newParams.delete('search');
      }
    }
    
    if (updates.workshop !== undefined) {
      if (updates.workshop && updates.workshop !== 'all') {
        newParams.set('workshop', updates.workshop);
      } else {
        newParams.delete('workshop');
      }
    }
    
    if (updates.status !== undefined) {
      if (updates.status && updates.status !== 'all') {
        newParams.set('status', updates.status);
      } else {
        newParams.delete('status');
      }
    }
    
    setSearchParams(newParams);
  };

  // Permission checks
  const canCreateOrders = hasPermission('orders', 'create');
  const canEditOrders = hasPermission('orders', 'edit');
  const canDeleteOrders = hasPermission('orders', 'delete');

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'assigned':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'assigned':
        return 'Asignada';
      case 'in_progress':
        return 'En Progreso';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getWorkshopName = (order: any) => {
    return order.workshop_assignments?.[0]?.workshops?.name || 'Sin asignar';
  };

  const getWorkshopColor = (order: any) => {
    return order.workshop_assignments?.[0]?.workshops?.name ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200';
  };

  // Event handlers
  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  const handleViewDetails = (order: any) => {
    navigate(`/orders/${order.id}`, {
      state: { from: 'orders' }
    });
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    setSelectedOrder(null);
    refetch();
  };

  const handleDeleteOrder = (order: any) => {
    setOrderToDelete(order);
    setShowDeleteDialog(true);
  };

  const confirmDeleteOrder = async () => {
    if (orderToDelete) {
      const success = await deleteOrder(orderToDelete.id);
      if (success) {
        refetch();
      }
      setShowDeleteDialog(false);
      setOrderToDelete(null);
    }
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (selectedWorkshop !== 'all') count++;
    if (selectedStatus !== 'all') count++;
    return count;
  };

  // Filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.order_items?.some((item: any) => 
        item.product_variants?.sku_variant?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      order.order_items?.some((item: any) => 
        item.product_variants?.products?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      order.order_items?.some((item: any) => 
        item.product_variants?.variant_title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesWorkshop = selectedWorkshop === 'all' || 
                           (selectedWorkshop === 'unassigned' && !order.workshop_assignments?.length) ||
                           order.workshop_assignments?.some((assignment: any) => assignment.workshop_id === selectedWorkshop);
    const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
    return matchesSearch && matchesWorkshop && matchesStatus;
  });

  const pendingSummary = useMemo(() => {
    const variantsMap = new Map<string, {
      variantKey: string;
      productName: string;
      variantName: string;
      sku: string;
      totalPending: number;
      ordersMap: Map<string, {
        orderId: string;
        orderNumber: string;
        dueDate: string | null;
        pendingUnits: number;
      }>;
    }>();

    const pendingOrderIds = new Set<string>();
    let totalPendingUnits = 0;

    filteredOrders.forEach((order: any) => {
      const orderItems = order.order_items || [];

      orderItems.forEach((item: any) => {
        const orderedUnits = Number(item.quantity || 0);
        const approvedUnits = (item.delivery_items || []).reduce(
          (sum: number, deliveryItem: any) => sum + Number(deliveryItem.quantity_approved || 0),
          0
        );
        const pendingUnits = Math.max(orderedUnits - approvedUnits, 0);

        if (pendingUnits <= 0) {
          return;
        }

        totalPendingUnits += pendingUnits;
        pendingOrderIds.add(order.id);

        const variantData = item.product_variants || {};
        const productName = variantData?.products?.name || 'Producto';
        const variantName = variantData?.variant_title || variantData?.size || 'Sin variante';
        const sku = variantData?.sku_variant || 'Sin SKU';
        const variantKey = item.product_variant_id || variantData?.id || item.id;

        if (!variantsMap.has(variantKey)) {
          variantsMap.set(variantKey, {
            variantKey,
            productName,
            variantName,
            sku,
            totalPending: 0,
            ordersMap: new Map(),
          });
        }

        const variantSummary = variantsMap.get(variantKey)!;
        variantSummary.totalPending += pendingUnits;

        const existingOrder = variantSummary.ordersMap.get(order.id);
        if (existingOrder) {
          existingOrder.pendingUnits += pendingUnits;
        } else {
          variantSummary.ordersMap.set(order.id, {
            orderId: order.id,
            orderNumber: order.order_number,
            dueDate: order.due_date || null,
            pendingUnits,
          });
        }
      });
    });

    const rows = Array.from(variantsMap.values())
      .map((variant) => ({
        ...variant,
        orders: Array.from(variant.ordersMap.values()).sort((a, b) => b.pendingUnits - a.pendingUnits),
      }))
      .sort((a, b) => b.totalPending - a.totalPending || a.productName.localeCompare(b.productName, 'es-CO'));

    return {
      totalPendingUnits,
      totalVariants: rows.length,
      totalOrders: pendingOrderIds.size,
      rows,
    };
  }, [filteredOrders]);

  const formatUnits = (value: number) => value.toLocaleString('es-CO');

  const parseDateAtStartOfDay = (dateValue: string) => {
    const raw = dateValue.split('T')[0];
    const [year, month, day] = raw.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const startOfToday = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  const getDueCategory = (dueDate: string | null) => {
    if (!dueDate) return 'no_due';
    const due = parseDateAtStartOfDay(dueDate);
    const diffMs = due.getTime() - startOfToday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 3) return 'next3';
    if (diffDays <= 7) return 'next7';
    return 'future';
  };

  const matchesDueFilter = (dueDate: string | null) => {
    const dueCategory = getDueCategory(dueDate);
    switch (summaryDueFilter) {
      case 'all':
        return true;
      case 'overdue':
        return dueCategory === 'overdue';
      case 'today':
        return dueCategory === 'today';
      case 'next3':
        return dueCategory === 'today' || dueCategory === 'next3';
      case 'next7':
        return dueCategory === 'today' || dueCategory === 'next3' || dueCategory === 'next7';
      case 'no_due':
        return dueCategory === 'no_due';
      default:
        return true;
    }
  };

  const filteredPendingSummary = useMemo(() => {
    const filteredRows = pendingSummary.rows
      .map((row) => {
        const filteredOrdersForRow = row.orders.filter((relatedOrder) => matchesDueFilter(relatedOrder.dueDate));
        const filteredPending = filteredOrdersForRow.reduce((sum, relatedOrder) => sum + relatedOrder.pendingUnits, 0);

        return {
          ...row,
          orders: filteredOrdersForRow,
          filteredPending,
        };
      })
      .filter((row) => row.filteredPending > 0)
      .sort((a, b) => b.filteredPending - a.filteredPending || a.productName.localeCompare(b.productName, 'es-CO'));

    const totalPendingUnits = filteredRows.reduce((sum, row) => sum + row.filteredPending, 0);
    const orderIds = new Set<string>();
    filteredRows.forEach((row) => row.orders.forEach((relatedOrder) => orderIds.add(relatedOrder.orderId)));

    return {
      totalPendingUnits,
      totalVariants: filteredRows.length,
      totalOrders: orderIds.size,
      rows: filteredRows,
    };
  }, [pendingSummary.rows, summaryDueFilter, startOfToday]);

  const buildCsvValue = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

  const handleExportSummaryCsv = () => {
    if (filteredPendingSummary.rows.length === 0) {
      return;
    }

    const header = [
      'producto',
      'variante',
      'sku',
      'orden',
      'fecha_entrega',
      'urgencia',
      'unidades_pendientes_orden',
      'unidades_pendientes_variante_filtrada',
    ];

    const lines: string[] = [header.map(buildCsvValue).join(',')];

    filteredPendingSummary.rows.forEach((row) => {
      row.orders.forEach((relatedOrder) => {
        lines.push(
          [
            row.productName,
            row.variantName,
            row.sku,
            relatedOrder.orderNumber,
            relatedOrder.dueDate || '',
            getDueCategory(relatedOrder.dueDate),
            relatedOrder.pendingUnits,
            row.filteredPending,
          ]
            .map(buildCsvValue)
            .join(',')
        );
      });
    });

    const csv = `\uFEFF${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `resumen-pendientes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header con título y breadcrumbs */}
      <div className="space-y-2">
        <div className="flex items-center text-sm text-gray-500">
          <span>Producción</span>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Órdenes</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Gestión de Órdenes de Producción</h1>
            <p className="text-gray-600 text-sm md:text-base">Administra y monitorea todas las órdenes de producción</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4" />
            <span>{filteredOrders.length} órdenes</span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <OrderFilters
        searchTerm={searchTerm}
        setSearchTerm={(value) => updateFilters({ search: value })}
        selectedWorkshop={selectedWorkshop}
        setSelectedWorkshop={(value) => updateFilters({ workshop: value })}
        selectedStatus={selectedStatus}
        setSelectedStatus={(value) => updateFilters({ status: value })}
        workshops={workshops}
        showFiltersSheet={showFiltersSheet}
        setShowFiltersSheet={setShowFiltersSheet}
        onRefetch={refetch}
        onClearFilters={clearFilters}
        getActiveFiltersCount={getActiveFiltersCount}
        canCreateOrders={canCreateOrders}
        onCreateOrder={() => setShowCreateForm(true)}
      />

      {showCreateForm && canCreateOrders && (
        <OrderForm onClose={handleFormClose} />
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'orders' | 'summary')} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="orders" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Órdenes
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Resumen
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 mt-0">
          {filteredOrders.length === 0 ? (
            <OrdersEmptyState
              searchTerm={searchTerm}
              selectedWorkshop={selectedWorkshop}
              selectedStatus={selectedStatus}
              isAdmin={isAdmin}
            />
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onView={handleViewDetails}
                onEdit={handleEditOrder}
                onDelete={handleDeleteOrder}
                getStatusColor={getStatusColor}
                getStatusText={getStatusText}
                getWorkshopName={getWorkshopName}
                getWorkshopColor={getWorkshopColor}
                canEdit={canEditOrders}
                canDelete={canDeleteOrders}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="summary" className="space-y-4 mt-0">
          <Card className="bg-white border-0 shadow-sm rounded-2xl">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                  <div className="text-sm text-gray-600">Filtrar por fecha de entrega</div>
                  <Select
                    value={summaryDueFilter}
                    onValueChange={(value: 'all' | 'overdue' | 'today' | 'next3' | 'next7' | 'no_due') => setSummaryDueFilter(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[240px]">
                      <SelectValue placeholder="Todas las fechas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las fechas</SelectItem>
                      <SelectItem value="overdue">Vencidas</SelectItem>
                      <SelectItem value="today">Vencen hoy</SelectItem>
                      <SelectItem value="next3">Próximos 3 días</SelectItem>
                      <SelectItem value="next7">Próximos 7 días</SelectItem>
                      <SelectItem value="no_due">Sin fecha de entrega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportSummaryCsv}
                  disabled={filteredPendingSummary.rows.length === 0}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm">
                  <Package className="w-4 h-4" />
                  <span>Unidades pendientes</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{formatUnits(filteredPendingSummary.totalPendingUnits)}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm">
                  <ListChecks className="w-4 h-4" />
                  <span>Variantes pendientes</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{formatUnits(filteredPendingSummary.totalVariants)}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm">
                  <ClipboardList className="w-4 h-4" />
                  <span>Órdenes con pendiente</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">{formatUnits(filteredPendingSummary.totalOrders)}</p>
              </CardContent>
            </Card>
          </div>

          {filteredPendingSummary.rows.length === 0 ? (
            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardContent className="p-8 text-center">
                <p className="text-lg font-medium text-gray-900">No hay unidades pendientes para producir</p>
                <p className="text-sm text-gray-500 mt-1">
                  El resumen usa los filtros actuales y muestra solo variantes con pendiente &gt; 0.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white border-0 shadow-sm rounded-2xl">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[920px] text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50/70">
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Producto</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Variante</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">SKU</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-700">Pendiente</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-700">Órdenes relacionadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPendingSummary.rows.map((row) => (
                        <tr key={row.variantKey} className="border-b last:border-b-0 hover:bg-gray-50/70">
                          <td className="px-4 py-3 font-medium text-gray-900">{row.productName}</td>
                          <td className="px-4 py-3 text-gray-700">{row.variantName}</td>
                          <td className="px-4 py-3 text-gray-600">{row.sku}</td>
                          <td className="px-4 py-3 text-right font-semibold text-orange-700">
                            {formatUnits(row.filteredPending)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {row.orders.map((relatedOrder) => (
                                <button
                                  key={relatedOrder.orderId}
                                  type="button"
                                  onClick={() =>
                                    navigate(`/orders/${relatedOrder.orderId}`, {
                                      state: { from: 'orders' },
                                    })
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                >
                                  <span>#{relatedOrder.orderNumber}</span>
                                  <span>•</span>
                                  <span>{formatUnits(relatedOrder.pendingUnits)} u</span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modales */}
      {selectedOrder && showEditModal && (
        <OrderEditModal
          order={selectedOrder}
          open={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}


      {/* AlertDialog para confirmación de eliminación */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar la orden "{orderToDelete?.order_number}"? 
              Esta acción no se puede deshacer y eliminará todos los datos asociados incluyendo entregas, items y asignaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteOrder} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrdersPage;
