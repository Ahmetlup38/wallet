import React, { Suspense } from "react";
import { View } from "react-native";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import { fragment } from "../../fragment";
import { t } from "../../i18n/t";
import { useIsLedgerRoute, useTheme } from '../../engine/hooks';
import { WalletTransactions } from "./views/WalletTransactions";
import { useFocusEffect } from "@react-navigation/native";
import { TabHeader } from "../../components/topbar/TabHeader";
import { Address } from "@ton/core";
import { TransactionsSkeleton } from "../../components/skeletons/TransactionsSkeleton";
import { setStatusBarStyle } from "expo-status-bar";
import { ThemeType } from "../../engine/state/theme";
import { TransactionsHeader } from "./views/TransactionsHeader";
import { useCurrentAddress } from "../../engine/hooks/appstate/useCurrentAddress";

function TransactionsComponent(props: { account: Address, solanaAddress?: string, isLedger?: boolean, theme: ThemeType }) {
    const { account: address } = props;

    return (
        <View style={{ flex: 1, backgroundColor: props.theme.backgroundPrimary }}>
            <TabHeader title={t('transactions.history')} />
            <WalletTransactions
                address={address}
                ledger={props.isLedger}
                header={<TransactionsHeader address={address} />}
                isWalletTab={true}
            />
        </View>
    );
}

export const TransactionsFragment = fragment(() => {
    const theme = useTheme();
    const isLedger = useIsLedgerRoute()
    const { tonAddress, solanaAddress } = useCurrentAddress();

    useFocusEffect(() => {
        setStatusBarStyle(theme.style === 'dark' ? 'light' : 'dark');
    });

    if (!tonAddress) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.backgroundPrimary }}>
                <TabHeader title={t('transactions.history')} />
                <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <LoadingIndicator />
                </View>
            </View>
        );
    } else {
        return (
            <Suspense fallback={
                <View style={{ paddingTop: 166 }}>
                    <TransactionsSkeleton />
                </View>
            }>
                <TransactionsComponent
                    theme={theme}
                    isLedger={isLedger}
                    account={tonAddress}
                    solanaAddress={solanaAddress}
                />
            </Suspense>
        )
    }
});