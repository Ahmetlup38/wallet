import { useEffect } from "react";
import { useHoldersAccountStatus } from "./hooks/holders/useHoldersAccountStatus";
import { useSelectedAccount } from "./hooks/appstate/useSelectedAccount";
import { useNetwork } from "./hooks/network/useNetwork";
import { watchHoldersAccountUpdates } from './holders/watchHoldersAccountUpdates';
import { useHoldersAccounts, useSolanaSelectedAccount } from "./hooks";
import { Queries } from "./queries";
import { queryClient } from "./clients";
import { AppState, AppStateStatus } from "react-native";
import { getHoldersToken } from "../storage/holders";

export function useHoldersWatcher() {
    const account = useSelectedAccount();
    const solanaAddress = useSolanaSelectedAccount()!;
    const { isTestnet } = useNetwork();
    const accAddressString = account?.address.toString({ testOnly: isTestnet }) ?? '';
    const status = useHoldersAccountStatus(accAddressString);
    const cards = useHoldersAccounts(accAddressString, solanaAddress);
    const otpKey = Queries.Holders(accAddressString).OTP();

    const token = getHoldersToken(accAddressString);

    useEffect(() => {
        if (!token) {
            return;
        }

        cards.refetch();

        return watchHoldersAccountUpdates(token, (event) => {
            switch (event.type) {
                case 'connected':
                    cards.refetch();
                    break;
                case 'accounts_changed':
                case 'balance_change':
                case 'limits_change':
                    cards.refetch();
                    break;
                case 'prepaid_transaction':
                    cards.refetch();
                    break;
                case 'state_change':
                    status.refetch();
                    break;
                case 'error':
                    if (event.message === 'invalid_token') {
                        status.refetch();
                    }
                    break;
                case 'inapp_otp':
                case 'inapp_otp_confirmation':
                    queryClient.invalidateQueries(otpKey);
                    break;
            }
        }, isTestnet);
    }, [cards, otpKey, token]);

    const appStateListener = (state: AppStateStatus) => {
        if (state === 'active') {
            status.refetch();
        }
    };

    useEffect(() => {
        let sub = AppState.addEventListener('change', appStateListener);

        return () => {
            sub.remove();
        };
    }, []);
}