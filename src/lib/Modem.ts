import { AtStack, RunCommandParam, CommandResp } from "./AtStack";
import { AtMessage, ReportMode } from "at-messages-parser";

import { SystemState } from "./SystemState";
import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";
import { CardStorage, Contact } from "./CardStorage";

import { SmsStack, Message, StatusReport } from "./SmsStack";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { execStack } from "ts-exec-stack";

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
    private cardStorage: CardStorage;

    public readonly evtNoSim = new VoidSyncEvent();

    //public readonly evtUnlockCodeRequest= new SyncEvent<UnlockCodeRequest>();
    public readonly evtUnlockCodeRequest: typeof CardLockFacility.prototype.evtUnlockCodeRequest =
    new SyncEvent<UnlockCodeRequest>();


    public readonly evtUnsolicitedAtMessage: typeof AtStack.prototype.evtUnsolicitedMessage =
    new SyncEvent<AtMessage>();

    public readonly evtReady = new VoidSyncEvent();
    public readonly evtMessage = new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();


    constructor(atInterface: string, private readonly pin?: string) {

        this.atStack = new AtStack(atInterface, { "reportMode": ReportMode.DEBUG_INFO_CODE });

        this.atStack.evtUnsolicitedMessage.attach(atMessage => this.evtUnsolicitedAtMessage.post(atMessage));

        this.initSystemState();

    }

    private initSystemState(): void {

        this.systemState = new SystemState(this.atStack);

        this.systemState.evtReportSimPresence.attachOnce(hasSim => {

            if (!hasSim) {
                this.evtNoSim.post();
                return;
            }

            this.initCardLockFacility();

        });

        this.systemState.evtNetworkReady.attach(() => {

            if (!this.cardStorage.isReady)
                this.cardStorage.evtReady.attachOnce(() => this.evtReady.post());
            else this.evtReady.post();

        });

    }

    private initCardLockFacility(): void {

        this.cardLockFacility = new CardLockFacility(this.atStack);

        this.cardLockFacility.evtUnlockCodeRequest.attach(unlockCodeRequest => {

            if (this.pin &&
                unlockCodeRequest.pinState === "SIM PIN" &&
                unlockCodeRequest.times === 3
            ) this.enterPin(this.pin);
            else this.evtUnlockCodeRequest.post(unlockCodeRequest);

        });

        this.cardLockFacility.evtPinStateReady.attachOnce(() => {

            //ToDO attendre sim ready
            this.initSmsStack();
            this.initCardStorage();
        });

    }

    private initSmsStack(): void {

        this.smsStack = new SmsStack(this.atStack);

        this.smsStack.evtMessage.attach(message => this.evtMessage.post(message));
        this.smsStack.evtMessageStatusReport.attach(statusReport => this.evtMessageStatusReport.post(statusReport));

    }

    private initCardStorage(): void {
            this.cardStorage = new CardStorage(this.atStack);
    }


    public get contacts(): typeof CardStorage.prototype.contacts {
        return this.cardStorage.contacts;
    }

    public getContact: typeof CardStorage.prototype.getContact =
    (...inputs) => this.cardStorage.getContact.apply(this.cardStorage, inputs);

    public runCommand: typeof AtStack.prototype.runCommand =
    (...inputs) => this.atStack.runCommand.apply(this.atStack, inputs);

    public enterPin: typeof CardLockFacility.prototype.enterPin =
    (...inputs) => this.cardLockFacility.enterPin.apply(this.cardLockFacility, inputs);

    public enterPin2: typeof CardLockFacility.prototype.enterPin2 =
    (...inputs) => this.cardLockFacility.enterPin2.apply(this.cardLockFacility, inputs);

    public enterPuk: typeof CardLockFacility.prototype.enterPuk =
    (...inputs) => this.cardLockFacility.enterPuk.apply(this.cardLockFacility, inputs);

    public enterPuk2: typeof CardLockFacility.prototype.enterPuk2 =
    (...inputs) => this.cardLockFacility.enterPuk2.apply(this.cardLockFacility, inputs);

    public sendMessage = execStack(function callee(...inputs) {

        let self = this as Modem;

        if (!self.systemState.isNetworkReady) {
            self.systemState.evtNetworkReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        if (!self.smsStack) {
            self.cardLockFacility.evtPinStateReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.smsStack.sendMessage.apply(self.smsStack, inputs);


    } as typeof SmsStack.prototype.sendMessage);







}