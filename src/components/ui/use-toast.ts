
import { toast } from "sonner";

// Re-export toast from sonner for consistency
export { toast };

// Create a useToast hook that returns the toast function for compatibility
export const useToast = () => {
  return {
    toast,
    dismiss: (toastId?: string | number) => {
      if (toastId) {
        toast.dismiss(toastId);
      } else {
        toast.dismiss();
      }
    }
  };
};
