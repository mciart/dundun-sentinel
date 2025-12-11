import { useState, useCallback } from 'react';


export function useDialog() {
  const [dialog, setDialog] = useState({
    isOpen: false,
    title: '提示',
    message: '',
    type: 'alert',
    confirmText: '确定',
    cancelText: '取消',
    onConfirm: null
  });

  const closeDialog = useCallback(() => {
    setDialog(prev => ({ ...prev, isOpen: false }));
  }, []);


  const showAlert = useCallback((message, title = '提示', type = 'info') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: null
    });
  }, []);

  const showConfirm = useCallback((message, onConfirm, title = '确认', type = 'warning') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      confirmText: '确定',
      cancelText: '取消',
      onConfirm
    });
  }, []);

  const showSuccess = useCallback((message, title = '成功') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type: 'success',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: null
    });
  }, []);

  const showError = useCallback((message, title = '错误') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type: 'error',
      confirmText: '确定',
      cancelText: '取消',
      onConfirm: null
    });
  }, []);

  return {
    dialog,
    closeDialog,
    showAlert,
    showConfirm,
    showSuccess,
    showError
  };
}
