import { CHART_COLORS } from '../config';

/**
 * 获取状态对应的颜色代码
 * @param {string} status - 状态值 ('online', 'slow', 'offline', 'unknown')
 * @returns {string} 十六进制颜色代码
 */
export const getStatusColor = (status) => {
    return CHART_COLORS[status] || CHART_COLORS.offline; // 默认为红色/离线
};

/**
 * 获取状态对应的 Tailwind 类名 (文本色 + 背景色)
 * @param {string} status - 状态值
 * @param {boolean} isDark - 是否暗黑模式 (用于某些特定调整，目前主要依赖 Tailwind dark前缀)
 * @returns {string} Tailwind 类名字符串
 */
export const getStatusClasses = (status) => {
    switch (status) {
        case 'online':
            return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20';
        case 'slow':
            return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20';
        case 'offline':
            return 'text-red-600 bg-red-50 dark:bg-red-900/20';
        default:
            return 'text-slate-600 bg-slate-50 dark:bg-slate-800/50';
    }
};

/**
 * 获取状态对应的文本颜色类名
 * @param {string} status
 * @returns {string} Tailwind 类名
 */
export const getStatusTextColor = (status) => {
    switch (status) {
        case 'online':
            return 'text-emerald-600 dark:text-emerald-400';
        case 'slow':
            return 'text-amber-600 dark:text-amber-400';
        case 'offline':
            return 'text-red-600 dark:text-red-400';
        default:
            return 'text-slate-600 dark:text-slate-400';
    }
};

/**
 * 获取状态对应的圆点颜色类名
 * @param {string} status 
 * @returns {string} Tailwind 类名
 */
export const getStatusDotClass = (status) => {
    switch (status) {
        case 'online':
            return 'bg-emerald-500';
        case 'slow':
            return 'bg-amber-500';
        case 'offline':
            return 'bg-red-500';
        default:
            return 'bg-slate-400';
    }
};

/**
 * 获取状态对应的中文描述
 * @param {string} status 
 * @returns {string}
 */
export const getStatusLabel = (status) => {
    switch (status) {
        case 'online':
            return '正常';
        case 'slow':
            return '缓慢';
        case 'offline':
            return '异常';
        default:
            return '未知';
    }
};

/**
 * 获取状态对应的卡片悬浮背景色
 * @param {string} status
 * @returns {string} Tailwind 类名
 */
export const getStatusHoverBg = (status) => {
    switch (status) {
        case 'online':
            return 'group-hover:bg-emerald-50/80 dark:group-hover:bg-emerald-950/30';
        case 'slow':
            return 'group-hover:bg-amber-50/80 dark:group-hover:bg-amber-950/30';
        case 'offline':
            return 'group-hover:bg-red-50/80 dark:group-hover:bg-red-950/30';
        default:
            return 'group-hover:bg-slate-50/80 dark:group-hover:bg-slate-800/30';
    }
};

/**
 * 获取状态指示灯的完整类名（含阴影）
 * @param {string} status
 * @returns {string} Tailwind 类名
 */
export const getStatusDotClassWithShadow = (status) => {
    switch (status) {
        case 'online':
            return 'bg-emerald-500 shadow-emerald-500/50';
        case 'offline':
            return 'bg-red-500 shadow-red-500/50';
        case 'slow':
            return 'bg-amber-500 shadow-amber-500/50';
        default:
            return 'bg-slate-400';
    }
};
