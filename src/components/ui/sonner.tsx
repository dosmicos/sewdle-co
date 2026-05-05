
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-right"
      expand={true}
      richColors={true}
      closeButton={true}
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-white text-black border border-gray-200 shadow-lg rounded-lg font-medium",
          description: "text-gray-600",
          actionButton:
            "bg-blue-500 text-white hover:bg-blue-600 border-blue-500",
          cancelButton:
            "bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-200",
          closeButton: "bg-white text-gray-400 hover:text-gray-600 border-gray-200"
        },
        style: {
          backgroundColor: '#ffffff',
          color: '#000000',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '500',
          padding: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 999999
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
