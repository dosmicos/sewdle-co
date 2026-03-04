import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Factory, AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useWorkshops } from "@/hooks/useWorkshops";
import { useWorkshopAssignments } from "@/hooks/useWorkshopAssignments";
import { useOrderMaterialConsumptions } from "@/hooks/useOrderMaterialConsumptions";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WorkshopReassignmentDialogProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  currentAssignment: {
    id: string;
    workshop_id: string;
    workshop_name: string;
  };
  onSuccess: () => void;
}

export const WorkshopReassignmentDialog = ({
  open,
  onClose,
  orderId,
  orderNumber,
  currentAssignment,
  onSuccess,
}: WorkshopReassignmentDialogProps) => {
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>("");
  const [expectedDate, setExpectedDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [workshopSelectorOpen, setWorkshopSelectorOpen] = useState(false);
  const [workshopSearch, setWorkshopSearch] = useState("");

  const { workshops, loading: loadingWorkshops } = useWorkshops();
  const { reassignWorkshop, loading: reassigning } = useWorkshopAssignments(false);
  const { data: consumptionsData } = useOrderMaterialConsumptions(orderId);

  // Filter out current workshop from available options
  const availableWorkshops = workshops.filter(
    (w) => w.id !== currentAssignment.workshop_id
  );
  const selectedWorkshop = availableWorkshops.find((w) => w.id === selectedWorkshopId);
  const filteredWorkshops = availableWorkshops.filter((workshop) =>
    workshop.name.toLowerCase().includes(workshopSearch.toLowerCase())
  );

  // Check for material consumptions
  const consumptions = consumptionsData || [];
  const hasMaterialConsumptions = consumptions.length > 0;
  const hasWarnings = hasMaterialConsumptions;

  const handleReassign = async () => {
    if (!selectedWorkshopId) return;

    const result = await reassignWorkshop(currentAssignment.id, selectedWorkshopId, {
      expectedCompletionDate: expectedDate ? format(expectedDate, "yyyy-MM-dd") : undefined,
      notes: notes || undefined,
    });

    if (result.data) {
      onSuccess();
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedWorkshopId("");
    setExpectedDate(undefined);
    setNotes("");
    setShowConfirmation(false);
    setWorkshopSelectorOpen(false);
    setWorkshopSearch("");
    onClose();
  };

  const handleProceed = () => {
    if (hasWarnings && !showConfirmation) {
      setShowConfirmation(true);
    } else {
      handleReassign();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="w-5 h-5" />
            Reasignar Taller - Orden {orderNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Workshop */}
          <div className="p-4 bg-muted rounded-lg">
            <Label className="text-sm text-muted-foreground">Taller Actual</Label>
            <p className="text-lg font-medium mt-1">{currentAssignment.workshop_name}</p>
          </div>

          {/* Warnings */}
          {hasWarnings && !showConfirmation && (
            <div className="space-y-3">
              {hasMaterialConsumptions && (
                <Alert variant="default" className="border-yellow-500/50 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    El taller actual ya ha consumido materiales para esta orden.
                    El cambio de taller no afectará estos registros.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Confirmation Message */}
          {showConfirmation && (
            <Alert variant="default" className="border-red-500/50 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                ¿Estás seguro de que deseas reasignar esta orden a otro taller?
                Esta acción no se puede deshacer.
              </AlertDescription>
            </Alert>
          )}

          {/* New Workshop Selector */}
          <div className="space-y-2">
            <Label htmlFor="new-workshop">Nuevo Taller *</Label>
            <Popover open={workshopSelectorOpen} onOpenChange={setWorkshopSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="new-workshop"
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={workshopSelectorOpen}
                  className="w-full justify-between"
                  disabled={loadingWorkshops || reassigning}
                >
                  <span className="truncate">
                    {selectedWorkshop ? selectedWorkshop.name : "Selecciona un taller"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0"
                align="start"
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Buscar taller..."
                    value={workshopSearch}
                    onValueChange={setWorkshopSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No se encontraron talleres.</CommandEmpty>
                    <ScrollArea className="h-64">
                      <CommandGroup>
                        {filteredWorkshops.map((workshop) => (
                          <CommandItem
                            key={workshop.id}
                            value={workshop.name}
                            onSelect={() => {
                              setSelectedWorkshopId(workshop.id);
                              setWorkshopSelectorOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedWorkshopId === workshop.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="truncate">{workshop.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </ScrollArea>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Expected Completion Date */}
          <div className="space-y-2">
            <Label>Nueva Fecha de Completación (Opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !expectedDate && "text-muted-foreground"
                  )}
                  disabled={reassigning}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expectedDate ? format(expectedDate, "PPP", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expectedDate}
                  onSelect={setExpectedDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="reassignment-notes">Notas sobre el cambio (Opcional)</Label>
            <Textarea
              id="reassignment-notes"
              placeholder="Razón del cambio de taller..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              disabled={reassigning}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={reassigning}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleProceed}
              disabled={!selectedWorkshopId || reassigning}
            >
              {showConfirmation ? "Confirmar Reasignación" : "Reasignar Taller"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
