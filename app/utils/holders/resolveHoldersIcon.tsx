import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { WImage } from '../../components/WImage';

const ICON_SIZE = 24;
const ICON_RADIUS = ICON_SIZE / 2;

const styles = StyleSheet.create({
    container: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_RADIUS,
        borderWidth: 0
    },
    icon: {
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: ICON_RADIUS
    }
});
const usdtIcon = <Image source={require('@assets/known/ic-usdt.png')} style={styles.icon} />;
const tonIcon = <Image source={require('@assets/ic-ton-acc.png')} style={styles.icon} />;

export function resolveHoldersIcon({ image, ticker }: { image?: string | null, ticker?: string }) {
    let content;

    if (ticker === 'USDT') {
        content = usdtIcon;
    } else if (image) {
        content = <WImage src={image} width={ICON_SIZE} height={ICON_SIZE} borderRadius={ICON_SIZE} />;
    } else {
        content = tonIcon;
    }

    return <View style={styles.container}>{content}</View>;
}
