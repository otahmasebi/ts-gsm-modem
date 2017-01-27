import { AtStack } from "./AtStack";
import { ReportMode } from "at-messages-parser";

import { StatusStack } from "./StatusStack";

import { SimLockStack, UnlockCodeRequest } from "./SimLockStack";

import { SmsStack, Message, StatusReport } from "./SmsStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";

require("colors");

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR".red);
    console.log(error);
    throw error; 
});

export class Modem {

    private atStack: AtStack;
    private statusStack: StatusStack;
    private simLockStack: SimLockStack;
    private smsStack: SmsStack;

    public readonly evtNoSim= new VoidSyncEvent();
    public readonly evtUnlockCodeRequest= new SyncEvent<UnlockCodeRequest>();
    public readonly evtSimValid= new VoidSyncEvent();
    public readonly evtMessage= new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();


    constructor( atInterface: string, private readonly pin?: string ){

        this.atStack= new AtStack(atInterface, { "reportMode": ReportMode.NO_DEBUG_INFO });

        this.statusStack= new StatusStack(this.atStack);

    }

    private registerListener(): void{

        this.statusStack.evtHasSim.attach(hasSim => {

            if (!hasSim) return this.evtNoSim.post();

            this.simLockStack = new SimLockStack(this.atStack);

            this.simLockStack.evtUnlockCodeRequest.attach(unlockCodeRequest => {

                if (
                    unlockCodeRequest.pinState === "SIM PIN" &&
                    unlockCodeRequest.times === 3 &&
                    this.pin
                ) {
                    this.enterPin(this.pin);
                    return;
                }

                this.evtUnlockCodeRequest.post(unlockCodeRequest);
            });

            this.simLockStack.evtPinStateReady.attach(() => this.smsStack = new SmsStack(this.atStack));

        });

    }

    public enterPin(pin: string): void { this.simLockStack.enterPin(pin); }
    public enterPin2(pin2: string): void { this.simLockStack.enterPin2(pin2); }
    public enterPuk(puk: string, newPin: string): void { this.simLockStack.enterPuk(puk, newPin); }
    public enterPuk2(puk: string, newPin2: string): void { this.simLockStack.enterPuk2(puk, newPin2); }

    public sendMessage(
        number: string,
        text: string,
        callback?: (messageId: number) => void
    ): void {

        callback = callback || function () { };

        this.sendMessage_1(number, text, callback);

    }

    private callStack_sendMessage_1: Function[] = [];
    private isReady_sendMessage_1 = true;

    private sendMessage_1(
        number: string,
        text: string,
        callback: (messageId: number) => void
    ): void {

        if (!this.isReady_sendMessage_1) {

            this.callStack_sendMessage_1.push(this.sendMessage_1.bind(this, number, text, callback));

            return;

        }

        this.isReady_sendMessage_1 = false;

        this.sendMessage_0(number, text, messageId => {

            callback(messageId);

            this.isReady_sendMessage_1 = true;

            if (this.callStack_sendMessage_1.length) this.callStack_sendMessage_1.shift()();

        });

    }

    public sendMessage_0(
        number: string,
        text: string,
        callback?: (messageId: number) => void) {

        if (!this.statusStack.isReady) {

            this.statusStack.evtReady.attach(() => this.sendMessage_0(number, text, callback));

            return;

        }

        this.smsStack.sendMessage(number, text, callback);

    }

}