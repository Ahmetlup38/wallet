import { memo } from "react";
import { TransactionView } from "./TransactionView";
import { SectionListRenderItemInfo } from "react-native";
import { Address } from "@ton/core";
import { ThemeType } from "../../../engine/state/theme";
import { AddressContact } from "../../../engine/hooks/contacts/useAddressBook";
import { AppState } from "../../../storage/appState";
import { WalletSettings } from "../../../engine/state/walletSettings";
import { KnownWallet } from "../../../secure/KnownWallets";
import { TonTransaction } from "../../../engine/types";
import { PreparedMessageView } from "./PreparedMessageView";

export type TransactionListItemProps = {
    address: Address,
    theme: ThemeType,
    onPress: (tx: TonTransaction) => void,
    onLongPress: (tx: TonTransaction, formattedAddressString?: string) => void,
    ledger?: boolean,
    spamMinAmount: bigint,
    dontShowComments: boolean,
    denyList: { [key: string]: { reason: string | null } },
    contacts: { [key: string]: AddressContact },
    isTestnet: boolean,
    spamWallets: string[],
    appState: AppState,
    bounceableFormat: boolean,
    walletsSettings: { [key: string]: WalletSettings },
    knownWallets: { [key: string]: KnownWallet },
    getAddressFormat: (address: Address) => boolean | undefined,
}

export const TransactionListItem = memo(({ item, section, index, theme, ...props }: SectionListRenderItemInfo<TonTransaction, { title: string }> & TransactionListItemProps) => {
    if (item.message) {
        return (
            <PreparedMessageView
                own={props.address}
                tx={item}
                theme={theme}
                ledger={props.ledger}
                {...props}
            />
        );
    }
    return (
        <TransactionView
            own={props.address}
            tx={item}
            theme={theme}
            ledger={props.ledger}
            {...props}
        />
    );
}, (prev, next) => {
    return prev.item.id === next.item.id
        && prev.isTestnet === next.isTestnet
        && prev.dontShowComments === next.dontShowComments
        && prev.spamMinAmount === next.spamMinAmount
        && prev.address === next.address
        && prev.theme === next.theme
        && prev.section === next.section
        && prev.index === next.index
        && prev.denyList === next.denyList
        && prev.contacts === next.contacts
        && prev.spamWallets === next.spamWallets
        && prev.appState === next.appState
        && prev.onLongPress === next.onLongPress
        && prev.bounceableFormat === next.bounceableFormat
        && prev.walletsSettings === next.walletsSettings
        && prev.knownWallets === next.knownWallets
});
TransactionListItem.displayName = 'TransactionListItem';