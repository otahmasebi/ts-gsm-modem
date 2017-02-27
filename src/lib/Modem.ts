import { AtStack } from "./AtStack";
import { AtMessage, ReportMode } from "at-messages-parser";
import { SystemState } from "./SystemState";
import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";
import { CardStorage, Contact } from "./CardStorage";

import { SmsStack, Message, StatusReport } from "./SmsStack";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { execStack, ExecStack} from "ts-exec-stack";


require("colors");

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR".red);
    console.log(error);
    throw error; 
});



export class Modem {

    public readonly atStack: AtStack;
    private readonly systemState: SystemState;

    constructor(atInterface: string, private readonly pin?: string) {

        this.atStack = new AtStack(atInterface);

        this.systemState = new SystemState(this.atStack);

        this.systemState.evtReportSimPresence.attachOnce(hasSim => {

            if (!hasSim) {
                this.evtNoSim.post();
                return;
            }

            this.initCardLockFacility.post();

        });

    }

    public readonly runCommand = execStack(
        ((...inputs) => this.atStack.runCommand.apply(this.atStack, inputs)
        ) as typeof AtStack.prototype.runCommand
    );


    public terminate: typeof AtStack.prototype.terminate =
    (...inputs) => this.atStack.terminate.apply(this.atStack, inputs);


    public get evtTerminate(): typeof AtStack.prototype.evtTerminate {
        return this.atStack.evtTerminate;
    }

    public get evtUnsolicitedAtMessage(): typeof AtStack.prototype.evtUnsolicitedMessage {
        return this.atStack.evtUnsolicitedMessage;
    }


    public readonly evtNoSim = new VoidSyncEvent();

    public get evtValidSim(): typeof SystemState.prototype.evtValidSim {
        return this.systemState.evtValidSim;
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

    public sendMessage = execStack(function callee(...inputs) {

        let self = this as Modem;

        if (!self.smsStack) {
            self.initSmsStack.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        if (!self.systemState.isNetworkReady) {
            self.systemState.evtNetworkReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.smsStack.sendMessage.apply(self.smsStack, inputs);

    } as typeof SmsStack.prototype.sendMessage);



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
        try { return this.cardStorage.contacts; } catch (error) { return undefined; }
    }


    public get contactNameMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        try { return this.cardStorage.contactNameMaxLength; } catch (error) { return undefined; }
    }

    public get numberMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        try { return this.cardStorage.numberMaxLength; } catch (error) { return undefined; }
    }

    public get storageLeft(): typeof CardStorage.prototype.storageLeft {
        try { return this.cardStorage.storageLeft; } catch (error) { return undefined; }
    }

    public generateSafeContactName: typeof CardStorage.prototype.generateSafeContactName =
    (...inputs) => this.cardStorage.generateSafeContactName.apply(this.cardStorage, inputs);

    public getContact: typeof CardStorage.prototype.getContact =
    (...inputs) => this.cardStorage.getContact.apply(this.cardStorage, inputs);

    public createContact = execStack(Modem, "WRITE", function callee(...inputs) {

        let self = this as Modem;

        if (!self.cardStorage) {
            self.initCardStorage.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        if (!self.cardStorage.isReady) {
            self.cardStorage.evtReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.cardStorage.createContact.apply(self.cardStorage, inputs);

    } as typeof CardStorage.prototype.createContact);

    public updateContact = execStack(Modem, "WRITE", function callee(...inputs) {

        let self = this as Modem;

        if (!self.cardStorage) {
            self.initCardStorage.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        if (!self.cardStorage.isReady) {
            self.cardStorage.evtReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.cardStorage.updateContact.apply(self.cardStorage, inputs);

    } as typeof CardStorage.prototype.updateContact);

    public deleteContact = execStack(Modem, "WRITE", function callee(...inputs) {

        let self = this as Modem;

        if (!self.cardStorage) {
            self.initCardStorage.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        if (!self.cardStorage.isReady) {
            self.cardStorage.evtReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.cardStorage.deleteContact.apply(self.cardStorage, inputs);

    } as typeof CardStorage.prototype.deleteContact);


}