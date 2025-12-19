import { formatDuration } from '../utils.js';

export async function sendWeComNotification(webhook, incident, site) {
  if (!webhook) return;

  let title, emoji, color;
  if (incident.type === 'recovered') {
    title = '站点恢复通知';
    emoji = '🟩';
    color = 'info'; 
  } else if (incident.type === 'cert_warning') {
    title = '证书到期提醒';
    emoji = '🟧';
    color = 'warning'; 
  } else {
    title = '站点异常通知';
    emoji = '🟥';
    color = 'warning'; 
  }
  
  const lines = [
    `${emoji}<font color="${color}">${title}</font>`,
    ``,
    `> **站点**：${site.name}`,
    `> **详情**：${incident.message}`
  ];
  
  if (incident.type === 'recovered') {
    if (incident.downDuration) {
      const duration = formatDuration(incident.downDuration);
      lines.push(`> **异常时长**：${duration}`);
    }
    if (incident.responseTime) {
      lines.push(`> **当前响应**：${incident.responseTime}ms`);
    }
    if (typeof incident.monthlyDownCount === 'number') {
      lines.push(`> **本月异常**：${incident.monthlyDownCount}次`);
    }
  } else if (incident.type === 'down') {
    if (incident.responseTime) {
      lines.push(`> **响应时间**：${incident.responseTime}ms`);
    }
  } else if (incident.type === 'cert_warning') {
    const daysLeft = incident.daysLeft ?? 0;
    
    if (incident.certIssuer) {
      lines.push(`> **证书颁发者**：${incident.certIssuer}`);
    }
    
    if (incident.certValidTo) {
      const validToDate = new Date(incident.certValidTo);
      const dateStr = validToDate.toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai'  
      });
      lines.push(`> **到期时间**：${dateStr}`);
    }
    

    if (daysLeft > 0) {
      let nextAlert;
      if (daysLeft > 30) {
        nextAlert = `${daysLeft - 30}天后`;
      } else if (daysLeft > 7) {
        nextAlert = `${daysLeft - 7}天后`;
      } else if (daysLeft > 1) {

        nextAlert = `${daysLeft - 1}天后`;
      } else {
        nextAlert = '已是最后提醒';
      }
      lines.push(`> **下次提醒**：${nextAlert}`);
    }
  }
  
  const notifyTime = new Date(incident.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai' 
  });
  lines.push(`> **通知时间**：${notifyTime}`);
  
  const content = lines.join('\n');
  
  await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ msgtype: 'markdown', markdown: { content } })
  });
}


