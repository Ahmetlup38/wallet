import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import axios from 'axios';
import { getAppInstanceKeyPair } from '../storage/appState';
import { Platform, NativeModules } from 'react-native';
import { whalesConnectEndpoint } from '../engine/clients';

const { MaestraModule } = NativeModules;

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
    }),
});

export const setupAPNsTokenHandler = () => {
    if (Platform.OS !== 'ios') return null;

    const subscription = Notifications.addPushTokenListener(tokenData => {
        if (MaestraModule && tokenData.data) {
            MaestraModule.updateAPNSToken(tokenData.data);
        }
    });

    return subscription;
};

export const registerForPushNotificationsAsync = async () => {
    if (Device.isDevice) {
        if (Platform.OS === 'android') {
            await Notifications.getNotificationChannelsAsync();
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.DEFAULT,
            });
        }
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
            const res = await Notifications.requestPermissionsAsync();
        }

        if (Platform.OS === 'ios' && MaestraModule) {
            MaestraModule.updateNotificationPermissions(finalStatus === 'granted');
        }

        if (finalStatus !== 'granted') {
            return null;
        }
        return (await Notifications.getExpoPushTokenAsync({
            projectId: '902300f2-8313-4af2-9907-b31dcd3d62f1'
        })).data;
    } else {
        return null;
    }
};

export async function registerPushToken(token: string, addresses: string[]) {
    await axios.post(`${whalesConnectEndpoint}/push/register`, {
        token,
        appPublicKey: (await getAppInstanceKeyPair()).publicKey.toString('base64'),
        addresses
    }, { method: 'POST' });
}