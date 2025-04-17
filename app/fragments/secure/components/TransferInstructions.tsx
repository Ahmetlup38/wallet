import { parseTransactionInstructions } from "../../../utils/solana/parseInstructions";
import { useRegisterPendingSolana, useSolanaClients, useSolanaSelectedAccount, useTheme } from "../../../engine/hooks";
import { useKeysAuth } from "../../../components/secure/AuthWalletKeys";
import { useTypedNavigation } from "../../../utils/useTypedNavigation";
import { PublicKey, Transaction } from "@solana/web3.js";
import { Alert, ScrollView, View } from "react-native";
import { TransferInstructionView } from "../../solana/transfer/components/TransferInstructionView";
import { RoundButton } from "../../../components/RoundButton";
import { signAndSendSolanaTransaction } from "../utils/signAndSendSolanaTransaction";
import { useCallback, useEffect, useRef } from "react";
import { t } from "../../../i18n/t";
import { SolanaTransferFees } from "../../solana/transfer/components/SolanaTransferFees";
import { warn } from "../../../utils/log";
import { SolanaTransactionAppHeader } from "../transfer/SolanaTransactionAppHeader";
import { SolanaOrderApp } from "../ops/Order";

export const TransferInstructions = (params: {
    instructions: ReturnType<typeof parseTransactionInstructions>;
    transaction: Transaction;
    callback?: (ok: boolean, signature: string | null) => void,
    app?: SolanaOrderApp
}) => {
    const theme = useTheme();
    const solanaClients = useSolanaClients();
    const authContext = useKeysAuth();
    const solanaAddress = useSolanaSelectedAccount()!;
    const navigation = useTypedNavigation();
    const { transaction, instructions, callback } = params;

    if (!transaction.feePayer) {
        try {
            transaction.feePayer = new PublicKey(solanaAddress);
        } catch {
            warn('Invalid fee payer');
        }
    }

    const registerPending = useRegisterPendingSolana(solanaAddress);

    const ref = useRef<string | null>(null);

    const doSend = useCallback(async () => {
        try {
            const pending = await signAndSendSolanaTransaction({
                solanaClients,
                theme,
                authContext,
                transaction
            });
            ref.current = pending.id;
            registerPending(pending);
        } catch (error) {
            Alert.alert(t('transfer.solana.error.title'), (error as Error).message);
        }
        navigation.goBack();
    }, [theme, authContext, params, solanaAddress, navigation, registerPending]);

    useEffect(() => {
        return () => {
            callback?.(!!ref.current, ref.current);
        }
    }, []);

    return (
        <View style={{ flexGrow: 1 }}>
            <ScrollView
                style={{ flexGrow: 1, flexBasis: 0, alignSelf: 'stretch' }}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16 }}
                contentInsetAdjustmentBehavior="never"
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                automaticallyAdjustContentInsets={false}
                alwaysBounceVertical={false}
            >
                <View style={{ flexGrow: 1, flexBasis: 0, alignSelf: 'stretch', flexDirection: 'column', gap: 16 }}>
                    {params.app && <SolanaTransactionAppHeader order={params.app} />}
                    {instructions.map((instruction, index) => (
                        <TransferInstructionView
                            key={index}
                            instruction={instruction}
                            owner={solanaAddress}
                        />
                    ))}
                    <SolanaTransferFees tx={transaction} />
                    <View style={{ height: 54 }} />
                </View>
            </ScrollView>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                <RoundButton
                    title={t('common.confirm')}
                    action={doSend}
                />
            </View>
        </View>
    );
}