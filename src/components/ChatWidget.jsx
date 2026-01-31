import { useEffect } from 'react';
import '@n8n/chat/style.css';
import { createChat } from '@n8n/chat';

export default function ChatWidget() {
  useEffect(() => {
    // Add custom styles for colorful chat widget
    const style = document.createElement('style');
    style.textContent = `
      /* Chat toggle button - gradient style */
      .n8n-chat .chat-toggle {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%) !important;
        box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4) !important;
        border: none !important;
        width: 60px !important;
        height: 60px !important;
        transition: transform 0.2s, box-shadow 0.2s !important;
      }

      .n8n-chat .chat-toggle:hover {
        transform: scale(1.1) !important;
        box-shadow: 0 6px 20px rgba(139, 92, 246, 0.5) !important;
      }

      /* Chat window header */
      .n8n-chat .chat-header {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
        border-bottom: none !important;
      }

      .n8n-chat .chat-header h1 {
        color: white !important;
        font-weight: 600 !important;
      }

      .n8n-chat .chat-header p {
        color: rgba(255, 255, 255, 0.9) !important;
      }

      /* Welcome screen */
      .n8n-chat .welcome-screen {
        background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%) !important;
      }

      .n8n-chat .welcome-screen h1 {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
        -webkit-background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
        background-clip: text !important;
      }

      /* Start chat button */
      .n8n-chat .get-started-button {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
        border: none !important;
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3) !important;
        transition: transform 0.2s, box-shadow 0.2s !important;
      }

      .n8n-chat .get-started-button:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4) !important;
      }

      /* Send button */
      .n8n-chat .chat-input button {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
        border: none !important;
      }

      .n8n-chat .chat-input button:hover {
        opacity: 0.9 !important;
      }

      /* Bot messages */
      .n8n-chat .chat-message.bot .message-content {
        background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%) !important;
        border: 1px solid #c7d2fe !important;
      }

      /* User messages */
      .n8n-chat .chat-message.user .message-content {
        background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%) !important;
        color: white !important;
      }

      /* Chat container */
      .n8n-chat .chat-container {
        border-radius: 16px !important;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15) !important;
        overflow: hidden !important;
      }

      /* Input field */
      .n8n-chat .chat-input input {
        border: 2px solid #e2e8f0 !important;
        border-radius: 12px !important;
        transition: border-color 0.2s !important;
      }

      .n8n-chat .chat-input input:focus {
        border-color: #8b5cf6 !important;
        box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1) !important;
      }

      /* Close button */
      .n8n-chat .chat-header button {
        color: white !important;
        opacity: 0.8 !important;
      }

      .n8n-chat .chat-header button:hover {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);

    createChat({
      webhookUrl: 'https://n8n.srv1012058.hstgr.cloud/webhook/6275a689-9206-4c71-935c-e6071395495b/chat',
      mode: 'window',
      showWelcomeScreen: true,
      initialMessages: ['Hi! I am your BPV Assistant. How can I help you today?'],
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

    return () => {
      style.remove();
    };
  }, []);

  return null;
}
