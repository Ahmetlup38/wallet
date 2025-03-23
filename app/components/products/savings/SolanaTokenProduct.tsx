import { memo } from "react";
import { useTypedNavigation } from "../../../utils/useTypedNavigation";
import { Pressable, View, Image, Text } from "react-native";
import { Typography } from "../../styles";
import { PriceComponent } from "../../PriceComponent";
import { ValueComponent } from "../../ValueComponent";
import { ItemDivider } from "../../ItemDivider";
import { t } from "../../../i18n/t";
import { toNano } from "@ton/core";
import { useTheme } from "../../../engine/hooks";
import { SolanaToken } from "../../../engine/api/solana/fetchSolanaTokens";
import { WImage } from "../../WImage";

import SolanaIcon from '@assets/ic-solana.svg';

export const SolanaTokenProduct = memo(({
    token,
    address,
    testOnly,
    divider
}: {
    token: SolanaToken,
    address: string,
    testOnly: boolean,
    divider?: 'top' | 'bottom'
}) => {
    const theme = useTheme();
    const navigation = useTypedNavigation();

    const decimals = token.decimals ?? 6;
    const balance = token.amount ?? 0n;
    const price = toNano(token.uiAmount ?? 0);
    const symbol = token.symbol ?? "?";
    const name = token.name ?? "?";

    const onPress = () => {
        navigation.navigateSolanaTokenWallet({ owner: address, mint: token.address });
    };

    return (
        <Pressable
            style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.5 : 1 })}
            onPress={onPress}
        >
            {divider === 'top' && <ItemDivider marginVertical={0} />}
            <View style={[
                {
                    flexDirection: 'row', flexGrow: 1,
                    alignItems: 'center',
                    padding: 20,
                    backgroundColor: theme.surfaceOnBg,
                    borderRadius: 20,
                    overflow: 'hidden',
                    gap: 12
                },
            ]}>
                <View style={{
                    width: 46, height: 46, borderRadius: 23,
                    borderWidth: 0,
                    backgroundColor: theme.backgroundPrimary,
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    {token.logoURI ? (
                        <WImage
                            src={token.logoURI}
                            width={46}
                            height={46}
                            borderRadius={23}
                        />
                    ) : (
                        <SolanaIcon
                            width={32}
                            height={32}
                            style={{
                                borderRadius: 16,
                                height: 32,
                                width: 32
                            }}
                        />
                    )}
                    <View style={{
                        justifyContent: 'center', alignItems: 'center',
                        height: 20, width: 20, borderRadius: 10,
                        position: 'absolute', right: -2, bottom: -2,
                        backgroundColor: theme.surfaceOnBg
                    }}>
                        <SolanaIcon
                            width={10}
                            height={10}
                            style={{
                                borderRadius: 5,
                                height: 10,
                                width: 10
                            }}
                        />
                    </View>
                </View>
                <View style={{ flexShrink: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text
                            style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}
                            ellipsizeMode="tail"
                            numberOfLines={1}
                        >
                            {name}
                        </Text>
                        <Image
                            source={require('@assets/ic-verified.png')}
                            style={{ height: 20, width: 20 }}
                        />
                    </View>
                    <Text
                        numberOfLines={1}
                        ellipsizeMode={'tail'}
                        style={[{ color: theme.textSecondary }, Typography.regular15_20]}
                    >
                        {t('savings.general', { symbol })}
                    </Text>
                </View>
                <View style={{ flexGrow: 1, alignItems: 'flex-end' }}>
                    <Text style={[{ color: theme.textPrimary }, Typography.semiBold17_24]}>
                        <ValueComponent
                            value={balance}
                            precision={2}
                            decimals={decimals}
                            centFontStyle={{ color: theme.textSecondary }}
                        />
                        <Text
                            style={{ color: theme.textSecondary, fontSize: 15 }}>
                            {` ${symbol}`}
                        </Text>
                    </Text>
                    <PriceComponent
                        amount={price}
                        style={{
                            backgroundColor: 'transparent',
                            paddingHorizontal: 0, paddingVertical: 0,
                            alignSelf: 'flex-end',
                            height: undefined,
                        }}
                        textStyle={[{ color: theme.textSecondary }, Typography.regular15_20]}
                        theme={theme}
                        priceUSD={1}
                        hideCentsIfNull
                    />
                </View>
            </View>
            {divider === 'bottom' && <ItemDivider marginVertical={0} />}
        </Pressable>
    );
});

SolanaTokenProduct.displayName = 'SolanaUSDCProduct';
