import React, { useEffect } from 'react';

export default function ChatWidget() {
  useEffect(() => {
    // Load n8n chat styles
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.n8n.io/chat/style.css';
    document.head.appendChild(link);

    // Load n8n chat script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://cdn.n8n.io/chat/chat.bundle.es.js';
    script.onload = () => {
      // Initialize chat after script loads
      if (window.createChat) {
        window.createChat({
          webhookUrl: 'https://n8n.srv1012058.hstgr.cloud/webhook/6275a689-9206-4c71-935c-e6071395495b/chat',
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
      }
    };
    document.body.appendChild(script);

    // Cleanup
    return () => {
      link.remove();
      script.remove();
      const chatWidget = document.querySelector('.n8n-chat');
      if (chatWidget) chatWidget.remove();
    };
  }, []);

  return null;
}
