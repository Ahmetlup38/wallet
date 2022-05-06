import { Address } from "ton";
import { Engine } from "../Engine";
import { tryFetchLegacyPlugin } from "../metadata/introspections/tryFetchLegacyPlugin";
import { LegacySubscription } from "../metadata/Metadata";
import { PersistedValueSync } from "../utils/PersistedValueSync";
import { AccountLiteSync } from "./AccountLiteSync";

export type PluginState =
    | { type: 'unknown' }
    | { type: 'legacy-subscription', state: LegacySubscription };

export class PluginSync extends PersistedValueSync<PluginState> {

    readonly address: Address;
    readonly engine: Engine;
    readonly parent: AccountLiteSync;

    constructor(parent: AccountLiteSync) {
        super(parent.engine.persistence.plugins.item(parent.address), parent.engine);
        this.parent = parent;
        this.engine = parent.engine;
        this.address = parent.address;

        // Forward parent
        if (parent.ready) {
            this.invalidate();
        }
        parent.ref.on('ready', () => {
            this.invalidate();
        });
        parent.ref.on('updated', () => {
            this.invalidate();
        });
    }

    protected doSync = async (src: PluginState | null): Promise<PluginState | null> => {
        let acc = this.parent.current;
        if (!acc) {
            return null;
        }
        let plugin = await tryFetchLegacyPlugin(this.engine.client4, acc.block, this.address);
        if (plugin) {
            return { type: 'legacy-subscription', state: plugin };
        } else {
            return { type: 'unknown' };
        }
    };
}