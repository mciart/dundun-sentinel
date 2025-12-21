import { formatDuration } from '../utils.js';
import { connect } from 'cloudflare:sockets';

function stateSiteName(cfg) {
  return (cfg && cfg.siteName) || '炖炖哨兵';
}

export async function sendEmailNotification(env, cfg, incident, site) {
  const emailCfg = cfg?.channels?.email || {};
  if (!emailCfg.enabled || !emailCfg.to) return;

  // 判断使用哪种方式发送邮件
  const smtpHost = emailCfg.smtpHost;
  const resendApiKey = emailCfg.resendApiKey;
  
  if (!smtpHost && !resendApiKey) {
    console.warn('邮件通知已启用但未配置 SMTP 或 Resend API Key');
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

  const subject = `炖炖哨兵 - ${site.name} ${prefix}`;
  
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

  // 优先使用 SMTP，否则使用 Resend API
  if (smtpHost) {
    await sendViaSMTP(emailCfg, fromEmail, subject, html);
  } else {
    await sendViaResend(resendApiKey, emailCfg.to, fromEmail, subject, html);
  }
}

/**
 * 通过 Resend API 发送邮件
 */
async function sendViaResend(apiKey, to, from, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend 邮件发送失败:', response.status, errorText);
    throw new Error(`Resend 发送失败: ${response.status}`);
  }
  
  console.log('📧 Resend 邮件发送成功');
}

/**
 * 通过 SMTP 发送邮件（使用 Cloudflare Sockets）
 */
async function sendViaSMTP(emailCfg, from, subject, html) {
  const { smtpHost, smtpPort = 587, smtpUser, smtpPass, smtpSecure = 'starttls', to } = emailCfg;
  
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error('SMTP 配置不完整');
  }
  
  // 根据加密方式决定连接方式
  // ssl: 直接 TLS 连接 (465)
  // starttls: 先明文连接再升级 (587)
  // none: 明文连接
  const useDirectTLS = smtpSecure === 'ssl';
  const useSTARTTLS = smtpSecure === 'starttls';
  
  console.log(`📧 连接 SMTP 服务器: ${smtpHost}:${smtpPort} (加密: ${smtpSecure})`);
  
  // Cloudflare Sockets 要求：
  // - ssl: secureTransport: 'on' (直接 TLS)
  // - starttls: secureTransport: 'starttls' (先明文后升级)
  // - none: 不设置 (明文)
  const socketOptions = useDirectTLS 
    ? { secureTransport: 'on' } 
    : useSTARTTLS 
      ? { secureTransport: 'starttls' } 
      : {};
  
  let socket = connect({
    hostname: smtpHost,
    port: smtpPort
  }, socketOptions);
  
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  
  let writer = socket.writable.getWriter();
  let reader = socket.readable.getReader();
  
  // 读取响应
  async function readResponse() {
    const { value } = await reader.read();
    const response = decoder.decode(value);
    console.log('SMTP <', response.trim());
    return response;
  }
  
  // 发送命令
  async function sendCommand(cmd, hideLog = false) {
    if (!hideLog) {
      console.log('SMTP >', cmd.trim());
    }
    await writer.write(encoder.encode(cmd + '\r\n'));
    return await readResponse();
  }
  
  try {
    // 等待服务器欢迎信息
    await readResponse();
    
    // EHLO
    let response = await sendCommand(`EHLO localhost`);
    
    // STARTTLS（如果配置为 starttls 且服务器支持）
    if (useSTARTTLS && response.includes('STARTTLS')) {
      await sendCommand('STARTTLS');
      
      // 释放旧的 reader/writer
      writer.releaseLock();
      reader.releaseLock();
      
      // 升级到 TLS - 返回新的加密 socket
      socket = await socket.startTls();
      
      // 获取新的 reader/writer
      writer = socket.writable.getWriter();
      reader = socket.readable.getReader();
      
      response = await sendCommand(`EHLO localhost`);
    }
    
    // 认证
    await sendCommand('AUTH LOGIN');
    await sendCommand(btoa(smtpUser), true);
    response = await sendCommand(btoa(smtpPass), true);
    
    if (!response.startsWith('235')) {
      throw new Error('SMTP 认证失败: ' + response);
    }
    
    // 发送邮件
    await sendCommand(`MAIL FROM:<${from}>`);
    await sendCommand(`RCPT TO:<${to}>`);
    await sendCommand('DATA');
    
    // 邮件内容
    const boundary = `----=_Part_${Date.now()}`;
    const emailContent = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(html))),
      `--${boundary}--`,
      `.`
    ].join('\r\n');
    
    response = await sendCommand(emailContent);
    
    if (!response.startsWith('250')) {
      throw new Error('邮件发送失败: ' + response);
    }
    
    await sendCommand('QUIT');
    console.log('📧 SMTP 邮件发送成功');
    
  } finally {
    try {
      writer.releaseLock();
      reader.releaseLock();
      await socket.close();
    } catch (e) {
      // 忽略关闭错误
    }
  }
}


