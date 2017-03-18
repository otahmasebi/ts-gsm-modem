import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { SystemState } from "./SystemState";
import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";
import { CardStorage, Contact } from "./CardStorage";
import { SerialPortExt } from "./SerialPortExt";

import { SmsStack, Message, StatusReport } from "./SmsStack";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { execStack, ExecStack} from "ts-exec-stack";

import * as pr from "ts-promisify";
import * as _debug from "debug";
let debug= _debug("_Modem");



require("colors");

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR".red);
    console.log(error);
    throw error;
});


export interface UnlockCodeProviderCallback {
    (pin: string): void;
    (puk: string, newPin: string): void;
}

export interface UnlockCodeProvider {
    handler(
        imei: string,
        iccid: string,
        pinState: AtMessage.LockedPinState,
        tryLeft: number,
        callback: UnlockCodeProviderCallback
    ): void;
    explicit: { pinFirstTry: string; pinSecondTry?: string };
}

export type CreateCallback= (error: null | Error, modem:Modem, hasSim:boolean)=> void;



export class Modem {

    private static getSafeUnlockCodeProvider(
        unlockCodeProvider: UnlockCodeProvider['handler'] | UnlockCodeProvider['explicit'] | undefined 
    ): UnlockCodeProvider['handler'] {

            switch (typeof unlockCodeProvider) {
                case "object":
                    let explicit = unlockCodeProvider as UnlockCodeProvider['explicit'];
                    let pins = [explicit.pinFirstTry, explicit.pinSecondTry];
                    return (imei, imsi, pinState, tryLeft, callback) => {

                        if (pinState === "SIM PIN") {

                            if (tryLeft === 1)
                                throw new Error("Prevent unlock sim, only one try left!");

                            let pin = pins.shift();

                            if (pin) {
                                debug(`Unlock ${imei}, ${imsi}, ${pinState}, ${tryLeft}, ${pin}`);
                                callback(pin);
                                return;
                            }
                        }

                        throw new Error(`No unlock action defined for ${pinState}, tryLeft: ${tryLeft}`);

                    };
                case "function":
                    return unlockCodeProvider as UnlockCodeProvider['handler'];
                default: throw new Error("No action defined for unlock card");
            }

    }

    public static create(
        params: {
            path: string;
            unlockCodeProvider?: UnlockCodeProvider['handler'] | UnlockCodeProvider['explicit'];
            disableSmsFeatures?: boolean;
            disableContactsFeatures?: boolean;
        },
        callback: CreateCallback
    ): void {


        let modem = new Modem({
            "path": params.path,
            "unlockCodeProvider": Modem.getSafeUnlockCodeProvider(params.unlockCodeProvider),
            "enableSmsStack": !(params.disableSmsFeatures === true),
            "enableCardStorage": !(params.disableContactsFeatures === true)
        }, (...inputs) => {

            modem.evtTerminate.detach();

            callback.apply(null, inputs);

        });

        modem.evtTerminate.attachOnce(
            error => callback(
                error ? error : new Error("Modem has disconnected"),
                modem,
                false
            )
        );


    };



    private readonly atStack: AtStack;
    private readonly systemState: SystemState;

    public imei: string;
    public iccid: string;
    public iccidAvailableBeforeUnlock: boolean;
    public imsi: string;

    private constructor(
        private readonly params: {
            path: string;
            unlockCodeProvider: UnlockCodeProvider['handler'];
            enableSmsStack: boolean;
            enableCardStorage: boolean;
        },
        private readonly callback: CreateCallback
    ) {

        this.atStack = new AtStack(params.path);

        this.atStack.runCommand("AT+CGSN\r", resp => {
            this.imei = resp!.raw.split("\r\n")[1];
            debug("IMEI: ", this.imei);
        });


        debug("Init, systemState");

        this.systemState = new SystemState(this.atStack);

        this.systemState.evtReportSimPresence.attachOnce(async hasSim => {

            if (!hasSim) {
                callback(null, this, false);
                return;
            }

            debug("HAS SIM: TRUE");

            this.iccid= await this.readIccid();

            this.iccidAvailableBeforeUnlock= (this.iccid)?true:false;

            debug("ICCID before unlock: ", this.iccid);

            this.initCardLockFacility();

        });

    }

    private async readIccid(): Promise<string> {

            let switchedIccid: string | undefined;

            let [resp, final] = await pr.typed(
                this.atStack, this.atStack.runCommandExt
            )("AT^ICCID?\r", { "recoverable": true });


            if (final.isError) {

                let [resp, final] = await pr.typed(
                    this.atStack, this.atStack.runCommandExt
                )("AT+CRSM=176,12258,0,0,10\r", { "recoverable": true });

                if( final.isError )
                    switchedIccid= undefined;
                else switchedIccid = (resp as AtMessage.P_CRSM_SET).response!;

            } else switchedIccid = (resp as AtMessage.CX_ICCID_SET).iccid;

            return (switched => {

                let out = "";

                if( !switched ) return out;

                for (let i = 0; i < switched.length; i += 2)
                    out += switched[i + 1] + switched[i];

                if (out[out.length - 1].match(/^[Ff]$/))
                    out = out.slice(0, -1);

                return out;

            })(switchedIccid);

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

    public pin: string | undefined = undefined;

    private initCardLockFacility(): void {

        debug("Init cardLockFacility");

        let cardLockFacility = new CardLockFacility(this.atStack);

        cardLockFacility.evtUnlockCodeRequest.attach(({ pinState, times }) => {

            this.params.unlockCodeProvider(this.imei, this.iccid, pinState, times, (...inputs) => {

                switch (pinState) {
                    case "SIM PIN":
                        this.pin = inputs[0];
                        cardLockFacility.enterPin(inputs[0]);
                        return;
                    case "SIM PUK":
                        this.pin = inputs[1];
                        cardLockFacility.enterPuk(inputs[0], inputs[1]);
                        return;
                    case "SIM PIN2": cardLockFacility.enterPin2(inputs[0]); return;
                    case "SIM PUK2": cardLockFacility.enterPuk2(inputs[0], inputs[1]); return;
                }

            });



        });

        let firstTime = true;



        cardLockFacility.evtPinStateReady.attachOnce(this, async function callee() {

            if (firstTime) debug("SIM unlocked");

            let self = this as Modem;

            if (!self.systemState.isValidSim) {
                firstTime = false;
                self.systemState.evtValidSim.attachOnce(() => callee.call(self));
                return;
            }

            debug("SIM valid");

            //this.atStack.runCommand("AT^SPN=0\r", { "recoverable": true }, (resp, final) => console.log("=====>",resp, final));

            /*

            this.runCommand("AT+IPR?\r", { "recoverable": true }, (_, __, raw) => console.log(raw));

            this.runCommand("AT+CLAC\r",
                ({ supportedCommands }: AtMessage.P_CLAC_EXEC) => { debug("CLAC successful"); this.supportedCommands = supportedCommands; }
            );

            */

            if( !self.iccidAvailableBeforeUnlock ){

                self.iccid= await self.readIccid();

                debug("ICCID after unlock: ", self.iccid);

            }

            let [resp] = await pr.typed(
                self.atStack,
                self.atStack.runCommandDefault
            )("AT+CIMI\r");

            self.imsi = resp!.raw.split("\r\n")[1];

            debug("IMSI: ", self.imsi);

            if (self.params.enableSmsStack) self.initSmsStack();
            if (self.params.enableCardStorage) self.initCardStorage();
            else self.callback(null, self, true);

        });

    }

    private smsStack: SmsStack;

    public readonly evtMessage = new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();

    private initSmsStack(): void {

        debug("Init smsStack");

        this.smsStack = new SmsStack(this.atStack);

        this.smsStack.evtMessage.attach(data => {
            if (!this.evtMessage.evtAttach.postCount)
                this.evtMessage.evtAttach.attachOnce(() => this.evtMessage.post(data));
            else
                this.evtMessage.post(data);
        });

        this.smsStack.evtMessageStatusReport.attach(data => {
            if (!this.evtMessageStatusReport.evtAttach.postCount)
                this.evtMessageStatusReport.evtAttach.attachOnce(() => this.evtMessageStatusReport.post(data));
            else
                this.evtMessageStatusReport.post(data);
        });

    }


    public sendMessage = execStack(function callee(...inputs) {

        let self = this as Modem;

        if (!self.systemState.isNetworkReady) {
            self.systemState.evtNetworkReady.attachOnce(() => callee.apply(self, inputs));
            return;
        }

        self.smsStack.sendMessage.apply(self.smsStack, inputs);

    } as typeof SmsStack.prototype.sendMessage);




    private cardStorage: CardStorage;

    private initCardStorage(): void {

        debug("Init cardStorage");

        this.cardStorage = new CardStorage(this.atStack);

        this.cardStorage.evtReady.attachOnce(() => this.callback(null, this, true));

    }

    public get number(): typeof CardStorage.prototype.number {
        return this.cardStorage.number;
    }

    public get contacts(): typeof CardStorage.prototype.contacts {
        return this.cardStorage.contacts;
    }

    public get contactNameMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        return this.cardStorage.contactNameMaxLength;
    }

    public get numberMaxLength(): typeof CardStorage.prototype.contactNameMaxLength {
        return this.cardStorage.numberMaxLength;
    }

    public get storageLeft(): typeof CardStorage.prototype.storageLeft {
        return this.cardStorage.storageLeft;
    }

    public generateSafeContactName: typeof CardStorage.prototype.generateSafeContactName =
    (...inputs) => this.cardStorage.generateSafeContactName.apply(this.cardStorage, inputs);

    public getContact: typeof CardStorage.prototype.getContact =
    (...inputs) => this.cardStorage.getContact.apply(this.cardStorage, inputs);

    public createContact = execStack(Modem, "WRITE", (
        (...inputs) => this.cardStorage.createContact.apply(this.cardStorage, inputs)
    ) as typeof CardStorage.prototype.createContact);

    public updateContact = execStack(Modem, "WRITE", (
        (...inputs) => this.cardStorage.updateContact.apply(this.cardStorage, inputs)
    ) as typeof CardStorage.prototype.updateContact);

    public deleteContact = execStack(Modem, "WRITE", (
        (...inputs) => this.cardStorage.deleteContact.apply(this.cardStorage, inputs)
    ) as typeof CardStorage.prototype.deleteContact);

    public writeNumber = execStack(Modem, "WRITE", (
        (...inputs) => this.cardStorage.writeNumber.apply(this.cardStorage, inputs)
    ) as typeof CardStorage.prototype.writeNumber);


}