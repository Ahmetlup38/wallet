import { io, Socket } from 'socket.io-client';
import { createLogger } from '../../utils/log';

const logger = createLogger('ai-chat-socket');

const SOCKET_URL = 'https://www.zilla.biz:3003';

export interface ServerToClientEvents {
    session_created: (data: { sessionId: string }) => void;
    session_joined: (data: {
        sessionId: string;
        serverHistory: any[];
        hasPendingRequest: boolean;
        pendingRequestId?: string | null;
        message: string;
    }) => void;
    receive_message: (data: {
        text: string;
        isBot: boolean;
        timestamp: string;
        formatted?: boolean;
    }) => void;
    stream_start: (data: {
        messageId: string;
        isBot: boolean;
        timestamp?: string;
    }) => void;
    stream_chunk: (data: {
        messageId: string;
        chunk: string;
        isBot: boolean;
    }) => void;
    stream_end: (data: {
        messageId: string;
        fullText: string;
    }) => void;
    error: (data: {
        message: string;
    }) => void;
}

export interface ClientToServerEvents {
    new_session: (data: { userId: string, language: string }) => void;
    join_session: (data: { sessionId: string, language: string }) => void;
    send_message: (data: {
        message: string;
        sessionId: string;
        requestId?: string;
    }) => void;
    history: (data: {
        sessionId: string;
        messages: any[];
    }) => void;
    clear_userid: (data: { sessionId: string }) => void;
}

export type AIChatSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createAIChatSocket(): AIChatSocket {
    logger.log(`Creating Socket.IO client for: ${SOCKET_URL}`);

    const socket: AIChatSocket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
        autoConnect: false,
    });

    socket.on('connect', () => {
        logger.log('Socket.IO connected successfully');
    });

    socket.on('disconnect', (reason: string) => {
        logger.log(`Socket.IO disconnected: ${reason}`);
    });

    socket.on('connect_error', (error: Error) => {
        logger.warn(`Socket.IO connection error: ${error.message}`);
    });

    return socket;
}
