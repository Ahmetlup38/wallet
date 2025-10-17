import { memo, useMemo } from "react";
import { View } from "react-native";
import { useNetwork, useStakingActive } from "../../../engine/hooks";
import { Address } from "@ton/core";
import { StakingPoolMember } from "../../../engine/types";
import { StakingPendingComponent } from "../../staking/StakingPendingComponent";

export const StakingProductPendingComponent = memo(({ address, isLedger }: { address: Address, isLedger?: boolean }) => {
    const { isTestnet } = useNetwork();
    const active = useStakingActive(address);

    const pendingArray: StakingPoolMember[] = useMemo(() => {
        if (!active) {
            return [];
        }

        return Object.keys(active).filter((k) => {
            const state = active[k];
            return state.pendingDeposit > 0n || state.pendingWithdraw > 0n;
        }).map((k) => {
            const state = active[k];
            return {
                pool: Address.parse(k).toString({ testOnly: isTestnet }),
                pendingDeposit: state.pendingDeposit,
                pendingWithdraw: state.pendingWithdraw,
                withdraw: state.withdraw,
                balance: state.balance
            };
        });
    }, [active]);

    if (pendingArray.length === 0) {
        return null;
    }

    return (
        <View style={{ paddingHorizontal: 16 }}>
            {pendingArray.map((p) => (
                <StakingPendingComponent
                    hideWithdrawReady
                    isTestnet={isTestnet}
                    target={Address.parse(p.pool)}
                    member={p}
                    showTitle
                    isLedger={isLedger}
                    routeToPool
                />
            ))}
        </View>
    );
});