import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import {
  EASING,
  DURATION,
  modalVariants,
  modalTransition,
  backdropVariants,
  backdropTransition,
  closeButtonHover
} from '../utils/animations';

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
          bgColor: 'bg-slate-200/80 dark:bg-[#2a2a2a]'
        };
    }
  };

  const { icon: Icon, color, bgColor } = getIconAndColor();
  const isConfirm = type === 'confirm';

  return createPortal(
    <AnimatePresence initial={false}>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        initial={backdropVariants.initial}
        animate={backdropVariants.animate}
        exit={backdropVariants.exit}
        transition={backdropTransition}
        onClick={handleCancel}
      >
        <motion.div
          initial={modalVariants.initial}
          animate={modalVariants.animate}
          exit={modalVariants.exit}
          transition={modalTransition}
          className="glass-card w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >

          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-[#282828] dark:to-[#282828]">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              {title}
            </h3>
            <motion.button
              onClick={handleCancel}
              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-[#333] transition-colors"
              aria-label="关闭"
              {...closeButtonHover}
            >
              <X className="w-5 h-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
            </motion.button>
          </div>

          <div className="px-6 py-5 bg-white dark:bg-[#222]">
            <div className="flex gap-4">
              <motion.div
                className={`flex-shrink-0 w-10 h-10 rounded-full ${bgColor} flex items-center justify-center`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 500,
                  damping: 15
                }}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </motion.div>
              <motion.div
                className="flex-1 pt-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15, duration: 0.3 }}
              >
                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                  {message}
                </p>
              </motion.div>
            </div>
          </div>

          <motion.div
            className="flex gap-3 px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-[#282828] dark:to-[#282828] border-t border-slate-100 dark:border-slate-700"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            {isConfirm && (
              <motion.button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#2a2a2a] border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 hover:border-slate-300 dark:hover:bg-[#333] transition-all"
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                {cancelText}
              </motion.button>
            )}
            <motion.button
              onClick={handleConfirm}
              className={`${isConfirm ? 'flex-1' : 'w-full'} px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40`}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2 }}
            >
              {confirmText}
            </motion.button>
          </motion.div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
