import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { CHART_COLORS } from '../config';
import { getStatusClasses, getStatusDotClass, getStatusLabel, getStatusColor } from '../utils/status';

export default function HistoryChart({ data }) {
    if (!data || data.length === 0) return null;

    // 格式化数据以适配图表
    const chartData = data.map(item => ({
        ...item,
        time: new Date(item.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
        }),
        fullTime: new Date(item.timestamp).toLocaleString('zh-CN'),
    })).reverse(); // 翻转数组以使时间从左（旧）到右（新）

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const statusDotClass = getStatusDotClass(data.status);
            const statusLabel = getStatusLabel(data.status);
            const statusColorClass = getStatusTextColor(data.status);

            return (
                <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-slate-200 dark:border-zinc-700 p-3 rounded-lg shadow-lg text-xs">
                    <p className="font-medium text-slate-900 dark:text-slate-100 mb-2">{data.fullTime}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-slate-600 dark:text-slate-400">响应时间:</span>
                            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">{data.responseTime}ms</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${statusDotClass}`}></div>
                            <span className="text-slate-600 dark:text-slate-400">状态:</span>
                            <span className={`font-medium ${statusColorClass}`}>
                                {statusLabel}
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS.responseTime} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={CHART_COLORS.responseTime} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(200,200,200,0.2)" />
                    <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={30}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: '#888' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}ms`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="responseTime"
                        stroke={CHART_COLORS.responseTime}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPv)"
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
