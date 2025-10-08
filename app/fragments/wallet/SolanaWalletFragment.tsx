import { fragment } from "../../fragment";
import { usePrice, useSolanaAccount, useTheme } from "../../engine/hooks";
import { useUnifiedSolanaTransactions } from "../../engine/hooks/transactions/useUnifiedSolanaTransactions";
import { setStatusBarStyle } from "expo-status-bar";
import { Platform, View, StyleSheet, Text } from "react-native";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useTypedNavigation } from "../../utils/useTypedNavigation";
import { useParams } from "../../utils/useParams";
import { Typography } from "../../components/styles";
import { memo, Suspense, useCallback } from "react";
import { ValueComponent } from "../../components/ValueComponent";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { CurrencySymbols } from "../../utils/formatCurrency";
import { useFocusEffect } from "@react-navigation/native";
import { SolanaTransactions } from "./views/solana/SolanaTransactions";
import { SolanaWalletActions } from "./views/solana/SolanaWalletActions";
import { isSolanaAddress } from "../../utils/solana/address";
import { SolanaWalletAddress } from "../../components/address/SolanaWalletAddress";
import { Image } from "expo-image";

import SolanaIcon from '@assets/ic-solana.svg';

export type SolanaWalletFragmentProps = {
    owner: string
}

const SolanaWalletSkeleton = memo(() => {
    const theme = useTheme();
    const navigation = useTypedNavigation();

    return (
        <View style={styles.container}>
            <ScreenHeader
                onBackPressed={navigation.goBack}
                style={{ paddingHorizontal: 16 }}
            />
            <View style={styles.skeletonContent}>
                <View style={[styles.skeletonIcon, { backgroundColor: theme.surfaceOnBg }]} />
                <View style={[styles.skeletonBalance, { backgroundColor: theme.surfaceOnBg }]} />
                <View style={[styles.skeletonActions, { backgroundColor: theme.surfaceOnBg }]} />
            </View>
        </View>
    );
});

const SolanaHeader = memo(() => {
    const theme = useTheme();
    const [, currency, solanaPrice] = usePrice();
    const rate = solanaPrice.price.usd;

    return (
        <View style={styles.headerTitleComponent}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                    style={[{ color: theme.textPrimary }, styles.headerTitle]}
                    numberOfLines={1}
                    ellipsizeMode={'tail'}
                >
                    {'SOL'}
                </Text>
                <Image
                    source={require('@assets/ic-verified.png')}
                    style={{ height: 20, width: 20 }}
                />
            </View>
            {!!rate && (
                <Text
                    style={[{ color: theme.textSecondary }, styles.headerSubtitle]}
                    numberOfLines={1}
                    ellipsizeMode={'tail'}
                >
                    <ValueComponent
                        value={BigInt(Math.round(Number(rate) * 100)) * 10n ** 7n}
                        precision={2}
                        suffix={CurrencySymbols[currency]?.symbol}
                        forcePrecision
                    />
                </Text>
            )}
        </View>
    );
});

const SolanaTransactionsHeader = memo(({ owner }: SolanaWalletFragmentProps) => {
    const theme = useTheme();
    const navigation = useTypedNavigation(); ``
    const bottomBarHeight = useBottomTabBarHeight();
    const account = useSolanaAccount(owner);
    const balance = account.data?.balance ?? 0n;
    const symbol = "SOL";
    const decimals = 9;
    const [, currency, solanaPrice] = usePrice();
    const rate = solanaPrice.price.usd;

    // Calculate USD value
    const usdValue = rate ? (Number(balance) / Math.pow(10, decimals)) * Number(rate) : 0;
    const usdValueBigInt = BigInt(Math.round(usdValue * 100)) * 10n ** 7n; // Convert to nano with 9 decimals

    return (
        <View style={styles.content}>
            <View style={{
                width: 72, height: 72, borderRadius: 36,
                borderWidth: 0,
                backgroundColor: theme.style === 'dark' ? theme.surfaceOnBg : theme.black,
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <SolanaIcon
                    width={48}
                    height={48}
                    style={{
                        borderRadius: 24,
                        height: 48,
                        width: 48
                    }}
                />
            </View>
            <View style={{ marginTop: 16, width: '100%' }}>
                <View style={{ gap: 8, alignItems: 'center' }}>
                    <SolanaWalletAddress
                        address={owner}
                        elipsise={{ start: 4, end: 4 }}
                        copyOnPress
                        disableContextMenu
                        copyToastProps={{ marginBottom: 70 + bottomBarHeight }}
                    />
                    <ValueComponent
                        value={balance}
                        decimals={9}
                        precision={4}
                        fontStyle={[Typography.semiBold32_38, { color: theme.textPrimary }]}
                        centFontStyle={{ color: theme.textSecondary }}
                        suffix={` ${symbol}`}
                    />
                    <Text style={[{ color: theme.textSecondary }, Typography.regular15_20]}>
                        <ValueComponent
                            value={usdValueBigInt}
                            precision={2}
                            decimals={9}
                            suffix={` ${CurrencySymbols[currency]?.symbol}`}
                        />
                    </Text>
                </View>
                <SolanaWalletActions
                    style={{ paddingHorizontal: 16 }}
                    theme={theme}
                    navigation={navigation}
                    address={owner}
                />
            </View>
        </View>
    );
});

const SolanaWalletComponent = memo(({ owner }: SolanaWalletFragmentProps) => {
    const navigation = useTypedNavigation();
    const theme = useTheme();
    const {
        transactions,
        pendingCount,
        loading,
        refreshing,
        hasNext,
        next,
        refresh
    } = useUnifiedSolanaTransactions(owner);
    const account = useSolanaAccount(owner);

    const onReachedEnd = useCallback(() => {
        if (hasNext) {
            next();
        }
    }, [next, hasNext]);

    const onRefresh = useCallback(() => {
        refresh();
        account.refetch();
    }, [refresh, account.refetch]);

    useFocusEffect(() => {
        setStatusBarStyle(theme.style === 'dark' ? 'light' : 'dark');
    });

    return (
        <View style={styles.container}>
            <ScreenHeader
                onBackPressed={navigation.goBack}
                style={styles.header}
                titleComponent={<SolanaHeader />}
            />
            <SolanaTransactions
                theme={theme}
                txs={transactions}
                hasNext={hasNext}
                onLoadMore={onReachedEnd}
                onRefresh={onRefresh}
                loading={loading}
                refreshing={refreshing}
                pendingCount={pendingCount}
                owner={owner}
                header={<SolanaTransactionsHeader owner={owner} />}
            />
        </View>
    );
});

export const SolanaWalletFragment = fragment(() => {
    const theme = useTheme();
    const navigation = useTypedNavigation();
    const { owner } = useParams<SolanaWalletFragmentProps>();

    const isValidAddress = isSolanaAddress(owner);

    if (!isValidAddress) { // should never happen
        navigation.goBack();
        return null;
    }

    return (
        <View style={[
            styles.fragment,
            Platform.select({ android: { backgroundColor: theme.backgroundPrimary } })
        ]}>
            <Suspense fallback={<SolanaWalletSkeleton />}>
                <SolanaWalletComponent owner={owner} />
            </Suspense>
        </View>
    );
});

export const solanaWalletFragmentStyles = StyleSheet.create({
    fragment: {
        flexGrow: 1,
        paddingTop: 32
    },
    container: {
        flexGrow: 1
    },
    content: {
        flexGrow: 1,
        paddingTop: 16,
        alignItems: 'center'
    },
    header: {
        paddingHorizontal: 16,
    },
    headerTitleComponent: {
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: '80%'
    },
    headerTitle: {
        ...Typography.semiBold17_24,
        textAlign: 'center'
    },
    headerSubtitle: {
        ...Typography.regular15_20,
        textAlign: 'center'
    },
    skeletonContent: {
        flexGrow: 1,
        padding: 16,
        alignItems: 'center'
    },
    skeletonIcon: {
        height: 72,
        width: 72,
        borderRadius: 36,
        opacity: 0.5
    },
    skeletonBalance: {
        height: 48,
        width: 160,
        borderRadius: 8,
        opacity: 0.5,
        marginTop: 8
    },
    skeletonActions: {
        height: 92,
        width: '100%',
        borderRadius: 20,
        opacity: 0.5,
        marginTop: 28
    }
});

const styles = solanaWalletFragmentStyles;