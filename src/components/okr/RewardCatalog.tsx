import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Gift, 
  Calendar, 
  Coffee, 
  BookOpen, 
  Car, 
  ShoppingBag,
  Trophy,
  Star,
  Clock,
  Check
} from 'lucide-react';

interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'time_off' | 'food' | 'learning' | 'wellness' | 'merchandise' | 'experience';
  availability: number; // remaining quantity
  maxAvailability: number; // total quantity
  status: 'available' | 'limited' | 'unavailable' | 'redeemed';
  image?: string;
  restrictions?: string;
  expiryDate?: string;
  popularity: number; // 1-5 stars
}

interface RewardCatalogProps {
  userPoints?: number;
  onRedeem?: (rewardId: string) => void;
  category?: string;
  showUserProgress?: boolean;
}

// Mock data - en producción vendría del backend
const mockRewards: Reward[] = [
  {
    id: '1',
    name: 'Día Libre Extra',
    description: 'Un día de descanso adicional a tus vacaciones',
    cost: 500,
    category: 'time_off',
    availability: 5,
    maxAvailability: 10,
    status: 'available',
    restrictions: 'Sujeto a aprobación del supervisor',
    popularity: 5
  },
  {
    id: '2',
    name: 'Voucher de Almuerzo',
    description: 'Vale de $25 para restaurante local',
    cost: 250,
    category: 'food',
    availability: 15,
    maxAvailability: 20,
    status: 'available',
    expiryDate: '2024-06-30',
    popularity: 4
  },
  {
    id: '3',
    name: 'Curso Online Certificado',
    description: 'Acceso a curso profesional con certificación',
    cost: 1000,
    category: 'learning',
    availability: 8,
    maxAvailability: 10,
    status: 'available',
    restrictions: 'Debe ser relacionado al área de trabajo',
    popularity: 5
  },
  {
    id: '4',
    name: 'Membresía de Gimnasio',
    description: '3 meses de membresía en gimnasio local',
    cost: 800,
    category: 'wellness',
    availability: 2,
    maxAvailability: 5,
    status: 'limited',
    popularity: 4
  },
  {
    id: '5',
    name: 'Camiseta de la Empresa',
    description: 'Camiseta premium con logo de la empresa',
    cost: 150,
    category: 'merchandise',
    availability: 0,
    maxAvailability: 25,
    status: 'unavailable',
    popularity: 3
  },
  {
    id: '6',
    name: 'Estacionamiento VIP',
    description: 'Espacio de estacionamiento reservado por 1 mes',
    cost: 300,
    category: 'experience',
    availability: 3,
    maxAvailability: 3,
    status: 'limited',
    popularity: 4
  }
];

export const RewardCatalog: React.FC<RewardCatalogProps> = ({
  userPoints = 1250,
  onRedeem,
  category,
  showUserProgress = true
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>(category || 'all');

  const filteredRewards = React.useMemo(() => {
    if (selectedCategory === 'all') return mockRewards;
    return mockRewards.filter(reward => reward.category === selectedCategory);
  }, [selectedCategory]);

  const categories = [
    { id: 'all', name: 'Todos', icon: Gift },
    { id: 'time_off', name: 'Tiempo Libre', icon: Calendar },
    { id: 'food', name: 'Alimentación', icon: Coffee },
    { id: 'learning', name: 'Aprendizaje', icon: BookOpen },
    { id: 'wellness', name: 'Bienestar', icon: Star },
    { id: 'merchandise', name: 'Productos', icon: ShoppingBag },
    { id: 'experience', name: 'Experiencias', icon: Trophy }
  ];

  const getRewardIcon = (category: string) => {
    const categoryData = categories.find(cat => cat.id === category);
    return categoryData?.icon || Gift;
  };

  const getStatusColor = (status: string, cost: number, userPoints: number) => {
    if (status === 'redeemed') return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
    if (status === 'unavailable') return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    if (cost > userPoints) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    if (status === 'limited') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getStatusLabel = (status: string, cost: number, userPoints: number) => {
    if (status === 'redeemed') return 'Canjeado';
    if (status === 'unavailable') return 'Agotado';
    if (cost > userPoints) return 'Puntos insuficientes';
    if (status === 'limited') return 'Últimas unidades';
    return 'Disponible';
  };

  const canRedeem = (reward: Reward) => {
    return reward.status === 'available' || 
           (reward.status === 'limited' && reward.availability > 0) && 
           reward.cost <= userPoints;
  };

  const renderPopularityStars = (popularity: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3 w-3 ${
              star <= popularity ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* User Points Summary */}
      {showUserProgress && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Gift className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{userPoints.toLocaleString()} puntos</div>
                  <div className="text-sm text-muted-foreground">Disponibles para canjear</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Próxima recompensa:</div>
                <div className="font-medium">Curso Online (1000 pts)</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const IconComponent = cat.icon;
              return (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex items-center gap-2"
                >
                  <IconComponent className="h-4 w-4" />
                  {cat.name}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rewards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRewards.map((reward) => {
          const IconComponent = getRewardIcon(reward.category);
          const statusColor = getStatusColor(reward.status, reward.cost, userPoints);
          const statusLabel = getStatusLabel(reward.status, reward.cost, userPoints);
          const isRedeemable = canRedeem(reward);

          return (
            <Card key={reward.id} className={`transition-all hover:shadow-md ${!isRedeemable ? 'opacity-60' : ''}`}>
              <CardContent className="p-4 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{reward.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {reward.description}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Popularity */}
                <div className="flex items-center justify-between">
                  {renderPopularityStars(reward.popularity)}
                  <Badge variant="outline" className="text-xs">
                    {reward.cost} puntos
                  </Badge>
                </div>

                {/* Availability */}
                {reward.maxAvailability > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Disponibilidad</span>
                      <span>{reward.availability}/{reward.maxAvailability}</span>
                    </div>
                    <Progress 
                      value={(reward.availability / reward.maxAvailability) * 100} 
                      className="h-1"
                    />
                  </div>
                )}

                {/* Status and Restrictions */}
                <div className="space-y-2">
                  <Badge className={statusColor}>
                    {statusLabel}
                  </Badge>
                  
                  {reward.restrictions && (
                    <p className="text-xs text-muted-foreground">{reward.restrictions}</p>
                  )}
                  
                  {reward.expiryDate && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Vence: {new Date(reward.expiryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <Button
                  className="w-full"
                  variant={isRedeemable ? 'default' : 'outline'}
                  disabled={!isRedeemable}
                  onClick={() => isRedeemable && onRedeem?.(reward.id)}
                >
                  {reward.status === 'redeemed' ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Canjeado
                    </>
                  ) : isRedeemable ? (
                    'Canjear'
                  ) : reward.cost > userPoints ? (
                    `Faltan ${(reward.cost - userPoints).toLocaleString()} puntos`
                  ) : (
                    'No disponible'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredRewards.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <div className="text-center space-y-2">
                <Gift className="h-8 w-8 mx-auto opacity-50" />
                <p>No hay recompensas en esta categoría</p>
                <p className="text-sm">Selecciona otra categoría o vuelve más tarde</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};