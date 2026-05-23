import useAdminStore from '../store/adminStore'

export function useToast() {
  const addToast = useAdminStore(s => s.addToast)
  return {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    info: (msg) => addToast(msg, 'info'),
    warning: (msg) => addToast(msg, 'warning'),
  }
}
