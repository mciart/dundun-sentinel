function stateSiteName(cfg) {
  return (cfg && cfg.siteName) || '炖炖守望';
}

export async function sendEmailNotification(env, cfg, incident, site) {
  const emailCfg = cfg?.channels?.email || {};
  if (!emailCfg.enabled || !emailCfg.to) return;

  const resendApiKey = emailCfg.resendApiKey;
  if (!resendApiKey) {
    console.warn('邮件通知已启用但未配置 Resend API Key');
    return;
  }
  
  const fromEmail = emailCfg.from && emailCfg.from.includes('@') ? emailCfg.from : 'onboarding@resend.dev';
  const siteName = stateSiteName(cfg);

  let prefix, headerBg, headerIcon, headerTitle, siteTitle, message, boxBg, boxBorder, labelColor;
  const dataRows = [];
  
  const notifyTime = new Date(incident.createdAt).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai'
  });

  if (incident.type === 'down') {
    prefix = '异常了';
    headerBg = '#fb7185';
    headerIcon = '😵';
    headerTitle = '哎呀，出问题了！';
    siteTitle = `${site.name} 挂掉了`;
    message = `看起来你的网站刚刚由于 <b>${incident.message || '未知错误'}</b> 倒下了。<br>希望能尽快修复它！`;
    boxBg = '#fffbeb';
    boxBorder = '#d97706';
    labelColor = '#b45309';
    dataRows.push(['⏰ 通知时间', notifyTime]);
    if (incident.responseTime) {
      dataRows.push(['🐢 响应时间', `${incident.responseTime}ms`]);
    }
    dataRows.push(['🔍 错误详情', incident.message || '服务异常']);
  } else if (incident.type === 'recovered') {
    prefix = '恢复了';
    headerBg = '#4ade80';
    headerIcon = '🎉';
    headerTitle = '好耶，复活了！';
    siteTitle = `${site.name} 恢复正常`;
    message = '经过一番折腾，你的网站终于重新上线了！<br>一切看起来都很完美';
    boxBg = '#f0fdf4';
    boxBorder = '#16a34a';
    labelColor = '#15803d';
    if (incident.downDuration) {
      dataRows.push(['⏱️ 异常时长', formatDuration(incident.downDuration)]);
    }
    if (incident.responseTime) {
      dataRows.push(['⚡ 当前响应', `${incident.responseTime}ms`]);
    }
    if (typeof incident.monthlyDownCount === 'number') {
      dataRows.push(['📉 本月异常', `${incident.monthlyDownCount}次`]);
    }
    dataRows.push(['⏰ 恢复时间', notifyTime]);
  } else if (incident.type === 'cert_warning') {
    prefix = '证书快到期';
    headerBg = '#fbbf24';
    headerIcon = '📜';
    headerTitle = '证书快过期啦！';
    siteTitle = site.name;
    const daysLeft = incident.daysLeft ?? 0;
    message = `你的 SSL 证书即将在 <b>${daysLeft}天</b> 后过期。<br>别忘了及时续费哦，不然会有大红锁！`;
    boxBg = '#fff7ed';
    boxBorder = '#ea580c';
    labelColor = '#c2410c';
    if (incident.certIssuer) {
      dataRows.push(['🏢 颁发者', incident.certIssuer]);
    }
    if (incident.certValidTo) {
      const validToDate = new Date(incident.certValidTo);
      const dateStr = validToDate.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Shanghai'
      });
      dataRows.push(['📅 到期时间', dateStr]);
    }
    dataRows.push(['⏳ 剩余天数', `${daysLeft}天`]);
    let nextAlert = '已是最后提醒';
    if (daysLeft > 30) nextAlert = `${daysLeft - 30}天后`;
    else if (daysLeft > 7) nextAlert = `${daysLeft - 7}天后`;
    else if (daysLeft > 1) nextAlert = `${daysLeft - 1}天后`;
    dataRows.push(['🔔 下次提醒', nextAlert]);
  } else {
    return;
  }

  const subject = `炖炖守望 - ${site.name} ${prefix}`;
  
  let dataRowsHtml = '';
  dataRows.forEach((row, i) => {
    const borderBottom = i < dataRows.length - 1 ? 'border-bottom: 1px dashed #e5e7eb;' : '';
    dataRowsHtml += `
      <tr>
        <td style="padding: 10px 0; ${borderBottom} font-weight: bold; color: ${labelColor}; font-size: 14px; white-space: nowrap;">${row[0]}</td>
        <td style="padding: 10px 0; ${borderBottom} font-family: Consolas, monospace; color: #000; font-weight: bold; font-size: 14px; text-align: right;">${row[1]}</td>
      </tr>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; background: #f0f2f5; font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto;">
        <tr>
            <td>
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #ffffff; border-radius: 20px; border: 3px solid #000; box-shadow: 8px 8px 0 #000; overflow: hidden;">
                    <tr>
                        <td style="background: ${headerBg}; padding: 25px; text-align: center; border-bottom: 3px solid #000;">
                            <div style="font-size: 48px; line-height: 1.2;">${headerIcon}</div>
                            <h1 style="font-size: 22px; margin: 12px 0 0 0; color: #000; font-weight: 900;">${headerTitle}</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 30px 25px; text-align: center;">
                            <h2 style="font-size: 20px; font-weight: bold; margin: 0 0 15px; color: #000;">${siteTitle}</h2>
                            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 25px; color: #4b5563;">${message}</p>
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: ${boxBg}; border: 2px dashed ${boxBorder}; border-radius: 12px;">
                                <tr>
                                    <td style="padding: 15px 20px;">
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            ${dataRowsHtml}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 3px solid #000;">
                            <p style="margin: 4px 0;">此邮件由 <b>${siteName}</b> 自动发送</p>
                            <p style="margin: 4px 0;">请勿直接回复本邮件</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${resendApiKey}`
    },
    body: JSON.stringify({
      from: fromEmail,
      to: emailCfg.to,
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend 邮件发送失败:', response.status, errorText);
  }
}

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}天${hours % 24}小时${minutes % 60}分钟`;
  } else if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}
