import { SyncEvent, VoidSyncEvent } from "ts-events";
import { AtStack } from "./AtStack";
import {
    atIdDict,
    AtMessage,
    AtImps,
    PinState
} from "at-messages-parser";

export interface UnlockCodeRequest {
    pinState: PinState;
    times: number;
}

require("colors");

export class CardLockFacility {

    public readonly evtUnlockCodeRequest = new SyncEvent<UnlockCodeRequest>();

    public readonly evtPinStateReady= new VoidSyncEvent();

    constructor(private readonly atStack: AtStack) {

        this.retrieveHuaweiCPIN();

    }

    public enterPin(pin: string): void {

        if (this.pinState !== "SIM PIN") throw new Error();

        this.__enterPin__(pin);

    }

    public enterPin2(pin2: string): void {

        if (this.pinState !== "SIM PIN2") throw new Error();

        this.__enterPin__(pin2);

    }

    public enterPuk(puk: string, newPin: string): void {

        if (this.pinState !== "SIM PUK") throw new Error();

        this.__enterPuk__(puk, newPin);

    }

    public enterPuk2(puk: string, newPin2: string): void {

        if (this.pinState !== "SIM PUK2") throw new Error();

        this.__enterPuk__(puk, newPin2);

    }

    private atMessageHuaweiCPIN: AtImps.CX_CPIN_READ;

    private get pinState(): PinState { return this.atMessageHuaweiCPIN.pinState; }

    private get times(): number { return this.atMessageHuaweiCPIN.times; }

    private retrieving = true;

    private retrieveHuaweiCPIN(): void {

        this.retrieving = true;

        this.atStack.runCommand("AT^CPIN?\r", output => {

            this.retrieving = false;

            this.atMessageHuaweiCPIN = output.atMessage as AtImps.CX_CPIN_READ;

            if (this.pinState === "READY") return this.evtPinStateReady.post();

            this.evtUnlockCodeRequest.post({
                "pinState": this.pinState,
                "times": this.times
            });

        });

    }

    private unlocking = false;

    private __enterPin__(pin: string): void {

        if (this.retrieving) throw new Error();
        if (this.unlocking) throw new Error();
        if (!pin.match(/^[0-9]{4}$/)) throw new Error();

        this.unlocking = true;

        this.atStack.runCommand(`AT+CPIN=${pin}\r`, {
            "unrecoverable": false,
            "retryCount": 0
        }, output => {

            this.unlocking = false;

            if( output.isSuccess ) return this.evtPinStateReady.post();

            this.retrieveHuaweiCPIN();

        });

    }

    private __enterPuk__(puk: string, newPin: string) {

        if (this.retrieving) throw new Error();
        if (this.unlocking) throw new Error();
        if (!puk.match(/^[0-9]{8}$/)) throw new Error();
        if (!newPin.match(/^[0-9]{4}$/)) throw new Error();

        this.unlocking = true;

        this.atStack.runCommand(`AT+CPIN=${puk},${newPin}\r`, {
            "unrecoverable": false,
            "retryCount": 0
        }, output => {

            this.unlocking = false;

            if( output.isSuccess ) return this.evtPinStateReady.post();

            this.retrieveHuaweiCPIN();

        });

    }

}