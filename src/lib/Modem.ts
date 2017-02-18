import { AtStack } from "./AtStack";
import { AtMessage, ReportMode } from "at-messages-parser";
import { SystemState } from "./SystemState";
import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";
import { CardStorage, Contact } from "./CardStorage";

import { SmsStack, Message, StatusReport } from "./SmsStack";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";

require("colors");

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR".red);
    console.log(error);
    throw error; 
});

export class Modem {

    private atStack: AtStack;

    public readonly evtUnsolicitedAtMessage: 
    typeof AtStack.prototype.evtUnsolicitedMessage = new SyncEvent<AtMessage>();

    constructor(atInterface: string, private readonly pin?: string) {

        this.atStack = new AtStack(atInterface);

        this.atStack.evtError.attach(error => {

                //TODO empty stack

                console.log(`ERROR AT STACK: `.yellow, error);
                process.exit(1);

        });

        this.atStack.evtUnsolicitedMessage.attach(atMessage => this.evtUnsolicitedAtMessage.post(atMessage));

        this.initSystemState();

    }

    public runCommand: typeof AtStack.prototype.runCommand =
    (...inputs) => this.atStack.runCommand.apply(this.atStack, inputs);


    private systemState: SystemState;
    public readonly evtNoSim = new VoidSyncEvent();
    public readonly evtValidSim:
    typeof SystemState.prototype.evtValidSim = new VoidSyncEvent();

    private initSystemState() {

        this.systemState = new SystemState(this.atStack);

        this.systemState.evtReportSimPresence.attachOnce(hasSim => {

            if (!hasSim) {
                this.evtNoSim.post();
                return;
            }

            this.initCardLockFacility.post();

        });

        this.systemState.evtValidSim.attach(() => this.evtValidSim.post());

    }

    private cardLockFacility: CardLockFacility;

    public readonly evtUnlockCodeRequest:
    typeof CardLockFacility.prototype.evtUnlockCodeRequest = new SyncEvent<UnlockCodeRequest>();

    private initCardLockFacility = (() => {
        let out = new VoidSyncEvent();
        out.attachOnce(() => {
            this.cardLockFacility = new CardLockFacility(this.atStack);

            this.cardLockFacility.evtUnlockCodeRequest.attach(unlockCodeRequest => {

                if (this.pin &&
                    unlockCodeRequest.pinState === "SIM PIN" &&
                    unlockCodeRequest.times === 3
                ) this.enterPin(this.pin);
                else this.evtUnlockCodeRequest.post(unlockCodeRequest);

            });

            this.cardLockFacility.evtPinStateReady.attachOnce(this, function callee() {

                let self = this as Modem;

                if (!self.systemState.isValidSim) {
                    self.systemState.evtValidSim.attachOnce(() => callee.call(self));
                    return;
                }

                self.initSmsStack.post();
                self.initCardStorage.post();
            });

        });
        return out;
    })();


    public enterPin: typeof CardLockFacility.prototype.enterPin =
    (...inputs) => this.cardLockFacility.enterPin.apply(this.cardLockFacility, inputs);

    public enterPin2: typeof CardLockFacility.prototype.enterPin2 =
    (...inputs) => this.cardLockFacility.enterPin2.apply(this.cardLockFacility, inputs);

    public enterPuk: typeof CardLockFacility.prototype.enterPuk =
    (...inputs) => this.cardLockFacility.enterPuk.apply(this.cardLockFacility, inputs);

    public enterPuk2: typeof CardLockFacility.prototype.enterPuk2 =
    (...inputs) => this.cardLockFacility.enterPuk2.apply(this.cardLockFacility, inputs);



    private smsStack: SmsStack;

    public readonly evtMessage = new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();

    private initSmsStack = (() => {
        let out = new VoidSyncEvent();

        out.attachOnce(() => {

            this.smsStack = new SmsStack(this.atStack);

            this.smsStack.evtMessage.attach(message => this.evtMessage.post(message));
            this.smsStack.evtMessageStatusReport.attach(statusReport => this.evtMessageStatusReport.post(statusReport));
        });

        return out;


    })();


    public sendMessage: typeof SmsStack.prototype.sendMessage =
    ((...inputs)=>{

        if (!this.smsStack) {
            this.initSmsStack.attachOnce(() => this.sendMessage.apply(this, inputs));
            return;
        }

        if (!this.systemState.isNetworkReady) {
            this.systemState.evtNetworkReady.attachOnce(() => this.sendMessage.apply(this, inputs));
            return;
        }

        this.smsStack.sendMessage.apply(this.smsStack, inputs);

        if (!this.sendMessage.stack)
            this.sendMessage.stack = this.smsStack.sendMessage.stack;

    }) as any;




    private cardStorage: CardStorage;

    public readonly evtCardStorageReady: typeof CardStorage.prototype.evtReady =
    new VoidSyncEvent();

    private initCardStorage = (() => {
        let out = new VoidSyncEvent();

        out.attachOnce(() => {

            this.cardStorage = new CardStorage(this.atStack);

            this.cardStorage.evtReady.attachOnce(() => this.evtCardStorageReady.post());

        });

        return out;
    })();

    public get contacts(): typeof CardStorage.prototype.contacts {
        try { return this.cardStorage.contacts; } catch (error) { return []; }
    }


    public get contactNameMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        try { return this.cardStorage.contactNameMaxLength; } catch (error) { return NaN; }
    }

    public get numberMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        try { return this.cardStorage.numberMaxLength; } catch (error) { return NaN; }
    }

    public get storageLeft(): typeof CardStorage.prototype.storageLeft {
        try { return this.cardStorage.storageLeft; } catch (error) { return NaN; }
    }

    public generateSafeContactName: typeof CardStorage.prototype.generateSafeContactName =
    (...inputs) => this.cardStorage.generateSafeContactName.apply(this.cardStorage, inputs);


    public getContact: typeof CardStorage.prototype.getContact =
    (...inputs) => this.cardStorage.getContact.apply(this.cardStorage, inputs);

    public createContact: typeof CardStorage.prototype.createContact =
    ((...inputs) => {

        if (!this.cardStorage) {
            this.initCardStorage.attachOnce(() => this.createContact.apply(self, inputs));
            return;
        }

        if (!this.cardStorage.isReady) {
            this.cardStorage.evtReady.attachOnce(() => this.createContact.apply(self, inputs));
            return;
        }

        this.cardStorage.createContact.apply(this.cardStorage, inputs);

        if (!this.createContact.stack)
            this.createContact.stack = this.cardStorage.createContact.stack;

    }) as any;


    public updateContact: typeof CardStorage.prototype.updateContact =
    ((...inputs) => {

        if (!this.cardStorage) {
            this.initCardStorage.attachOnce(() => this.updateContact.apply(self, inputs));
            return;
        }

        if (!this.cardStorage.isReady) {
            this.cardStorage.evtReady.attachOnce(() => this.updateContact.apply(self, inputs));
            return;
        }

        this.cardStorage.updateContact.apply(this.cardStorage, inputs);

        if (!this.updateContact.stack)
            this.updateContact.stack = this.cardStorage.updateContact.stack;

    }) as any;


    public deleteContact: typeof CardStorage.prototype.deleteContact =
    ((...inputs) => {

        if (!this.cardStorage) {
            this.initCardStorage.attachOnce(() => this.deleteContact.apply(self, inputs));
            return;
        }

        if (!this.cardStorage.isReady) {
            this.cardStorage.evtReady.attachOnce(() => this.deleteContact.apply(self, inputs));
            return;
        }


        this.cardStorage.deleteContact.apply(this.cardStorage, inputs);

        if (!this.deleteContact.stack)
            this.deleteContact.stack = this.cardStorage.deleteContact.stack;

    }) as any;

}