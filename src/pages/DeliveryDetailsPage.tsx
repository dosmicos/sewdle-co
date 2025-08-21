import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeliveries } from '@/hooks/useDeliveries';
import DeliveryDetails from '@/components/DeliveryDetails';
import { useAuth } from '@/contexts/AuthContext';

const DeliveryDetailsPage = () => {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const { fetchDeliveryById } = useDeliveries();
  const { hasPermission } = useAuth();
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check permissions - same as in DeliveriesPage
  const canViewDeliveries = hasPermission('deliveries', 'view');

  useEffect(() => {
    if (!deliveryId || !canViewDeliveries) {
      navigate('/deliveries');
      return;
    }

    const loadDelivery = async () => {
      try {
        setLoading(true);
        const deliveryData = await fetchDeliveryById(deliveryId);
        if (!deliveryData) {
          setError('Entrega no encontrada');
          return;
        }
        setDelivery(deliveryData);
      } catch (err) {
        console.error('Error loading delivery:', err);
        setError('Error al cargar la entrega');
      } finally {
        setLoading(false);
      }
    };

    loadDelivery();
  }, [deliveryId, fetchDeliveryById, canViewDeliveries, navigate]);

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
    />
  );
};

export default DeliveryDetailsPage;