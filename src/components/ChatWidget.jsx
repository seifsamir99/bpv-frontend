import React, { useEffect } from 'react';

export default function ChatWidget() {
  const webhookUrl = 'https://n8n.srv1012058.hstgr.cloud/webhook/6275a689-9206-4c71-935c-e6071395495b/chat';

  useEffect(() => {
    // Load n8n chat styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.n8n.io/chat/style.css';
    document.head.appendChild(link);

    // Load and initialize n8n chat widget using dynamic import
    const initChat = async () => {
      try {
        const { createChat } = await import('https://cdn.n8n.io/chat/chat.bundle.es.js');
        createChat({
          webhookUrl: webhookUrl,
          mode: 'window',
          showWelcomeScreen: true,
          initialMessages: [
            'Hi! I am your BPV Assistant. How can I help you today?'
          ],
          i18n: {
            en: {
              title: 'BPV Assistant',
              subtitle: 'Ask me anything about your vouchers',
              footer: '',
              getStarted: 'Start Chat',
              inputPlaceholder: 'Type your message...',
            },
          },
        });
      } catch (error) {
        console.error('Failed to load n8n chat widget:', error);
      }
    };

    initChat();

    // Cleanup
    return () => {
      link.remove();
      // Remove n8n chat widget elements
      const chatWidget = document.querySelector('.n8n-chat');
      if (chatWidget) chatWidget.remove();
    };
  }, []);

  // n8n chat widget renders itself, no need for custom UI
  return null;
}
