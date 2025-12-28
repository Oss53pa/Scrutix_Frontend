import { useState, useCallback } from 'react';

interface ModalState<T> {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  item: T | null;
}

interface UseModalStateReturn<T> {
  isOpen: boolean;
  mode: 'create' | 'edit' | 'view';
  item: T | null;
  openCreate: () => void;
  openEdit: (item: T) => void;
  openView: (item: T) => void;
  close: () => void;
  reset: () => void;
}

export function useModalState<T = unknown>(
  initialItem: T | null = null
): UseModalStateReturn<T> {
  const [state, setState] = useState<ModalState<T>>({
    isOpen: false,
    mode: 'create',
    item: initialItem,
  });

  const openCreate = useCallback(() => {
    setState({ isOpen: true, mode: 'create', item: null });
  }, []);

  const openEdit = useCallback((item: T) => {
    setState({ isOpen: true, mode: 'edit', item });
  }, []);

  const openView = useCallback((item: T) => {
    setState({ isOpen: true, mode: 'view', item });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ isOpen: false, mode: 'create', item: null });
  }, []);

  return {
    isOpen: state.isOpen,
    mode: state.mode,
    item: state.item,
    openCreate,
    openEdit,
    openView,
    close,
    reset,
  };
}

// Hook for delete confirmation
interface UseDeleteConfirmReturn {
  itemToDelete: string | null;
  confirmDelete: (id: string) => void;
  cancelDelete: () => void;
  isConfirming: boolean;
}

export function useDeleteConfirm(): UseDeleteConfirmReturn {
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const confirmDelete = useCallback((id: string) => {
    setItemToDelete(id);
  }, []);

  const cancelDelete = useCallback(() => {
    setItemToDelete(null);
  }, []);

  return {
    itemToDelete,
    confirmDelete,
    cancelDelete,
    isConfirming: itemToDelete !== null,
  };
}
