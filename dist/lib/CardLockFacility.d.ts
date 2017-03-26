import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
export interface UnlockCodeRequest {
    pinState: AtMessage.LockedPinState;
    times: number;
}
export declare class CardLockFacility {
    private readonly atStack;
    readonly evtUnlockCodeRequest: SyncEvent<UnlockCodeRequest>;
    readonly evtPinStateReady: VoidSyncEvent;
    constructor(atStack: AtStack);
    enterPin(pin: string): void;
    enterPin2(pin2: string): void;
    enterPuk(puk: string, newPin: string): void;
    enterPuk2(puk: string, newPin2: string): void;
    private cx_CPIN_READ;
    private readonly pinState;
    private readonly times;
    private retrieving;
    private retrieveCX_CPIN_READ();
    private unlocking;
    private __enterPin__(pin);
    private __enterPuk__(puk, newPin);
}
