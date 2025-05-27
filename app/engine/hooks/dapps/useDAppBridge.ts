import { useCallback, useMemo, useState } from 'react';
import { TypedNavigation } from '../../../utils/useTypedNavigation';
import { useConnectApp } from './useConnectApp';
import { AppRequest, CONNECT_EVENT_ERROR_CODES, ConnectEvent, ConnectItemReply, RpcMethod, SEND_TRANSACTION_ERROR_CODES, SessionCrypto, WalletEvent, WalletResponse } from '@tonconnect/protocol';
import { getAppManifest } from '../../getters/getAppManifest';
import { TonConnectAuthResult, TonConnectAuthType } from '../../../fragments/secure/dapps/TonConnectAuthenticateFragment';
import { useSaveAppConnection } from './useSaveAppConnection';
import { useAutoConnect } from './useAutoConnect';
import { useRemoveInjectedConnection } from './useRemoveInjectedConnection';
import { Cell, fromNano, toNano } from '@ton/core';
import { extractDomain } from '../../utils/extractDomain';
import { useDisconnectApp } from './useDisconnect';
import { ConnectEventError, SignDataPayload, SignRawTxParams, TonConnectBridgeType, TonConnectInjectedBridge } from '../../tonconnect/types';
import { CURRENT_PROTOCOL_VERSION, tonConnectDeviceInfo } from '../../tonconnect/config';
import { checkProtocolVersionCapability, verifyConnectRequest } from '../../tonconnect/utils';
import { useWebViewBridge } from './useWebViewBridge';
import { getCurrentAddress } from '../../../storage/appState';
import { useHoldersLedgerTonconnectHandler } from './useHoldersLedgerTonconnectHandler';
import { useWalletVersion } from '../useWalletVersion';
import { useToaster } from '../../../components/toast/ToastProvider';
import { useNetwork } from '..';
import { checkTonconnectTxRequest } from '../../tonconnect/checkTonconnectTxRequest';
import { checkTonconnectSignRequest } from '../../tonconnect/checkTonconnectSignRequest';

type SolanaInjectedBridge = {
    sendSolanaTransaction: (transaction: string) => Promise<void>;
}

export function useDAppBridge(endpoint: string, navigation: TypedNavigation, address?: string, isLedger?: boolean): any {
    const saveAppConnection = useSaveAppConnection();
    const getConnectApp = useConnectApp(address);
    const autoConnect = useAutoConnect(address);
    const removeInjectedConnection = useRemoveInjectedConnection(address);
    const onDisconnect = useDisconnectApp(address);
    const walletVersion = useWalletVersion(address);
    const toaster = useToaster();
    const { isTestnet } = useNetwork();
    const cleanEndpoint = endpoint.split('?')[0];

    const account = address ?? getCurrentAddress().addressString;
    const handleLedgerRequest = useHoldersLedgerTonconnectHandler();

    const [connectEvent, setConnectEvent] = useState<ConnectEvent | null>(null);
    const [requestId, setRequestId] = useState(0);

    const app = getConnectApp(endpoint);

    const isConnected = useMemo(() => {
        if (!app) {
            return false;
        }

        return Boolean(connectEvent && connectEvent.event === 'connect');
    }, [app, connectEvent]);

    const bridgeObject = useMemo((): TonConnectInjectedBridge & SolanaInjectedBridge => {
        return {
            deviceInfo: tonConnectDeviceInfo(walletVersion),
            protocolVersion: CURRENT_PROTOCOL_VERSION,
            isWalletBrowser: true,

            connect: async (protocolVersion, request) => {
                try {
                    checkProtocolVersionCapability(protocolVersion);
                    verifyConnectRequest(request);

                    const manifest = await getAppManifest(request.manifestUrl);

                    if (!manifest) {
                        return new ConnectEventError(
                            CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
                            'Unknown app',
                            requestId
                        );
                    }

                    const event = await new Promise<ConnectEvent>((resolve, reject) => {
                        const callback = (result: TonConnectAuthResult) => {
                            if (result.ok) {
                                saveAppConnection({
                                    address: account,
                                    app: {
                                        name: manifest.name,
                                        url: manifest.url,
                                        iconUrl: manifest.iconUrl,
                                        autoConnectDisabled: false,
                                        manifestUrl: request.manifestUrl,
                                    },
                                    connections: [{
                                        type: TonConnectBridgeType.Injected,
                                        replyItems: result.replyItems,
                                    }]
                                });

                                resolve({
                                    event: 'connect',
                                    payload: {
                                        items: result.replyItems as ConnectItemReply[],
                                        device: tonConnectDeviceInfo(walletVersion)
                                    },
                                    id: requestId
                                });
                            } else {
                                if (result.event) {
                                    resolve({ ...result.event, id: requestId });
                                } else {
                                    resolve({
                                        event: 'connect_error',
                                        payload: {
                                            code: CONNECT_EVENT_ERROR_CODES.USER_REJECTS_ERROR,
                                            message: 'User denied the connection',
                                        },
                                        id: requestId
                                    });
                                }
                            }
                        }

                        navigation.navigateConnectAuth({
                            type: TonConnectAuthType.Callback,
                            protocolVersion: protocolVersion as 2,
                            request,
                            callback
                        });
                    });
                    setConnectEvent(event);
                    return event;

                } catch (error: any) {
                    if (error instanceof ConnectEventError) {
                        return error;
                    }

                    return new ConnectEventError(
                        CONNECT_EVENT_ERROR_CODES.UNKNOWN_ERROR,
                        error?.message,
                        requestId
                    );
                }
            },

            restoreConnection: async () => {
                const event = await autoConnect(cleanEndpoint);
                setRequestId(event.id);
                setConnectEvent(event);
                return event;
            },

            disconnect: async () => {
                setConnectEvent(null);
                onDisconnect(cleanEndpoint, requestId);
                setRequestId(0);
                return;
            },

            send: async <T extends RpcMethod>(request: AppRequest<T>) => {
                setRequestId(Number(request.id));
                if (!app) {
                    return {
                        error: {
                            code: SEND_TRANSACTION_ERROR_CODES.UNKNOWN_APP_ERROR,
                            message: 'Unknown app',
                        },
                        id: request.id.toString(),
                    };
                }

                return new Promise<WalletResponse<T>>((resolve) => {
                    const callback = (response: WalletResponse<T>) => {
                        resolve(response);
                    };
                    if (!app) {
                        callback({
                            error: {
                                code: SEND_TRANSACTION_ERROR_CODES.UNKNOWN_APP_ERROR,
                                message: 'Unknown app',
                            },
                            id: request.id.toString(),
                        });
                    }

                    switch (request.method) {
                        case 'sendTransaction':
                            try {
                                const params = JSON.parse(request.params[0]) as SignRawTxParams;

                                if (isLedger) {
                                    handleLedgerRequest(request.id.toString(), params, callback, extractDomain(endpoint));
                                    return;
                                }

                                const isValidRequest = checkTonconnectTxRequest(request.id.toString(), params, callback, isTestnet, toaster);

                                if (!isValidRequest) {
                                    return;
                                }

                                navigation.navigateTransfer({
                                    text: null,
                                    order: {
                                        type: 'order',
                                        messages: params.messages.map((msg) => {
                                            return {
                                                amount: toNano(fromNano(msg.amount)),
                                                target: msg.address,
                                                amountAll: false,
                                                payload: msg.payload ? Cell.fromBoc(Buffer.from(msg.payload, 'base64'))[0] : null,
                                                stateInit: msg.stateInit ? Cell.fromBoc(Buffer.from(msg.stateInit, 'base64'))[0] : null
                                            }
                                        }),
                                        app: app ? {
                                            title: app.name,
                                            domain: extractDomain(app.url),
                                            url: app.url
                                        } : undefined,
                                        validUntil: params.valid_until
                                    },
                                    callback: (ok, result) => {
                                        if (ok) {
                                            callback({
                                                result: result?.toBoc({ idx: false }).toString('base64') ?? '',
                                                id: request.id.toString(),
                                            });
                                        } else {
                                            callback({
                                                error: {
                                                    code: SEND_TRANSACTION_ERROR_CODES.USER_REJECTS_ERROR,
                                                    message: 'User rejected',
                                                },
                                                id: request.id.toString(),
                                            });
                                        }
                                    },
                                    back: 1
                                });
                                return;
                            } catch (error) {
                                callback({
                                    error: {
                                        code: SEND_TRANSACTION_ERROR_CODES.BAD_REQUEST_ERROR,
                                        message: `Bad request`,
                                    },
                                    id: request.id.toString(),
                                });
                            }
                            break;

                        case 'signData':
                            try {
                                const params = JSON.parse((request.params as unknown as [string])[0]) as SignDataPayload;
                                const isValidRequest = checkTonconnectSignRequest(request.id.toString(), params, callback, toaster);

                                if (!isValidRequest) {
                                    return;
                                }

                                navigation.navigateTonConnectSign({
                                    data: {
                                        request: {
                                            method: 'signData',
                                            params: [params],
                                            id: request.id.toString(),
                                            from: ''
                                        },
                                        sessionCrypto: new SessionCrypto(),
                                        app: app,
                                    },
                                    callback
                                });
                            } catch (error) {
                                callback({
                                    error: {
                                        code: SEND_TRANSACTION_ERROR_CODES.BAD_REQUEST_ERROR,
                                        message: `Bad request`,
                                    },
                                    id: request.id.toString(),
                                });
                            }
                            break;
                        case 'disconnect':
                            onDisconnect(cleanEndpoint, requestId);
                            callback({
                                id: request.id.toString(),
                                result: {}
                            });
                            break;
                        default:
                            callback({
                                error: {
                                    code: SEND_TRANSACTION_ERROR_CODES.BAD_REQUEST_ERROR,
                                    message: `Method is not supported`,
                                },
                                id: (requestId + 1).toString(),
                            });
                            break;
                    }
                });
            },
            
            sendSolanaTransaction: async (transaction: string) => {
                return new Promise<WalletResponse<any>>((resolve) => {
                    const callback = (ok: boolean, signature: string | null) => {
                        if (!ok) {
                            resolve({
                                error: {
                                    code: SEND_TRANSACTION_ERROR_CODES.USER_REJECTS_ERROR,
                                    message: 'User rejected',
                                },
                                id: requestId.toString(),
                            });
                            return;
                        }

                        resolve({
                            result: signature,
                            id: requestId.toString(),
                        });
                    };

                    // TODO: *solana* check if transaction is valid

                    navigation.navigateSolanaTransfer({
                        type: 'message',
                        message: transaction,
                        callback
                    });
                });
            }
        };
    }, [cleanEndpoint, app, requestId, saveAppConnection, autoConnect, removeInjectedConnection, handleLedgerRequest]);

    const [ref, injectedJavaScriptBeforeContentLoaded, onMessage, sendEvent] =
        useWebViewBridge<TonConnectInjectedBridge, WalletEvent>(bridgeObject);

    const disconnect = useCallback(async () => {
        try {
            onDisconnect(cleanEndpoint, requestId);
            sendEvent({ event: 'disconnect', payload: {}, id: requestId });
        } catch { }
    }, [cleanEndpoint, sendEvent, requestId]);

    return {
        ref,
        injectedJavaScriptBeforeContentLoaded,
        onMessage,
        isConnected,
        disconnect,
    };
}