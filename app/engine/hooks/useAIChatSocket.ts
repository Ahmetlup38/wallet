import { useCallback, useEffect, useRef, useState } from 'react';
import { createAIChatSocket, AIChatSocket } from '../ai/socket';
import { storage } from '../../storage/storage';
import { t } from '../../i18n/t';

export interface AIChatMessage {
    text: string;
    isBot: boolean;
    timestamp: string;
    id?: string;
    formatted?: boolean;
    streaming?: boolean;
}

export interface UseAIChatSocketOptions {
    userId: string;
    autoConnect?: boolean;
    persistHistory?: boolean;
}

export interface UseAIChatSocketResult {
    // Connection state
    isConnected: boolean;
    isConnecting: boolean;

    // Session state
    sessionId: string | null;
    messages: AIChatMessage[];

    // Streaming state
    isStreaming: boolean;
    streamingMessageId: string | null;

    // Error state
    error: string | null;

    // Actions
    sendMessage: (message: string) => void;
    clearHistory: () => void;
    connect: () => void;
    disconnect: () => void;

    // Pending request recovery
    hasPendingRequest: boolean;
    pendingRequestId: string | null;
}

const STORAGE_KEY_PREFIX = 'ai_chat_';

export function useAIChatSocket(options: UseAIChatSocketOptions): UseAIChatSocketResult {
    const { userId, autoConnect = true, persistHistory = true } = options;

    const socketRef = useRef<AIChatSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

    // Storage keys
    const sessionStorageKey = `${STORAGE_KEY_PREFIX}session_${userId}`;
    const historyStorageKey = `${STORAGE_KEY_PREFIX}history_${userId}`;
    const pendingMessageKey = `${STORAGE_KEY_PREFIX}pending_${userId}`;

    // Load persisted data
    useEffect(() => {
        if (persistHistory) {
            try {
                const savedSession = storage.getString(sessionStorageKey);
                if (savedSession) {
                    setSessionId(savedSession);
                }

                const savedHistory = storage.getString(historyStorageKey);
                if (savedHistory) {
                    const parsedHistory = JSON.parse(savedHistory);
                    setMessages(parsedHistory);
                }
            } catch (e) {
                console.warn('Failed to load persisted chat data:', e);
            }
        }
    }, [sessionStorageKey, historyStorageKey, persistHistory]);

    // Save data to storage
    const saveToStorage = useCallback((key: string, data: any) => {
        if (persistHistory) {
            try {
                storage.set(key, typeof data === 'string' ? data : JSON.stringify(data));
            } catch (e) {
                console.warn('Failed to save to storage:', e);
            }
        }
    }, [persistHistory]);

    // Initialize socket and event listeners
    useEffect(() => {
        if (!socketRef.current) {
            socketRef.current = createAIChatSocket();
        }

        const socket = socketRef.current;

        // Connection events
        function onConnect() {
            console.log('[useAIChatSocket] onConnect');
            setIsConnected(true);
            setIsConnecting(false);
            setError(null);

            // Create or join session after connection
            if (sessionId) {
                socket.emit('join_session', { sessionId });
            } else {
                socket.emit('new_session');
            }
        }

        function onDisconnect() {
            console.log('[useAIChatSocket] onDisconnect');
            setIsConnected(false);
            setIsConnecting(false);
        }

        function onConnectError(error: Error) {
            console.log('[useAIChatSocket] onConnectError');
            setError(error.message);
            setIsConnecting(false);
        }

        // Session events
        function onSessionCreated(data: { sessionId: string }) {
            console.log('[useAIChatSocket] onSessionCreated', data.sessionId);
            setSessionId(data.sessionId);
            saveToStorage(sessionStorageKey, data.sessionId);

            // Send userId after session is created
            socket.emit('send_message', {
                message: userId,
                sessionId: data.sessionId
            });
        }

        function onSessionJoined(data: {
            sessionId: string;
            serverHistory: any[];
            hasPendingRequest: boolean;
            pendingRequestId?: string | null;
        }) {
            console.log('[useAIChatSocket] onSessionJoined', { socket: !!socket, sessionId: data.sessionId, serverHistory: data.serverHistory, hasPendingRequest: data.hasPendingRequest, pendingRequestId: data.pendingRequestId });
            setSessionId(data.sessionId);
            setHasPendingRequest(data.hasPendingRequest);
            setPendingRequestId(data.pendingRequestId || null);

            // Use server history if available and local history is empty
            if (data.serverHistory && data.serverHistory.length > 0 && messages.length === 0) {
                setMessages(data.serverHistory);
                saveToStorage(historyStorageKey, data.serverHistory);
            }

            // Send userId after joining session (if no history exists)
            if (!data.serverHistory || data.serverHistory.length === 0) {
                socket.emit('send_message', {
                    message: userId,
                    sessionId: data.sessionId
                });
            }

            // Handle pending request recovery
            if (data.hasPendingRequest && data.pendingRequestId) {
                const pendingMessage = storage.getString(pendingMessageKey);
                if (pendingMessage) {
                    socket.emit('send_message', {
                        message: pendingMessage,
                        sessionId: data.sessionId,
                        requestId: data.pendingRequestId
                    });
                    storage.delete(pendingMessageKey);
                }
            }

            saveToStorage(sessionStorageKey, data.sessionId);
        }

        // Message events
        function onReceiveMessage(message: AIChatMessage) {
            console.log('[useAIChatSocket] onReceiveMessage', message);
            setMessages(prev => {
                const updated = [...prev, message];
                saveToStorage(historyStorageKey, updated);
                return updated;
            });
        }

        // Streaming events
        function onStreamStart(data: { messageId: string; isBot: boolean; timestamp?: string }) {
            console.log('[useAIChatSocket] onStreamStart', data);
            setIsStreaming(true);
            setStreamingMessageId(data.messageId);

            const streamingMessage: AIChatMessage = {
                id: data.messageId,
                text: '',
                isBot: true,
                timestamp: data.timestamp || new Date().toISOString(),
                streaming: true
            };

            setMessages(prev => {
                const updated = [...prev, streamingMessage];
                saveToStorage(historyStorageKey, updated);
                return updated;
            });
        }

        function onStreamChunk(data: { messageId: string; chunk: string }) {
            console.log('[useAIChatSocket] onStreamChunk', data);
            setMessages(prev => prev.map(msg =>
                msg.id === data.messageId
                    ? { ...msg, text: (msg.text || '') + data.chunk }
                    : msg
            ));
        }

        function onStreamEnd(data: { messageId: string; fullText: string }) {
            console.log('[useAIChatSocket] onStreamEnd', data);
            setIsStreaming(false);
            setStreamingMessageId(null);

            setMessages(prev => {
                const updated = prev.map(msg =>
                    msg.id === data.messageId
                        ? { ...msg, text: data.fullText, streaming: false }
                        : msg
                );
                saveToStorage(historyStorageKey, updated);
                return updated;
            });
        }

        // Error handling
        function onError(errorData: { message: string }) {
            console.log('[useAIChatSocket] onError', errorData);
            setError(errorData.message);
        }

        // Register event listeners
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('session_created', onSessionCreated);
        socket.on('session_joined', onSessionJoined);
        socket.on('receive_message', onReceiveMessage);
        socket.on('stream_start', onStreamStart);
        socket.on('stream_chunk', onStreamChunk);
        socket.on('stream_end', onStreamEnd);
        socket.on('error', onError);

        // Cleanup function
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('session_created', onSessionCreated);
            socket.off('session_joined', onSessionJoined);
            socket.off('receive_message', onReceiveMessage);
            socket.off('stream_start', onStreamStart);
            socket.off('stream_chunk', onStreamChunk);
            socket.off('stream_end', onStreamEnd);
            socket.off('error', onError);
        };
    }, [sessionId, messages.length, saveToStorage, sessionStorageKey, historyStorageKey, pendingMessageKey]);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && socketRef.current && !socketRef.current.connected) {
            setIsConnecting(true);
            socketRef.current.connect();
        }

        return () => {
            // Disconnect when component unmounts
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [autoConnect]);

    // Actions
    const sendMessage = useCallback((message: string) => {
        console.log('[useAIChatSocket] sendMessage', { message, connected: socketRef.current?.connected, sessionId });
        if (!socketRef.current?.connected || !sessionId) {
            setError(t('aiChat.notConnected'));
            return;
        }

        if (!message.trim()) {
            return;
        }

        // Validate message length (max 1000 chars as per API docs)
        if (message.length > 1000) {
            setError(t('aiChat.messageTooLong'));
            return;
        }

        // Add user message to history immediately
        const userMessage: AIChatMessage = {
            text: message.trim(),
            isBot: false,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => {
            const updated = [...prev, userMessage];
            saveToStorage(historyStorageKey, updated);
            return updated;
        });

        // Save pending message for recovery
        saveToStorage(pendingMessageKey, message.trim());

        console.log('[useAIChatSocket] sendMessage, emit', { socket: !!socketRef.current, message: message.trim(), sessionId });

        setError(null);

        socketRef.current.emit('send_message', {
            message: message.trim(),
            sessionId: sessionId
        });

        console.log('[useAIChatSocket] sendMessage, emit done');

    }, [sessionId, saveToStorage, historyStorageKey, pendingMessageKey]);

    const clearHistory = useCallback(() => {
        setMessages([]);
        if (persistHistory) {
            storage.delete(historyStorageKey);
        }
    }, [historyStorageKey, persistHistory]);

    const connect = useCallback(() => {
        if (socketRef.current && !socketRef.current.connected) {
            setIsConnecting(true);
            socketRef.current.connect();
        }
    }, []);

    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
        }
        setIsConnected(false);
        setIsConnecting(false);
    }, []);

    // Sync history with server periodically
    useEffect(() => {
        if (isConnected && messages.length > 0 && socketRef.current && sessionId) {
            socketRef.current.emit('history', {
                sessionId,
                messages
            });
        }
    }, [isConnected, messages, sessionId]);

    return {
        // Connection state
        isConnected,
        isConnecting,

        // Session state
        sessionId,
        messages,

        // Streaming state
        isStreaming,
        streamingMessageId,

        // Error state
        error,

        // Actions
        sendMessage,
        clearHistory,
        connect,
        disconnect,

        // Pending request recovery
        hasPendingRequest,
        pendingRequestId
    };
}
