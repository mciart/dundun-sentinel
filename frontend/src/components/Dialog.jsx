import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export default function Dialog({
  isOpen,
  onClose,
  title = '提示',
  message,
  type = 'alert',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };


  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600 dark:text-emerald-400',
          bgColor: 'bg-emerald-100 dark:bg-emerald-900/30'
        };
      case 'error':
        return {
          icon: AlertCircle,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/30'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          color: 'text-amber-600 dark:text-amber-400',
          bgColor: 'bg-amber-100 dark:bg-amber-900/30'
        };
      case 'info':
        return {
          icon: Info,
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/30'
        };
      default:
        return {
          icon: Info,
          color: 'text-slate-600 dark:text-slate-400',
          bgColor: 'bg-slate-100 dark:bg-slate-800'
        };
    }
  };

  const { icon: Icon, color, bgColor } = getIconAndColor();
  const isConfirm = type === 'confirm';

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {title}
            </h3>
            <button
              onClick={handleCancel}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="px-6 py-5">
            <div className="flex gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">
                  {message}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 py-4 bg-slate-50 dark:bg-slate-900/50">
            {isConfirm && (
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`${isConfirm ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
