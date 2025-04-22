import React, { useEffect, useMemo } from "react";
import { memo } from "react";
import { View, Text, StyleProp, ViewStyle } from "react-native";
import { PendingTransaction, PendingTransactionStatus } from "../../../engine/state/pending";
import { useTheme } from "../../../engine/hooks/theme/useTheme";
import { useNetwork } from "../../../engine/hooks/network/useNetwork";
import { t } from "../../../i18n/t";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useBounceableWalletFormat, usePendingActions, useSelectedAccount } from "../../../engine/hooks";
import { ThemeType } from "../../../engine/state/theme";
import { Typography } from "../../../components/styles";
import { useAppConfig } from "../../../engine/hooks/useAppConfig";
import { PendingTransactionView } from "./PendingTransactionView";

export const PendingTransactionsList = memo((
    {
        theme,
        txs,
        style,
        viewType = 'main',
        owner
    }: {
        theme: ThemeType,
        txs: PendingTransaction[],
        style?: StyleProp<ViewStyle>,
        viewType?: 'history' | 'main' | 'jetton-history',
        owner: string
    }
) => {
    const [bounceableFormat] = useBounceableWalletFormat();
    const appConfig = useAppConfig();

    return (
        <View style={[
            {
                overflow: 'hidden',
                backgroundColor: viewType === 'main' ? theme.surfaceOnBg : undefined,
                borderRadius: 20,
            },
            style
        ]}>
            {txs.map((tx, i) => (
                <PendingTransactionView
                    key={`tx-${tx.id}-${viewType}`}
                    tx={tx}
                    first={i === 0}
                    last={(i === txs.length - 1) || viewType === 'history'}
                    viewType={viewType}
                    bounceableFormat={bounceableFormat}
                    txTimeout={appConfig.txTimeout}
                    owner={owner}
                />
            ))}
        </View>
    );
});
PendingTransactionsList.displayName = 'PendingTransactionsView';

export const PendingTransactions = memo(({
    address,
    viewType = 'main',
    filter,
    onChange,
    listStyle
}: {
    address?: string,
    viewType?: 'history' | 'main' | 'jetton-history',
    filter?: (tx: PendingTransaction) => boolean,
    onChange?: (txs: PendingTransaction[]) => void,
    listStyle?: StyleProp<ViewStyle>
}) => {
    const account = useSelectedAccount();
    const network = useNetwork();
    const addr = address ?? account?.addressString ?? '';
    const { state: pending, removePending } = usePendingActions(addr, network.isTestnet);
    const theme = useTheme();

    const pendingTxs = useMemo(() => {
        // Show only pending on history tab
        if (viewType !== 'main') {
            return pending
                .filter((tx) => (tx.status !== PendingTransactionStatus.Sent) && (tx.status !== PendingTransactionStatus.TimedOut))
                .filter(filter ?? (() => true));
        }

        return pending.filter(filter ?? (() => true));
    }, [pending, viewType]);

    useEffect(() => {
        // Remove transactions after 15 seconds of changing status
        setTimeout(() => {
            const toRemove = pending
                .filter((tx) => tx.status !== PendingTransactionStatus.Pending)
                .map((tx) => tx.id);

            removePending(toRemove);
        }, 15 * 1000);

        return () => {
            onChange?.(pending);
        }
    }, [pending]);

    if (pendingTxs.length <= 0) {
        return null;
    }

    return (
        <View style={{ paddingHorizontal: 16 }}>
            {pendingTxs.length > 0 && (
                <Animated.View
                    entering={FadeInDown}
                    exiting={FadeOutUp}
                    style={{
                        backgroundColor: theme.backgroundPrimary,
                        justifyContent: 'flex-end',
                        paddingVertical: 16
                    }}
                >
                    <Text style={[{ color: theme.textPrimary }, Typography.semiBold20_28]}>
                        {t('wallet.pendingTransactions')}
                    </Text>
                </Animated.View>
            )}
            <PendingTransactionsList
                theme={theme}
                txs={pendingTxs}
                viewType={viewType}
                style={listStyle}
                owner={addr}
            />
        </View>
    );
});
PendingTransactions.displayName = 'PendingTransactions';