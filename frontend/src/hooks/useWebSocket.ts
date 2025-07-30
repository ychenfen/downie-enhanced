import { useState, useEffect, useRef, useCallback } from 'react';
import { UseWebSocketReturn, WebSocketMessage } from '../types';

export const useWebSocket = (url: string): UseWebSocketReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(url);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log('WebSocket connected');
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          
          // Handle pong response to ping
          if (message.type === 'pong') {
            console.log('Received pong from server');
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.current.onclose = (event) => {
        setIsConnected(false);
        console.log('WebSocket disconnected:', event.code, event.reason);
        
        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          console.log(`Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts})...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay * reconnectAttempts.current);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      try {
        ws.current.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    } else {
      console.warn('WebSocket is not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close(1000, 'Manual disconnect');
      ws.current = null;
    }
    
    setIsConnected(false);
    reconnectAttempts.current = 0;
  }, []);

  // Initialize connection
  useEffect(() => {
    connect();
    
    // Set up periodic ping to keep connection alive
    const pingInterval = setInterval(() => {
      if (isConnected) {
        sendMessage({ type: 'ping' });
      }
    }, 30000); // Send ping every 30 seconds
    
    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [connect, disconnect, isConnected, sendMessage]);

  // Handle page visibility change to reconnect when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isConnected) {
        console.log('Page became visible, attempting to reconnect WebSocket');
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connect, isConnected]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    disconnect
  };
};