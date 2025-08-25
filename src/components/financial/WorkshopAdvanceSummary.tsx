import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useWorkshopAdvanceBalance } from "@/hooks/useWorkshopAdvanceBalance";

export const WorkshopAdvanceSummary = () => {
  const { balances, loading } = useWorkshopAdvanceBalance();

  const formatCurrency = (amount: number) => {
    return `COP $${new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)}`;
  };

  const getBalanceVariant = (balance: number) => {
    if (balance > 0) return "secondary"; // They owe us work/money
    if (balance < 0) return "destructive"; // We owe them money
    return "outline"; // Even
  };

  const getBalanceIcon = (balance: number) => {
    if (balance > 0) return <TrendingUp className="w-4 h-4" />;
    if (balance < 0) return <TrendingDown className="w-4 h-4" />;
    return <DollarSign className="w-4 h-4" />;
  };

  const totalNetBalance = balances.reduce((sum, balance) => sum + balance.net_balance, 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Balance de Anticipos por Taller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Cargando balances...</div>
        </CardContent>
      </Card>
    );
  }

  if (balances.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Balance de Anticipos por Taller
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No hay balances de anticipos para mostrar
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Balance de Anticipos por Taller
          </div>
          <Badge variant={getBalanceVariant(totalNetBalance)} className="flex items-center gap-1">
            {getBalanceIcon(totalNetBalance)}
            Total: {formatCurrency(Math.abs(totalNetBalance))}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => (
            <Card key={balance.workshop_id} className="relative">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium truncate">{balance.workshop_name}</h4>
                  <Badge variant={getBalanceVariant(balance.net_balance)} className="flex items-center gap-1">
                    {getBalanceIcon(balance.net_balance)}
                    {formatCurrency(Math.abs(balance.net_balance))}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Anticipos dados:</span>
                    <span>{formatCurrency(balance.total_advances)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Anticipos usados:</span>
                    <span>{formatCurrency(balance.total_deductions_used)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between font-medium">
                      <span>
                        {balance.net_balance > 0 ? 'Nos debe:' : 
                         balance.net_balance < 0 ? 'Le debemos:' : 'Balance:'}
                      </span>
                      <span className={
                        balance.net_balance > 0 ? 'text-muted-foreground' :
                        balance.net_balance < 0 ? 'text-destructive' : ''
                      }>
                        {formatCurrency(Math.abs(balance.net_balance))}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {totalNetBalance !== 0 && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between font-medium">
              <span>Balance Total de la Organización:</span>
              <span className={totalNetBalance > 0 ? 'text-muted-foreground' : 'text-destructive'}>
                {totalNetBalance > 0 ? 'Nos deben: ' : 'Debemos: '}
                {formatCurrency(Math.abs(totalNetBalance))}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};