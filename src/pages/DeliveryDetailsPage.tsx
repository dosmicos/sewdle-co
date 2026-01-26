import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useDeliveries } from '@/hooks/useDeliveries';
import { useFilteredDeliveries } from '@/hooks/useFilteredDeliveries';
import DeliveryDetails from '@/components/DeliveryDetails';
import { usePermissions } from '@/hooks/usePermissions';

const DeliveryDetailsPage = () => {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { fetchDeliveryByTrackingNumber } = useDeliveries();
  const { deliveries: allDeliveries } = useFilteredDeliveries();
  const { hasPermission } = usePermissions();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check permissions - same as in DeliveriesPage
  const canViewDeliveries = hasPermission('deliveries', 'view');

  // Read filters from URL
  const searchTerm = searchParams.get('search') || '';
  const statusFilter = searchParams.get('status') || 'all';
  const workshopFilter = searchParams.get('workshop') || 'all';
  const tabFilter = searchParams.get('tab') || 'all';

  // Apply same filters as DeliveriesPage for navigation
  const filteredDeliveriesForNav = useMemo(() => {
    let filtered = allDeliveries;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(d => {
        const orderNumber = d.order_number ?? d.order?.order_number;
        const workshopName = d.workshop_name ?? d.workshop?.name;
        return (
          d.tracking_number?.toLowerCase().includes(term) ||
          orderNumber?.toLowerCase().includes(term) ||
          workshopName?.toLowerCase().includes(term)
        );
      });
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }
    
    if (workshopFilter !== 'all') {
      filtered = filtered.filter(d => {
        const workshopName = d.workshop_name ?? d.workshop?.name;
        return workshopName === workshopFilter;
      });
    }
    
    // Tab-based filtering
    if (tabFilter !== 'all' && tabFilter !== 'sync') {
      filtered = filtered.filter(d => {
        switch (tabFilter) {
          case 'pending': return d.status === 'pending';
          case 'in_quality': return d.status === 'in_quality';
          case 'approved': return d.status === 'approved' || d.status === 'partial_approved';
          case 'rejected': return d.status === 'rejected';
          default: return true;
        }
      });
    }
    
    return filtered;
  }, [allDeliveries, searchTerm, statusFilter, workshopFilter, tabFilter]);

  // Calculate navigation using filtered list
  const navigation = useMemo(() => {
    if (!deliveryId || filteredDeliveriesForNav.length === 0) {
      return { currentIndex: -1, hasPrevious: false, hasNext: false };
    }
    const currentIndex = filteredDeliveriesForNav.findIndex(d => d.tracking_number === deliveryId);
    return {
      currentIndex,
      hasPrevious: currentIndex > 0,
      hasNext: currentIndex >= 0 && currentIndex < filteredDeliveriesForNav.length - 1
    };
  }, [deliveryId, filteredDeliveriesForNav]);

  const goToPrevious = () => {
    if (navigation.hasPrevious) {
      const prevDelivery = filteredDeliveriesForNav[navigation.currentIndex - 1];
      const queryString = searchParams.toString();
      navigate(`/deliveries/${prevDelivery.tracking_number}${queryString ? `?${queryString}` : ''}`);
    }
  };

  const goToNext = () => {
    if (navigation.hasNext) {
      const nextDelivery = filteredDeliveriesForNav[navigation.currentIndex + 1];
      const queryString = searchParams.toString();
      navigate(`/deliveries/${nextDelivery.tracking_number}${queryString ? `?${queryString}` : ''}`);
    }
  };

  useEffect(() => {
    if (!deliveryId || !canViewDeliveries) {
      navigate('/deliveries');
      return;
    }

    // Prevent refetch if same delivery is already loaded
    if (delivery && delivery.tracking_number === deliveryId) {
      return;
    }

    let isCancelled = false;

    const loadDelivery = async () => {
      try {
        setLoading(true);
        setError(null);
        const deliveryData = await fetchDeliveryByTrackingNumber(deliveryId);
        
        if (isCancelled) return;
        
        if (!deliveryData) {
          setError('Entrega no encontrada');
          return;
        }
        setDelivery(deliveryData);
      } catch (err) {
        if (isCancelled) return;
        console.error('Error loading delivery:', err);
        setError('Error al cargar la entrega');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadDelivery();

    return () => {
      isCancelled = true;
    };
  }, [deliveryId, fetchDeliveryByTrackingNumber, canViewDeliveries, navigate, delivery?.tracking_number]);

  const handleBack = (shouldRefresh?: boolean) => {
    navigate('/deliveries');
  };

  if (!canViewDeliveries) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">
            {error || 'Entrega no encontrada'}
          </h1>
          <button 
            onClick={() => navigate('/deliveries')}
            className="text-primary hover:underline"
          >
            Volver a Entregas
          </button>
        </div>
      </div>
    );
  }

  return (
    <DeliveryDetails 
      delivery={delivery} 
      onBack={handleBack}
      onDeliveryUpdated={() => {
        // Optionally reload delivery data if needed
      }}
      onPrevious={navigation.hasPrevious ? goToPrevious : undefined}
      onNext={navigation.hasNext ? goToNext : undefined}
    />
  );
};

export default DeliveryDetailsPage;