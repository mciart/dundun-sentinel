/**
 * 全局动画配置
 * 所有动画预设都在这里统一管理
 * 新页面只需导入并使用这些预设即可
 */

// Q弹缓动曲线 - 核心动画曲线
export const EASING = {
  // Q弹效果（主要使用）
  bounce: [0.34, 1.56, 0.64, 1],
  // 弹簧效果（更弹）
  spring: [0.68, -0.55, 0.265, 1.55],
  // 平滑
  smooth: [0.4, 0, 0.2, 1],
  // 快出
  easeOut: [0, 0, 0.2, 1],
  // 快入
  easeIn: [0.4, 0, 1, 1],
};

// 动画时长
export const DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  slower: 0.7,
};

// 弹簧配置
export const SPRING = {
  // 轻弹簧
  soft: { type: "spring", stiffness: 200, damping: 20 },
  // 标准弹簧
  normal: { type: "spring", stiffness: 300, damping: 15 },
  // 硬弹簧（更Q弹）
  stiff: { type: "spring", stiffness: 500, damping: 15 },
  // 非常Q弹
  bouncy: { type: "spring", stiffness: 400, damping: 10 },
};

/**
 * ========================================
 * 页面级动画预设
 * ========================================
 */

// 页面容器入场动画（用于页面最外层）
export const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20
  },
};

export const pageTransition = {
  duration: DURATION.normal,
  ease: EASING.bounce,
};

// 页面卡片容器（登录页、404页等独立页面）
export const cardContainerVariants = {
  initial: {
    opacity: 0,
    scale: 0.8,
    y: 30
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0
  },
};

export const cardContainerTransition = {
  duration: DURATION.slow,
  ease: EASING.bounce,
  scale: SPRING.normal,
};

/**
 * ========================================
 * 元素级动画预设
 * ========================================
 */

// 淡入上浮（通用）
export const fadeInUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.normal, ease: EASING.bounce },
};

// 淡入下降
export const fadeInDown = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: DURATION.normal, ease: EASING.bounce },
};

// 淡入左移
export const fadeInLeft = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: DURATION.normal, ease: EASING.bounce },
};

// 淡入右移
export const fadeInRight = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: DURATION.normal, ease: EASING.bounce },
};

// 缩放入场
export const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: DURATION.normal, ease: EASING.bounce },
};

// 弹跳入场（图标、头像等）
export const bounceIn = {
  initial: { opacity: 0, scale: 0 },
  animate: { opacity: 1, scale: 1 },
  transition: SPRING.stiff,
};

// 旋转入场（Logo、图标）
export const rotateIn = {
  initial: { opacity: 0, scale: 0, rotate: -180 },
  animate: { opacity: 1, scale: 1, rotate: 0 },
  transition: SPRING.normal,
};

// 数字弹跳（倒计时、计数器）
export const numberPop = {
  initial: { scale: 1.5, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: SPRING.stiff,
};

/**
 * ========================================
 * 交互动画预设
 * ========================================
 */

// 按钮悬浮效果
export const buttonHover = {
  whileHover: {
    scale: 1.02,
    y: -2,
    transition: { duration: DURATION.fast, ease: EASING.bounce }
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  },
};

// 图标按钮悬浮效果
export const iconButtonHover = {
  whileHover: {
    scale: 1.1,
    transition: { duration: DURATION.fast }
  },
  whileTap: {
    scale: 0.9,
    transition: { duration: 0.1 }
  },
};

// 关闭按钮悬浮效果（带旋转）
export const closeButtonHover = {
  whileHover: {
    scale: 1.1,
    rotate: 90,
    transition: { duration: DURATION.fast }
  },
  whileTap: {
    scale: 0.9,
    transition: { duration: 0.1 }
  },
};

// 卡片悬浮效果
export const cardHover = {
  whileHover: {
    y: -4,
    scale: 1.02,
    transition: { duration: DURATION.fast, ease: EASING.bounce }
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: 0.1 }
  },
};

// 链接悬浮效果
export const linkHover = {
  whileHover: {
    scale: 1.05,
    transition: { duration: DURATION.fast }
  },
  whileTap: {
    scale: 0.95,
    transition: { duration: 0.1 }
  },
};

/**
 * ========================================
 * 特效动画
 * ========================================
 */

// 摇晃动画（错误提示、警告）
export const shake = {
  animate: {
    rotate: [0, -10, 10, -10, 0],
  },
  transition: {
    duration: DURATION.slow,
    ease: "easeInOut"
  },
};

// 轻微摇晃（Logo等）
export const wiggle = {
  animate: {
    rotate: [0, -5, 5, -5, 0],
  },
  transition: {
    duration: DURATION.slow,
    ease: "easeInOut"
  },
};

// 脉冲效果
export const pulse = {
  animate: {
    scale: [1, 1.05, 1],
  },
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: "easeInOut"
  },
};

// 旋转加载
export const spin = {
  animate: { rotate: 360 },
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: "linear"
  },
};

/**
 * ========================================
 * 列表动画预设
 * ========================================
 */

// 列表容器 variants
export const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    }
  }
};

// 列表项 variants
export const listItemVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: DURATION.normal,
      ease: EASING.bounce,
    }
  }
};

/**
 * ========================================
 * 模态框动画预设
 * ========================================
 */

// 背景遮罩 - 无动画
export const backdropVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const backdropTransition = {
  duration: 0,
};

// 模态框内容 - 无动画
export const modalVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalTransition = {
  duration: 0,
};

// 弹窗内容元素动画 - 无动画
export const modalContentVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

// 弹窗图标动画 - 无动画
export const modalIconVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

// 弹窗按钮区域动画 - 无动画
export const modalButtonsVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
};

/**
 * ========================================
 * 工具函数
 * ========================================
 */

// 创建延迟动画
export const withDelay = (animation, delay) => ({
  ...animation,
  transition: {
    ...animation.transition,
    delay,
  },
});

// 创建交错动画（用于列表）
export const stagger = (delay = 0.05) => ({
  transition: {
    staggerChildren: delay,
  },
});

// 获取带索引延迟的动画
export const withIndex = (animation, index, baseDelay = 0.05) => ({
  ...animation,
  transition: {
    ...animation.transition,
    delay: index * baseDelay,
  },
});

/**
 * ========================================
 * 默认导出：常用预设组合
 * ========================================
 */
const animations = {
  // 缓动
  easing: EASING,
  duration: DURATION,
  spring: SPRING,

  // 页面
  page: { variants: pageVariants, transition: pageTransition },
  cardContainer: { variants: cardContainerVariants, transition: cardContainerTransition },

  // 元素
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  bounceIn,
  rotateIn,
  numberPop,

  // 交互
  buttonHover,
  iconButtonHover,
  closeButtonHover,
  cardHover,
  linkHover,

  // 特效
  shake,
  wiggle,
  pulse,
  spin,

  // 列表
  list: {
    container: listContainerVariants,
    item: listItemVariants,
  },

  // 模态框
  modal: {
    backdrop: { variants: backdropVariants, transition: backdropTransition },
    content: { variants: modalVariants, transition: modalTransition },
  },

  // 工具
  withDelay,
  stagger,
  withIndex,
};

export default animations;
