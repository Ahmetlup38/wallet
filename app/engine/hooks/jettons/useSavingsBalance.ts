import { Address, fromNano, toNano } from "@ton/core";
import { useAccountLite, useDisplayableJettons, useNetwork, usePrice } from "..";
import { useSpecialJetton } from "./useSpecialJetton";
import { fromBnWithDecimals } from "../../../utils/withDecimals";

export function useSavingsBalance(addr: string | Address) {
    const { isTestnet } = useNetwork();
    const [price] = usePrice();
    const address = typeof addr === 'string' ? Address.parse(addr) : addr;
    const addressString = address.toString({ testOnly: isTestnet });
    const { savings } = useDisplayableJettons(addressString);
    const specialJetton = useSpecialJetton(address);
    const accountLite = useAccountLite(address);

    let totalBalance = 0;

    // savings jettons balance
    let savingTotal = savings.reduce((acc, s) => {
        if (!s.price) {
            return acc;
        }

        try {
            const balance = BigInt(s.balance);
            const price = s.price.prices?.['USD'] ?? 0;
            const priceInUSD = parseFloat(fromBnWithDecimals(balance, s.jetton.decimals ?? 6)) * price;
            return acc + priceInUSD;
        } catch {
            return acc;
        }
    }, 0);

    // add only savings jettons balance
    totalBalance += savingTotal;

    let specialToTon = 0;
    // update savingTotal with special jetton balance
    if (specialJetton?.balance && price?.price?.usd) {
        try {
            specialToTon = parseFloat(fromBnWithDecimals(specialJetton.balance, specialJetton.decimals ?? 6)) / (price.price.usd);
        } catch { }
    }

    // TON balance
    const tonBalance = accountLite?.balance ?? 0n;
    let tonTotal = 0;
    if (price?.price?.usd && tonBalance) {
        try {
            tonTotal = parseFloat(fromNano(tonBalance)) * price.price.usd;
            totalBalance += tonTotal;
        } catch { }
    }

    // Special jetton balance
    const specialTotal = specialJetton?.balance ?? 0n;
    try {
        totalBalance += parseFloat(fromBnWithDecimals(specialTotal, specialJetton?.decimals ?? 6))
    } catch { }

    let savingsToTon = 0n;

    try {
        savingsToTon += toNano((savingTotal / price.price.usd).toFixed(9));
    } catch { }

    return {
        totalBalance: toNano(totalBalance.toFixed(9)),
        tonBalance: toNano(tonTotal.toFixed(9)),
        savingTotal: toNano(savingTotal.toFixed(9)),
        specialBalance: specialTotal,
        specialToTon: toNano(specialToTon.toFixed(9)),
        savingsToTon
    };
}