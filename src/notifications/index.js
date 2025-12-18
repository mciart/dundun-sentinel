import { sendWeComNotification } from './wecom.js';
import { sendEmailNotification } from './email.js';

function shouldNotifyEvent(cfg, type) {
  if (!cfg || cfg.enabled !== true) return false;
  if (Array.isArray(cfg.events)) return cfg.events.includes(type);
  return true;
}

export async function sendNotifications(env, incident, site, cfg) {
  if (!shouldNotifyEvent(cfg, incident.type)) return;
  const promises = [];
  if (cfg?.channels?.wecom?.enabled && cfg.channels.wecom.webhook) {
    promises.push(sendWeComNotification(cfg.channels.wecom.webhook, incident, site));
  }
  if (cfg?.channels?.email?.enabled && cfg.channels.email.to) {
    promises.push(sendEmailNotification(env, cfg, incident, site));
  }
  if (promises.length) {
    await Promise.allSettled(promises);
  }
}
