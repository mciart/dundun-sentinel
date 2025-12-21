import { sendWeComNotification } from './wecom.js';
import { sendEmailNotification } from './email.js';

function shouldNotifyEvent(cfg, type) {
  if (!cfg || cfg.enabled !== true) return false;
  if (Array.isArray(cfg.events)) return cfg.events.includes(type);
  return true;
}

export async function sendNotifications(env, incident, site, cfg, returnResults = false) {
  if (!shouldNotifyEvent(cfg, incident.type)) {
    return returnResults ? { results: {} } : undefined;
  }
  
  const results = {};
  const promises = [];
  
  if (cfg?.channels?.wecom?.enabled && cfg.channels.wecom.webhook) {
    promises.push(
      sendWeComNotification(cfg.channels.wecom.webhook, incident, site)
        .then(() => ({ channel: 'wecom', success: true }))
        .catch(err => ({ channel: 'wecom', success: false, error: err.message }))
    );
  }
  if (cfg?.channels?.email?.enabled && cfg.channels.email.to) {
    promises.push(
      sendEmailNotification(env, cfg, incident, site)
        .then(() => ({ channel: 'email', success: true }))
        .catch(err => ({ channel: 'email', success: false, error: err.message }))
    );
  }
  
  if (promises.length) {
    const settled = await Promise.all(promises);
    for (const result of settled) {
      results[result.channel] = { success: result.success, error: result.error };
    }
  }
  
  return returnResults ? { results } : undefined;
}
