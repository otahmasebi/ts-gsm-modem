import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import "colors";
export interface UnlockCodeRequest {
    pinState: AtMessage.LockedPinState;
    times: number;
}
export declare class CardLockFacility {
    private readonly atStack;
    private readonly debug;
    readonly evtUnlockCodeRequest: import("evt/dist/lib/types").Evt<UnlockCodeRequest>;
    readonly evtPinStateReady: import("evt").VoidEvt;
    constructor(atStack: AtStack, debug: typeof console.log);
    enterPin(pin: string): void;
    enterPin2(pin2: string): void;
    enterPuk(puk: string, newPin: string): void;
    enterPuk2(puk: string, newPin2: string): void;
    private cx_CPIN_READ;
    private get pinState();
    private get times();
    private retrieving;
    private retrieveCX_CPIN_READ;
    private unlocking;
    private __enterPin__;
    private __enterPuk__;
}
