// Browser notification support

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

export function showMessageNotification(senderName: string, messagePreview: string): void {
  if (Notification.permission !== 'granted') {
    return;
  }

  // Don't show notification if tab is active
  if (document.visibilityState === 'visible') {
    return;
  }

  const notification = new Notification(`New message from ${senderName}`, {
    body: messagePreview,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'chat-message',
    requireInteraction: false,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
}

export function getNotificationStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}
