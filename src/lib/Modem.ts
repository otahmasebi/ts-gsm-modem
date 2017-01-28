import { AtStack, RunCommandParam, CommandResp } from "./AtStack";
import { AtMessage, ReportMode } from "at-messages-parser";

import { SystemState } from "./SystemState";

import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";

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
    private systemState: SystemState;
    private cardLockFacility: CardLockFacility;
    private smsStack: SmsStack;

    public readonly evtNoSim= new VoidSyncEvent();
    public readonly evtUnlockCodeRequest= new SyncEvent<UnlockCodeRequest>();
    public readonly evtReady= new VoidSyncEvent();
    public readonly evtMessage= new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();
    public readonly evtUnsolicitedAtMessage= new SyncEvent<AtMessage>();

    public get isRoaming(): boolean {
        if( !this.systemState ) return undefined;
        else return this.systemState.isRoaming;
    }

    constructor( atInterface: string, private readonly pin?: string ){

        this.atStack= new AtStack(atInterface, { "reportMode": ReportMode.NO_DEBUG_INFO });

        this.atStack.evtUnsolicitedMessage.attach( atMessage => this.evtUnsolicitedAtMessage.post(atMessage) );

        this.initSystemState();

    }

    private initSystemState(): void {

        this.systemState = new SystemState(this.atStack);

        this.systemState.evtHasSim.attach(hasSim => {

            if (!hasSim) return this.evtNoSim.post();

            this.initCardLockFacility();

        });

        this.systemState.evtReady.attach(() => this.evtReady.post());
    }

    private initCardLockFacility(): void {

        this.cardLockFacility = new CardLockFacility(this.atStack);

        this.cardLockFacility.evtUnlockCodeRequest.attach(unlockCodeRequest => {

            if ( this.pin &&
                unlockCodeRequest.pinState === "SIM PIN" &&
                unlockCodeRequest.times === 3
            ) this.enterPin(this.pin);
            else this.evtUnlockCodeRequest.post(unlockCodeRequest);

        });

        this.cardLockFacility.evtPinStateReady.attach(() => this.initSmsStack());
    }

    private initSmsStack(): void {

        this.smsStack= new SmsStack(this.atStack);

        this.smsStack.evtMessage.attach( message => this.evtMessage.post( message ));
        this.smsStack.evtMessageStatusReport.attach( statusReport => this.evtMessageStatusReport.post( statusReport ));

    }


    public runCommand(rawAtCommand: string, param: RunCommandParam, callback?: (output: CommandResp) => void): void;
    public runCommand(rawAtCommand: string, callback?: (output: CommandResp) => void): void;
    public runCommand(...inputs: any[]): void {

        if( typeof(inputs[1]) === "object" ) this.atStack.runCommand(inputs[0], inputs[1], inputs[2]);
        else this.atStack.runCommand(inputs[0], {}, inputs[1]);

    }


    public enterPin(pin: string): void { this.cardLockFacility.enterPin(pin); }
    public enterPin2(pin2: string): void { this.cardLockFacility.enterPin2(pin2); }
    public enterPuk(puk: string, newPin: string): void { this.cardLockFacility.enterPuk(puk, newPin); }
    public enterPuk2(puk: string, newPin2: string): void { this.cardLockFacility.enterPuk2(puk, newPin2); }

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

        if (!this.systemState.isReady) {
            this.systemState.evtReady.attach(() => this.sendMessage_0(number, text, callback));
            return;
        }

        if( !this.smsStack ){
            this.cardLockFacility.evtPinStateReady.attach(()=> this.sendMessage_0(number, text, callback));
            return;
        }

        this.smsStack.sendMessage(number, text, callback);

    }

}