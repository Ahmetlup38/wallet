import { useEffect, useCallback, useRef } from 'react';
import { useRecoilState } from 'recoil';
import { WalletRequestsWatcher, WalletRequest, WalletRequestEvent } from './WalletRequestsWatcher';
import { useCurrentAddress } from './hooks/appstate/useCurrentAddress';
import { useAppVisible, useNetwork } from './hooks';
import { whalesConnectEndpoint } from './clients';
import { atomFamily } from 'recoil';

// State atom families for wallet requests
export const walletRequestsState = atomFamily<WalletRequest[], string>({
    key: 'walletRequestsState',
    default: (address) => []
});

export const walletRequestsConnectionState = atomFamily<'disconnected' | 'connecting' | 'connected', string>({
    key: 'walletRequestsConnectionState',
    default: (address) => 'disconnected'
});

export type WalletRequestsWatcherState = {
    requests: WalletRequest[];
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
    isConnected: boolean;
};

export type WalletRequestsWatcherActions = {
    addRequest: (request: WalletRequest) => void;
    updateRequest: (requestId: string, updates: Partial<WalletRequest>) => void;
    removeRequest: (requestId: string) => void;
    clearRequests: () => void;
};

export function useWalletRequestsWatcher(): WalletRequestsWatcherState & WalletRequestsWatcherActions {
    const { tonAddressString } = useCurrentAddress();
    const { isTestnet } = useNetwork();
    const appStateVisible = useAppVisible();

    // Use empty string as fallback to avoid undefined key
    const addressKey = tonAddressString || '';
    const [requests, setRequests] = useRecoilState(walletRequestsState(addressKey));
    const [connectionStatus, setConnectionStatus] = useRecoilState(walletRequestsConnectionState(addressKey));

    const watcherRef = useRef<WalletRequestsWatcher | null>(null);
    const currentAddressRef = useRef<string | null>(null);

    // Actions for managing requests
    const addRequest = useCallback((request: WalletRequest) => {
        setRequests(prev => {
            // Avoid duplicates
            const exists = prev.find(r => r.requestId === request.requestId);
            if (exists) {
                return prev;
            }
            return [...prev, request];
        });
    }, [setRequests]);

    const updateRequest = useCallback((requestId: string, updates: Partial<WalletRequest>) => {
        setRequests(prev => prev.map(request =>
            request.requestId === requestId
                ? { ...request, ...updates }
                : request
        ));
    }, [setRequests]);

    const removeRequest = useCallback((requestId: string) => {
        setRequests(prev => prev.filter(request => request.requestId !== requestId));
    }, [setRequests]);

    const clearRequests = useCallback(() => {
        setRequests([]);
    }, [setRequests]);

    // Setup watcher effect
    useEffect(() => {
        // Only create watcher when app is active and we have an address
        const isActive = appStateVisible === 'active';
        const shouldConnect = isActive && tonAddressString;

        if (!shouldConnect) {
            // Clean up existing watcher
            if (watcherRef.current) {
                watcherRef.current.stop();
                watcherRef.current = null;
            }
            setConnectionStatus('disconnected');
            return;
        }

        // Check if we need to restart watcher for address change
        const addressChanged = currentAddressRef.current !== tonAddressString;
        if (addressChanged) {
            if (watcherRef.current) {
                watcherRef.current.stop();
                watcherRef.current = null;
            }
            // No need to clear requests since atomFamily automatically handles different addresses
        }

        // Create new watcher if needed
        if (!watcherRef.current) {
            try {
                setConnectionStatus('connecting');

                // Extract hostname and determine protocol from whalesConnectEndpoint
                const isHttps = whalesConnectEndpoint.startsWith('https://');
                const endpoint = whalesConnectEndpoint.replace(/^https?:\/\//, '');
                const protocol = isHttps ? 'wss' : 'ws';

                const watcher = new WalletRequestsWatcher(endpoint, tonAddressString, protocol, isTestnet);
                watcherRef.current = watcher;
                currentAddressRef.current = tonAddressString;

                // Setup event handlers
                watcher.on('connected', (data) => {
                    setConnectionStatus('connected');
                });

                watcher.on('notification', (event: WalletRequestEvent) => {
                    console.log('notification', event);
                    switch (event.type) {
                        case 'new_request':
                            addRequest(event.request);
                            break;
                        case 'status_update':
                            updateRequest(event.request.requestId, {
                                ...event.request
                            });
                            break;
                        case 'expired':
                            updateRequest(event.request.requestId, {
                                status: 'expired'
                            });
                            break;
                    }
                });

                watcher.on('pending_requests', (data) => {
                    console.log('pending_requests', data);
                    // Replace all requests with pending ones
                    setRequests(data.requests);
                });

                watcher.on('error', (error) => {
                    console.warn('Wallet requests watcher error:', error.message);

                    // Handle certificate errors specifically
                    if (error.type === 'certificate_error') {
                        console.error('Certificate validation failed. This is likely due to:');
                        console.error('1. Development server using HTTP instead of HTTPS');
                        console.error('2. Self-signed certificates');
                        console.error('3. Invalid certificate chain');
                        console.error('Current endpoint:', whalesConnectEndpoint);

                        // Set connection status to disconnected for certificate errors
                        setConnectionStatus('disconnected');
                    }
                });

                watcher.on('disconnected', () => {
                    setConnectionStatus('disconnected');
                });

            } catch (error) {
                console.error('Failed to create wallet requests watcher:', error);
                setConnectionStatus('disconnected');
            }
        }

        // Cleanup function
        return () => {
            if (watcherRef.current) {
                watcherRef.current.stop();
                watcherRef.current = null;
            }
            currentAddressRef.current = null;
        };
    }, [
        tonAddressString,
        isTestnet,
        appStateVisible,
        addRequest,
        updateRequest,
        setConnectionStatus,
        setRequests
    ]);

    return {
        requests,
        connectionStatus,
        isConnected: connectionStatus === 'connected',
        addRequest,
        updateRequest,
        removeRequest,
        clearRequests
    };
}

// Helper hook for just getting the current state without managing the watcher
export function useWalletRequests(address?: string): WalletRequest[] {
    const { tonAddressString } = useCurrentAddress();
    const walletAddress = address || tonAddressString || '';
    const [requests] = useRecoilState(walletRequestsState(walletAddress));
    return requests;
}

// Helper hook for connection status
export function useWalletRequestsConnection(address?: string): 'disconnected' | 'connecting' | 'connected' {
    const { tonAddressString } = useCurrentAddress();
    const walletAddress = address || tonAddressString || '';
    const [connectionStatus] = useRecoilState(walletRequestsConnectionState(walletAddress));
    return connectionStatus;
}
