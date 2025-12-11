import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Edit2, Trash2, X, AlertCircle, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import Dialog from './Dialog';
import { useDialog } from '../hooks/useDialog';

const MODAL_INITIAL = { name: '', icon: '', iconColor: '#3B82F6' };

export default function GroupManager({ groups = [], onAdd, onEdit, onDelete }) {
  const [modalMode, setModalMode] = useState(null); 
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [formData, setFormData] = useState(MODAL_INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { dialog, closeDialog, showAlert, showConfirm, showError } = useDialog();

  const sortedGroups = useMemo(() => {
    return [...groups].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }, [groups]);

  const nextOrderValue = useMemo(() => {
    if (!sortedGroups.length) return 0;
    const maxOrder = Math.max(...sortedGroups.map(g => (typeof g.order === 'number' ? g.order : 0)));
    return maxOrder + 1;
  }, [sortedGroups]);

  const openAddModal = () => {
    setModalMode('add');
    setCurrentGroupId(null);
    setFormData({ name: '', icon: '', iconColor: '#3B82F6' });
    setError('');
  };

  const openEditModal = (group) => {
    setModalMode('edit');
    setCurrentGroupId(group.id);
    setFormData({
      name: group.name || '',
      icon: group.icon || '',
      iconColor: group.iconColor || '#3B82F6'
    });
    setError('');
  };

  const closeModal = () => {
    setModalMode(null);
    setCurrentGroupId(null);
    setFormData(MODAL_INITIAL);
    setLoading(false);
    setError('');
  };

  const handleMoveUp = async (group, index) => {
    if (index === 0) return; 
    
    const prevGroup = sortedGroups[index - 1];
    
    try {
      const tempOrder = -999;
      
      await Promise.all([
        onEdit(group.id, { name: group.name, order: tempOrder }, false),
        onEdit(prevGroup.id, { name: prevGroup.name, order: index }, false)
      ]);
      
      await onEdit(group.id, { name: group.name, order: index - 1 }, true);
    } catch (error) {
      showError('移动失败: ' + error.message);
    }
  };

  const handleMoveDown = async (group, index) => {
    if (index === sortedGroups.length - 1) return; 
    
    const nextGroup = sortedGroups[index + 1];
    
    try {
      const tempOrder = -999;
      
      await Promise.all([
        onEdit(group.id, { name: group.name, order: tempOrder }, false),
        onEdit(nextGroup.id, { name: nextGroup.name, order: index }, false)
      ]);
      
      await onEdit(group.id, { name: group.name, order: index + 1 }, true);
    } catch (error) {
      showError('移动失败: ' + error.message);
    }
  };

  const handleDelete = (group) => {
    if (group.id === 'default') {
      showAlert('不能删除默认分类', '提示', 'warning');
      return;
    }

    showConfirm(
      `确定要删除分类“${group.name}”吗？\n该分类下的站点将移至默认分类。`,
      async () => {
        try {
          await onDelete(group.id);
        } catch (error) {
          showError('删除分类失败: ' + error.message);
        }
      },
      '确认删除'
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('请输入分类名称');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: formData.name.trim(),
        icon: formData.icon.trim() || null,
        iconColor: formData.iconColor || null
      };

      if (modalMode === 'add') {
        await onAdd(payload);
      } else if (modalMode === 'edit' && currentGroupId) {
        await onEdit(currentGroupId, payload);
      }

      closeModal();
    } catch (error) {
      setError(error.message || '操作失败');
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">分类管理</h2>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          添加分类
        </button>
      </div>

      <div className="space-y-2">
        {sortedGroups.map((group, index) => (
          <div
            key={group.id}
            className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button
                  onClick={() => handleMoveUp(group, index)}
                  disabled={index === 0}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="上移"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleMoveDown(group, index)}
                  disabled={index === sortedGroups.length - 1}
                  className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="下移"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {group.icon && (
                  <i 
                    className={`${group.icon} w-5 h-5 flex items-center justify-center flex-shrink-0`}
                    style={{ color: group.iconColor || 'currentColor' }}
                  />
                )}
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {group.name}
                </span>
                {group.id === 'default' && (
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                    (默认)
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => openEditModal(group)}
                className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                title="编辑"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              {group.id !== 'default' && (
                <button
                  onClick={() => handleDelete(group)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {sortedGroups.length === 0 && (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center text-sm text-slate-500 dark:text-slate-400">
            还没有创建任何分类，点击右上角按钮添加。
          </div>
        )}
      </div>
      {modalMode && createPortal(
        <AnimatePresence>
          <motion.div
            key="group-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                  {modalMode === 'add' ? (
                    <>
                      <Plus className="w-5 h-5" />
                      添加分类
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-5 h-5" />
                      编辑分类
                    </>
                  )}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="关闭"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    分类名称 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input-field"
                    placeholder="例如：人生大乱炖"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    图标类名
                    <a 
                      href="https://fontawesome.com/search?o=r&m=free" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      浏览图标库
                    </a>
                  </label>
                  <div className="relative">
                    <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                      className="input-field pl-10"
                      placeholder="例如：fas fa-folder"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    输入 Font Awesome 图标类名，如：fas fa-home、far fa-user、fab fa-github 等
                  </p>
                </div>

                {formData.icon && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      图标颜色
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formData.iconColor}
                        onChange={(e) => setFormData({ ...formData, iconColor: e.target.value })}
                        className="w-12 h-10 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.iconColor}
                        onChange={(e) => setFormData({ ...formData, iconColor: e.target.value })}
                        className="input-field flex-1"
                        placeholder="#3B82F6"
                      />
                    </div>
                    <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
                      <span className="text-sm text-slate-600 dark:text-slate-400">预览:</span>
                      <i 
                        className={`${formData.icon} text-2xl`}
                        style={{ color: formData.iconColor }}
                      />
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formData.iconColor}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-4 rounded-xl bg-danger-50 dark:bg-danger-900/30 text-danger-600 dark:text-danger-400"
                  >
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm">{error}</p>
                  </motion.div>
                )}

                <div className="flex gap-3 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="btn-secondary min-w-[96px]"
                    disabled={loading}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="btn-primary min-w-[120px] disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? '保存中...' : '确认'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
      
      {/* 统一弹窗 */}
      <Dialog
        isOpen={dialog.isOpen}
        onClose={closeDialog}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
      />
    </div>
  );
}
