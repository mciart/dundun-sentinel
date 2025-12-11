import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistory } from '../context/HistoryContext';

const CONFIG = {
  BLOCK_WIDTH: 16,
  MIN_BLOCK_GAP: 5,
  MAX_BLOCK_GAP: 7,
  BLOCK_RADIUS: 6,
  MAX_HISTORY: 2000,
};

export default function StatusBarCanvas({ siteId, onAverageResponseTime }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [blockGap, setBlockGap] = useState(CONFIG.MIN_BLOCK_GAP);
  
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const blocksRef = useRef([]);
  const hoveredIndexRef = useRef(null);
  const touchActiveRef = useRef(false);
  const fetchAttemptRef = useRef(false);

  const { getHistory: getCachedHistory, fetchAllHistory: fetchHistoryBatch, loading: historyLoading, historyCache } = useHistory();

  const getBlockColors = useCallback((record, isDark = false) => {
    if (!record || record.status === 'empty') {
      return isDark 
        ? { bg: 'rgba(71, 85, 105, 0.3)', hover: 'rgba(71, 85, 105, 0.4)' }
        : { bg: 'rgba(148, 163, 184, 0.35)', hover: 'rgba(148, 163, 184, 0.45)' };
    }
    
    const status = record.status;
    const responseTime = record.responseTime || 0;
    
    if (status === 'offline') {
      return { bg: 'rgb(239, 68, 68)', hover: 'rgb(220, 38, 38)' };
    }
    
    if (status === 'slow') {
      return responseTime > 15000
        ? { bg: 'rgb(249, 115, 22)', hover: 'rgb(234, 88, 12)' }
        : { bg: 'rgb(251, 191, 36)', hover: 'rgb(245, 158, 11)' };
    }
    
    if (status === 'online') {
      return responseTime > 1500
        ? { bg: 'rgb(52, 211, 153)', hover: 'rgb(16, 185, 129)' }
        : { bg: 'rgb(5, 150, 105)', hover: 'rgb(4, 120, 87)' };
    }
    
    return isDark
      ? { bg: 'rgba(71, 85, 105, 0.3)', hover: 'rgba(71, 85, 105, 0.4)' }
      : { bg: 'rgba(148, 163, 184, 0.35)', hover: 'rgba(148, 163, 184, 0.45)' };
  }, []);

  const getStatusConfig = useCallback((status) => {
    return {
      online: { text: '正常运行', color: 'text-emerald-600', dotColor: 'bg-emerald-500' },
      slow: { text: '响应缓慢', color: 'text-amber-600', dotColor: 'bg-amber-500' },
      offline: { text: '服务异常', color: 'text-red-600', dotColor: 'bg-red-500' },
    }[status] || { text: '服务异常', color: 'text-red-600', dotColor: 'bg-red-500' };
  }, []);

  const getDisplayText = useCallback((record) => {
    if (!record) return '服务异常';
    if (record.status === 'online') return '正常运行';
    if (record.status === 'slow') {
      const msg = (record.message || '').toString().toLowerCase();
      if (msg.includes('非常缓慢')) return '响应非常缓慢';
      return '响应缓慢';
    }
    const raw = (record.message || '').toString();
    const msg = raw.toLowerCase();
    if (!raw || raw === 'OK') return '服务异常';
    if (msg.includes('连接超时')) return '连接超时';
    if (msg.includes('请求超时') || msg.includes('timeout')) return '请求超时';
    if (msg.includes('域名解析失败') || msg.includes('解析失败') || msg.includes('dns') || msg.includes('resolve') || msg.includes('enotfound') || msg.includes('name not resolved')) return '域名解析失败';
    if (raw.startsWith('HTTP ') || msg.startsWith('http ')) return raw.toUpperCase();
    if (msg.includes('证书错误') || msg.includes('certificate') || msg.includes('tls握手') || msg.includes('ssl')) return '证书错误';
    if (msg.includes('连接被拒绝') || msg.includes('refused')) return '连接被拒绝';
    if (msg.includes('连接被重置') || msg.includes('reset')) return '连接被重置';
    if (msg.includes('网络不可达') || msg.includes('unreachable')) return '网络不可达';
    if (msg.includes('缺少关键字')) return '缺少关键字';
    if (msg.includes('禁用关键字')) return '包含禁用关键字';
    if (msg.includes('网络错误')) return '网络错误';
    return '服务异常';
  }, []);

  const shouldShowMessage = useCallback((record) => {
    if (!record || !record.message) return false;
    const raw = record.message.toString();
    if (!raw || raw === 'OK') return false;
    const display = getDisplayText(record) || '';
    const a = raw.trim().toLowerCase();
    const b = display.trim().toLowerCase();
    if (a === b) return false;
    if (a.startsWith('http ') && b.startsWith('http ')) return false;
    if (a.includes('缺少关键字') || a.includes('包含禁用关键字') || a.includes('禁用关键字')) return false;
    if (b.includes('超时') || b.includes('解析失败') || b.includes('连接') || b.includes('证书') || b.includes('网络')) return false;
    return true;
  }, [getDisplayText]);

  const measureVisible = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { count: 0, gap: CONFIG.MIN_BLOCK_GAP };
    
    const style = getComputedStyle(el);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    const inner = el.clientWidth - paddingLeft - paddingRight;
    
    const count = Math.max(1, Math.floor((inner + CONFIG.MIN_BLOCK_GAP) / (CONFIG.BLOCK_WIDTH + CONFIG.MIN_BLOCK_GAP)));
    
    let actualGap = CONFIG.MIN_BLOCK_GAP;
    if (count > 1) {
      const totalBlockWidth = count * CONFIG.BLOCK_WIDTH;
      const availableGapSpace = inner - totalBlockWidth;
      actualGap = availableGapSpace / (count - 1);
      actualGap = Math.max(CONFIG.MIN_BLOCK_GAP, Math.min(CONFIG.MAX_BLOCK_GAP, actualGap));
    }
    
    setVisibleCount(count);
    setBlockGap(actualGap);
    return { count, gap: actualGap };
  }, []);

  const drawRoundedRect = useCallback((ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }, []);

  const blocksToRender = useMemo(() => {
    if (visibleCount === 0) return [];
    
    if (!history || history.length === 0) {
      return Array.from({ length: visibleCount }, () => ({ 
        status: 'empty', 
        timestamp: null, 
        responseTime: 0 
      }));
    }

    const tail = history.slice(-visibleCount);
    const pad = visibleCount - tail.length;

    if (pad > 0) {
      const emptyBlocks = Array.from({ length: pad }, () => ({ 
        status: 'empty', 
        timestamp: null, 
        responseTime: 0 
      }));
      return [...emptyBlocks, ...tail];
    }

    return tail;
  }, [history, visibleCount]);


  const drawCanvas = useCallback((blocks) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const activeBlocks = blocks ?? blocksRef.current;
    if (!canvas || !activeBlocks.length) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = window.devicePixelRatio || 1;
   
    const containerRect = container?.getBoundingClientRect();
    const baseRect = (containerRect && containerRect.width > 0 && containerRect.height > 0)
      ? containerRect
      : canvas.getBoundingClientRect();
    if (!baseRect || baseRect.width <= 0 || baseRect.height <= 0) return;

    canvas.width = baseRect.width * dpr;
    canvas.height = baseRect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, baseRect.width, baseRect.height);
    
    const isDark = document.documentElement.classList.contains('dark');
    const blockHeight = baseRect.height;
    
    activeBlocks.forEach((record, index) => {
      const x = index * (CONFIG.BLOCK_WIDTH + blockGap);
      const { bg: color } = getBlockColors(record, isDark);

      ctx.save();
      

      const hi = hoveredIndexRef.current;
      if (hi !== null && hi !== index && record.status !== 'empty') {
        ctx.globalAlpha = 0.35;
      } else {
        ctx.globalAlpha = 1;
      }
      
      ctx.fillStyle = color;


      if (record.status !== 'empty') {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
        ctx.shadowBlur = 1.5;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0.5;
      }

      drawRoundedRect(ctx, x, 0, CONFIG.BLOCK_WIDTH, blockHeight, CONFIG.BLOCK_RADIUS);
      ctx.fill();
      ctx.restore();
    });
  }, [blockGap, getBlockColors, drawRoundedRect]);

  useEffect(() => {
    hoveredIndexRef.current = hoveredBlock ? hoveredBlock.index : null;
  }, [hoveredBlock]);

  useLayoutEffect(() => {
    measureVisible();
  }, [measureVisible]);


  useEffect(() => {
    const loadHistory = async () => {
      try {
        const cachedData = getCachedHistory(siteId);
        const historyList = Array.isArray(cachedData?.history) ? cachedData.history : [];

        if (historyList.length === 0 && !historyLoading && !fetchAttemptRef.current) {
          fetchAttemptRef.current = true;
          try {
            await fetchHistoryBatch(undefined, true);
          } catch (error) {
            console.warn('强制刷新历史数据失败:', error);
          } finally {
            fetchAttemptRef.current = false;
          }
        }

        const realHistory = historyList.slice(0, CONFIG.MAX_HISTORY).reverse();
        setHistory(realHistory);
      } catch (error) {
        console.error('加载历史失败:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [siteId, getCachedHistory, historyLoading, fetchHistoryBatch, historyCache]);


  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        measureVisible();
      }, 100);
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [measureVisible]);

  useEffect(() => {
    const themeObserver = new MutationObserver(() => {
      if (blocksRef.current.length > 0) {
        drawCanvas(blocksRef.current);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => themeObserver.disconnect();
  }, [drawCanvas]);

  useEffect(() => {
    blocksRef.current = blocksToRender;
    if (blocksToRender.length > 0) {
      drawCanvas(blocksToRender);
    }
  }, [blocksToRender, drawCanvas]);

  useEffect(() => {
    if (!onAverageResponseTime || blocksToRender.length === 0) return;
    
    const validBlocks = blocksToRender.filter(block => block.status !== 'empty');
    if (validBlocks.length === 0) return;
    
    const totalResponseTime = validBlocks.reduce((sum, block) => sum + (block.responseTime || 0), 0);
    const average = Math.round(totalResponseTime / validBlocks.length);
    onAverageResponseTime(average);
  }, [blocksToRender, onAverageResponseTime]);

  const updateHoverFromPoint = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const blocks = blocksRef.current;
    if (y < 0 || y > rect.height || !blocks.length) return;

    const cell = CONFIG.BLOCK_WIDTH + blockGap;
    const idx = Math.floor(x / cell);
    if (idx < 0 || idx >= blocks.length) return;

    const slotStart = idx * cell;
    const insideBlockX = x - slotStart;

    const targetIndex = insideBlockX <= CONFIG.BLOCK_WIDTH ? idx : (hoveredIndexRef.current ?? null);

    if (targetIndex === null || targetIndex < 0 || targetIndex >= blocks.length) return;

    const record = blocks[targetIndex];
    if (record.status === 'empty') return;

    if (hoveredIndexRef.current === targetIndex) return;

    const blockX = targetIndex * cell;
    const blockCenterAbsolute = rect.left + blockX + CONFIG.BLOCK_WIDTH / 2;

    const date = new Date(record.timestamp);
    const dateString = date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '-');
    const timeString = date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    hoveredIndexRef.current = targetIndex;
    setHoveredBlock({
      index: targetIndex,
      record,
      absoluteBlockCenter: blockCenterAbsolute,
      centerOffset: blockX + CONFIG.BLOCK_WIDTH / 2,
      dateString,
      timeString
    });
    drawCanvas(blocks);
  }, [blockGap, drawCanvas]);

  const handlePointerMove = useCallback((e) => {
    updateHoverFromPoint(e.clientX, e.clientY);
  }, [updateHoverFromPoint]);

  const handlePointerDown = useCallback((e) => {
    updateHoverFromPoint(e.clientX, e.clientY);
    if (e.pointerType === 'touch') {
      touchActiveRef.current = true;
    }
  }, [updateHoverFromPoint]);

  const handlePointerUp = useCallback((e) => {
    if (e.pointerType === 'touch') {
      requestAnimationFrame(() => {
        touchActiveRef.current = false;
      });
    }
  }, []);

  const handlePointerLeave = useCallback((e) => {
    if (touchActiveRef.current || e?.pointerType === 'touch') return;
    if (hoveredIndexRef.current !== null || hoveredBlock) {
      hoveredIndexRef.current = null;
      setHoveredBlock(null);
      drawCanvas(blocksRef.current);
    }
  }, [hoveredBlock, drawCanvas]);

  const handlePointerCancel = useCallback(() => {
    touchActiveRef.current = false;
    hoveredIndexRef.current = null;
    setHoveredBlock(null);
    drawCanvas(blocksRef.current);
  }, [drawCanvas]);


  useEffect(() => {
    const handlePointerDownOutside = (event) => {
      const container = containerRef.current;
      if (!container || container.contains(event.target)) return;
      if (hoveredIndexRef.current !== null) {
        hoveredIndexRef.current = null;
        setHoveredBlock(null);
        drawCanvas(blocksRef.current);
      }
      touchActiveRef.current = false;
    };

    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside, true);
  }, [drawCanvas]);

  const tooltipStyle = useMemo(() => {
    if (!hoveredBlock || !containerRef.current) return null;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const tooltipWidth = 200;

    const computedStyle = getComputedStyle(container);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
    const borderRight = parseFloat(computedStyle.borderRightWidth) || 0;

    const blockCenterAbsolute = hoveredBlock.absoluteBlockCenter;
    const blockCenterRelative = borderLeft + (hoveredBlock.centerOffset ?? 0) + paddingLeft;

    const contentLeftAbsolute = containerRect.left + borderLeft + paddingLeft;
    const contentRightAbsolute = containerRect.right - borderRight - paddingRight;

    const tooltipLeftAbsolute = blockCenterAbsolute - tooltipWidth / 2;
    const tooltipRightAbsolute = blockCenterAbsolute + tooltipWidth / 2;

    const viewportLeft = 16;
    const viewportRight = window.innerWidth - 16;
    const margin = 16;

    const containerInnerLeft = Math.max(contentLeftAbsolute, viewportLeft);
    const containerInnerRight = Math.min(contentRightAbsolute, viewportRight);

    const style = {
      position: 'absolute',
      bottom: '100%',
      marginBottom: '8px',
      pointerEvents: 'none',
      zIndex: 9999
    };

    if (tooltipLeftAbsolute < containerInnerLeft - margin) {
      style.left = `${paddingLeft}px`;
    } else if (tooltipRightAbsolute > containerInnerRight + margin) {
      style.right = `${paddingRight}px`;
    } else {
      style.left = `${blockCenterRelative}px`;
      style.transform = 'translateX(-50%)';
    }

    return style;
  }, [hoveredBlock]);

  return (
    <div 
      ref={containerRef} 
      className="relative flex justify-center gap-1 h-12 items-center rounded-xl py-2 overflow-visible"
      onPointerLeave={handlePointerLeave}
    >
      <canvas
        ref={canvasRef}
        className="cursor-pointer"
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block',
          imageRendering: '-webkit-optimize-contrast',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
      />
      
      <AnimatePresence>
        {hoveredBlock && tooltipStyle && (
          <div className="absolute pointer-events-none isolate" style={tooltipStyle}>
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="px-4 py-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl whitespace-nowrap shadow-2xl border border-slate-200/80 dark:border-slate-700/50"
            >
              <div className="flex flex-col items-center gap-0.5 mb-1.5">
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  {hoveredBlock.dateString}
                </div>
                <div className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent tracking-tight">
                  {hoveredBlock.timeString}
                </div>
              </div>
              
              <div className="flex items-center gap-3 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <div className={`absolute w-3 h-3 ${getStatusConfig(hoveredBlock.record.status).dotColor} rounded-full animate-ping opacity-60`}></div>
                    <div className={`relative w-2 h-2 ${getStatusConfig(hoveredBlock.record.status).dotColor} rounded-full shadow-lg`}></div>
                  </div>
                  <span className={`text-xs font-bold ${getStatusConfig(hoveredBlock.record.status).color}`}>
                    {getDisplayText(hoveredBlock.record)}
                  </span>
                </div>
                
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700"></div>
                
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {hoveredBlock.record.responseTime}ms
                </div>
              </div>

              {shouldShowMessage(hoveredBlock.record) && (
                <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 max-w-[220px] truncate" title={hoveredBlock.record.message}>
                  {hoveredBlock.record.message}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
