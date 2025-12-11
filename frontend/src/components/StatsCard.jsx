import { motion } from 'framer-motion';

const colorMap = {
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-600 dark:text-blue-400'
  },
  green: {
    bg: 'bg-primary-100 dark:bg-primary-900/30',
    icon: 'text-primary-600 dark:text-primary-400',
    text: 'text-primary-600 dark:text-primary-400'
  },
  red: {
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    icon: 'text-danger-600 dark:text-danger-400',
    text: 'text-danger-600 dark:text-danger-400'
  },
  purple: {
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    icon: 'text-purple-600 dark:text-purple-400',
    text: 'text-purple-600 dark:text-purple-400'
  }
};

export default function StatsCard({ icon: Icon, label, value, color = 'blue' }) {
  const colors = colorMap[color];

  return (
    <div
      className="glass-card p-6 group cursor-pointer transition-all duration-300 hover:shadow-[0_3px_12px_2px_rgba(66,90,239,0.15),0_0_0_1px_rgba(66,90,239,0.3)] dark:hover:shadow-[0_3px_12px_2px_rgba(255,149,62,0.2),0_0_0_1px_rgba(255,149,62,0.4)] hover:border-[#425AEF] dark:hover:border-[#FF953E]"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            {label}
          </p>
          <p className={`text-3xl font-bold ${colors.text}`}>
            {value}
          </p>
        </div>
        <motion.div 
          className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center`}
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <Icon className={`w-7 h-7 ${colors.icon}`} />
        </motion.div>
      </div>
    </div>
  );
}
