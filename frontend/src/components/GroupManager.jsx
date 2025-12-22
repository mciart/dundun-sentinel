import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, Reorder } from 'framer-motion';
import { Plus, Edit2, Trash2, X, AlertCircle, Image as ImageIcon, GripVertical, Folder } from 'lucide-react';
import { getLucideIcon } from '../utils/helpers';
import Dialog from './Dialog';
import { useDialog } from '../hooks/useDialog';
import { DEFAULTS, CHART_COLORS } from '../config';
import { 
  EASING, 
  DURATION,
  modalVariants,
  modalTransition,
  backdropVariants,
  backdropTransition,
  closeButtonHover
} from '../utils/animations';

const MODAL_INITIAL = { name: '', icon: '', iconColor: CHART_COLORS.responseTime };

export default function GroupManager({ groups = [], onAdd, onEdit, onDelete }) {
  const [modalMode, setModalMode] = useState(null);
  const [currentGroupId, setCurrentGroupId] = useState(null);
  const [formData, setFormData] = useState(MODAL_INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { dialog, closeDialog, showAlert, showConfirm, showError } = useDialog();

  // 1. 初始化本地状态用于拖拽
  const [localGroups, setLocalGroups] = useState(groups);

  // 2. 当 props.groups 变化时，同步更新本地状态，并进行排序
  useEffect(() => {
    const sorted = [...groups].sort((a, b) => {
      const orderA = typeof a.order === 'number' ? a.order : 0;
      const orderB = typeof b.order === 'number' ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    setLocalGroups(sorted);
  }, [groups]);

  const openAddModal = () => {
    setModalMode('add');
    setCurrentGroupId(null);
    setFormData({ name: '', icon: '', iconColor: CHART_COLORS.responseTime });
    setError('');
  };

  const openEditModal = (group) => {
    setModalMode('edit');
    setCurrentGroupId(group.id);
    setFormData({
      name: group.name || '',
      icon: group.icon || '',
      iconColor: group.iconColor || CHART_COLORS.responseTime
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

  // 3. 处理拖拽排序更新
  const handleReorder = (newOrder) => {
    setLocalGroups(newOrder);
  };

  // 4. 拖拽结束后保存顺序
  // 注意：为了减少请求，实际项目中最好有批量更新接口。这里循环调用 onEdit。
  const handleDragEnd = async () => {
    try {
      // 创建更新队列
      const updates = localGroups.map((group, index) => {
        if (group.order !== index) {
            // 只更新顺序变动的项
            return onEdit(group.id, { ...group, order: index }, true); // 假设第三个参数是 silent（不显示通知）
        }
        return Promise.resolve();
      });
      await Promise.all(updates);
    } catch (error) {
      console.error("排序保存失败", error);
      showError('排序保存失败: ' + error.message);
    }
  };

  const handleDelete = (group) => {
    if (group.id === 'default') {
      showAlert(`不能删除${DEFAULTS.groupName}`, '提示', 'warning');
      return;
    }

    showConfirm(
      `确定要删除分类"${group.name}"吗？\n该分类下的站点将移至${DEFAULTS.groupName}。`,
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
        // 新增时，自动设置 order 为当前最大值 + 1
        const maxOrder = Math.max(...localGroups.map(g => g.order || 0), -1);
        payload.order = maxOrder + 1;
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
        {/* 5. 使用 Reorder.Group 替换普通 map */}
        <Reorder.Group axis="y" values={localGroups} onReorder={handleReorder} className="space-y-2">
          {localGroups.map((group) => (
            <Reorder.Item
              key={group.id}
              value={group}
              onDragEnd={handleDragEnd} // 拖拽结束时触发保存
              className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-[#2a2a2a]/50 hover:bg-slate-200/80 dark:hover:bg-[#2a2a2a] transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                {/* 拖拽手柄 */}
                <div className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <GripVertical className="w-4 h-4" />
                </div>
                
                <div className="flex items-center gap-2">
                  {group.icon && (() => {
                    const IconComponent = getLucideIcon(group.icon);
                    return IconComponent ? (
                      <IconComponent 
                        className="w-5 h-5 flex-shrink-0"
                        style={{ color: group.iconColor || 'currentColor' }}
                      />
                    ) : null;
                  })()}
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
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#333] text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  title="编辑"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {group.id !== 'default' && (
                  <button
                    onClick={() => handleDelete(group)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-[#333] text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        
        {localGroups.length === 0 && (
          <div className="p-6 rounded-xl bg-slate-100 dark:bg-[#2a2a2a]/50 text-center text-sm text-slate-500 dark:text-slate-400">
            还没有创建任何分类，点击右上角按钮添加。
          </div>
        )}
      </div>

      {modalMode && createPortal(
        /* ... 模态框代码保持不变 ... */
        <AnimatePresence initial={false}>
          <motion.div
            key="group-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            initial={backdropVariants.initial}
            animate={backdropVariants.animate}
            exit={backdropVariants.exit}
            transition={backdropTransition}
            onClick={closeModal}
          >
            <motion.div
              initial={modalVariants.initial}
              animate={modalVariants.animate}
              exit={modalVariants.exit}
              transition={modalTransition}
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
                <motion.button
                  onClick={closeModal}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-[#333] transition-colors"
                  aria-label="关闭"
                  {...closeButtonHover}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
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
                    图标名称
                    <a 
                      href="https://lucide.dev/icons/" 
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
                      placeholder="例如：Folder"
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    输入 <a href="https://lucide.dev/icons/" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">Lucide 图标</a>名称（PascalCase），如：Home、User、Github、Server 等
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
                        placeholder="#3b82f6"
                      />
                    </div>
                    <div className="mt-3 p-4 rounded-lg bg-slate-200 dark:bg-[#2a2a2a] flex items-center gap-3">
                      <span className="text-sm text-slate-600 dark:text-slate-400">预览:</span>
                      {(() => {
                        const IconComponent = getLucideIcon(formData.icon);
                        return IconComponent ? (
                          <IconComponent 
                            className="w-6 h-6"
                            style={{ color: formData.iconColor }}
                          />
                        ) : (
                          <span className="text-xs text-slate-400">无效图标名</span>
                        );
                      })()}
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