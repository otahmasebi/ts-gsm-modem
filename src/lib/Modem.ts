import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { SystemState } from "./SystemState";
import { CardLockFacility, UnlockCodeRequest } from "./CardLockFacility";
//@ts-ignore: Contact need to be imported as it is used as return type.
import { CardStorage, Contact } from "./CardStorage";
import { SmsStack, Message, StatusReport } from "./SmsStack";
import { Evt, UnpackEvt } from "evt";
import * as runExclusive from "run-exclusive";
import * as util from "util";
import * as logger from "logger";
import { Monitor as ConnectionMonitor } from "gsm-modem-connection";

import "colors";

export type UnlockResult = UnlockResult.Success | UnlockResult.Failed;

export namespace UnlockResult {

    export type Success = { success: true; };
    export type Failed = { success: false; pinState: AtMessage.LockedPinState; tryLeft: number; };

}

export interface PerformUnlock {
    (pin: string): Promise<UnlockResult>;
    (puk: string, newPin: string): Promise<UnlockResult>;
}

export interface UnlockCodeProvider {
    (
        modemInfos: {
            imei: string,
            manufacturer: string,
            model: string,
            firmwareVersion: string,
        },
        iccid: string | undefined,
        pinState: AtMessage.LockedPinState,
        tryLeft: number,
        performUnlock: PerformUnlock,
        terminate: () => Promise<void>
    ): void;
}

export interface UnlockCode {
    pinFirstTry: string;
    pinSecondTry?: string;
}

export class InitializationError extends Error {
    constructor(
        public readonly srcError: Error,
        public readonly dataIfPath: string,
        public readonly modemInfos: Partial<{
            successfullyRebooted: true,
            hasSim: boolean;
            imei: string;
            manufacturer: string;
            model: string;
            firmwareVersion: string;
            iccid: string;
            iccidAvailableBeforeUnlock: boolean;
            validSimPin: string;
            lastPinTried: string;
            imsi: string;
            serviceProviderName: string;
            isVoiceEnabled: boolean;
        }>
    ) {
        super(`Failed to initialize modem on ${dataIfPath}`);
        Object.setPrototypeOf(this, new.target.prototype);
    }

    public toString(): string {

        return [
            `InitializationError: ${this.message}`,
            `Cause: ${this.srcError}`,
            `Modem infos: ${util.format(this.modemInfos)}`
        ].join("\n");

    }
}

export namespace InitializationError {

    export class DidNotTurnBackOnAfterReboot extends InitializationError {
        constructor(dataIfPath: string) {
            super(
                new Error("Modem did not turned back on after issuing reboot AT command"),
                dataIfPath,
                {}
            );
        }
    };

    export class WontShutdownForReboot extends InitializationError {
        constructor(dataIfPath: string) {
            super(
                new Error("Modem reboot unsuccessful, timeout waiting for Modem to shutdown"),
                dataIfPath,
                {}
            );
        }
    };

}

export class Modem {

    /**
     * Note: if no log is passed then console.log is used.
     * If log is false no log.
     * throw InitializationError
     * rebootFist default to false
     */
    public static create(
        params: {
            dataIfPath: string;
            unlock?: UnlockCode | UnlockCodeProvider,
            disableSmsFeatures?: boolean;
            disableContactsFeatures?: boolean;
            rebootFirst?: boolean;
            log?: typeof console.log | false;
        }
    ) {
        return new Promise<Modem>(
            (resolve, reject) => {

                const enableSmsStack = !(params.disableSmsFeatures === true);
                const enableCardStorage = !(params.disableContactsFeatures === true);
                const log: typeof console.log = (() => {

                    switch (params.log) {
                        case undefined: return console.log.bind(console);
                        case false: return () => { };
                        default: return params.log;
                    }

                })();

                new Modem(
                    params.dataIfPath,
                    params.unlock,
                    enableSmsStack,
                    enableCardStorage,
                    !!params.rebootFirst,
                    log,
                    result => (result instanceof Modem) ? resolve(result) : reject(result)
                );

            }
        );

    }

    private atStack!: AtStack;
    private systemState!: SystemState;

    public successfullyRebooted: undefined | true= undefined;

    public imei!: string;
    public manufacturer!: string;
    public model!: string;
    public firmwareVersion!: string;

    public iccid!: string;
    public iccidAvailableBeforeUnlock: boolean | undefined = undefined;
    public imsi!: string;
    public serviceProviderName: string | undefined = undefined;
    public isVoiceEnabled: boolean | undefined = undefined;

    public readonly evtTerminate = new Evt<Error | null>();

    private readonly unlockCodeProvider: UnlockCodeProvider | undefined = undefined;
    private onInitializationCompleted!: (error?: Error) => void;

    private hasSim: boolean | undefined = undefined;

    private debug!: typeof console.log;

    private constructor(
        private dataIfPath: string,
        unlock: UnlockCodeProvider | UnlockCode | undefined,
        private readonly enableSmsStack: boolean,
        private readonly enableCardStorage: boolean,
        rebootFirst: boolean,
        private readonly log: typeof console.log,
        private readonly resolveConstructor: (result: Modem | InitializationError) => void
    ) {

        const setDebug = () => this.debug = logger.debugFactory(
            `Modem ${this.dataIfPath}`, true, this.log
        );

        setDebug();

        this.debug("Initializing GSM Modem");

        if (typeof unlock === "function") {
            this.unlockCodeProvider = unlock;
        } else if (unlock) {
            this.unlockCodeProvider = this.buildUnlockCodeProvider(unlock);
        }

        if (!rebootFirst) {

            this.initAtStack();

            return;

        }

        if (!ConnectionMonitor.hasInstance) {

            this.debug("Connection monitor not used, skipping preliminary modem reboot");

            this.initAtStack();

            return;

        }

        const cm = ConnectionMonitor.getInstance();

        const accessPoint = Array.from(cm.connectedModems)
            .find(({ dataIfPath }) => dataIfPath === this.dataIfPath)
            ;

        if (!accessPoint) {
            this.resolveConstructor(new InitializationError(
                new Error("According to gsm-modem-connection modem does not seem to be connected on specified interface"),
                this.dataIfPath,
                {}
            ));
            return;
        }

        this.debug(`Performing preliminary modem (${accessPoint.id}) reboot by issuing the AT command to restart MT`);

        (new AtStack(this.dataIfPath, () => { })).terminate("RESTART MT");

        cm.evtModemDisconnect.attachOnceExtract(
            ap => ap === accessPoint,
            15000,
            () => {

                this.debug(`Modem (${accessPoint.id}) shutdown as expected ( evtModemDisconnect extracted )`);

                cm.evtModemConnect.attachOnceExtract(
                    ({ id }) => id === accessPoint.id,
                    30000,
                    ({ dataIfPath }) => {

                        this.dataIfPath = dataIfPath;

                        setDebug();

                        this.debug(`Modem (${accessPoint.id}) turned back on successfully ( evtModemConnect extracted )`);

                        this.successfullyRebooted= true;

                        this.initAtStack();

                    }
                ).catch(() => this.resolveConstructor(
                    new InitializationError.DidNotTurnBackOnAfterReboot(dataIfPath)
                ));


            }
        ).catch(() => this.resolveConstructor(
            new InitializationError.WontShutdownForReboot(dataIfPath)
        ));

    }

    public get evtGsmConnectivityChange(): typeof SystemState.prototype.evtGsmConnectivityChange {
        return this.systemState.evtGsmConnectivityChange;
    }

    public get evtCellSignalStrengthTierChange(): typeof SystemState.prototype.evtCellSignalStrengthTierChange {
        return this.systemState.evtCellSignalStrengthTierChange;
    }

    public isGsmConnectivityOk() {
        return this.systemState.isGsmConnectivityOk();
    }

    public getCurrentGsmConnectivityState(){
        return this.systemState.getCurrentState();
    }

    public getCurrentGsmConnectivityStateHumanReadable(){
        return this.systemState.getCurrentStateHumanlyReadable();
    }

    private async initAtStack(): Promise<void> {

        this.atStack = new AtStack(
            this.dataIfPath,
            logger.debugFactory(`AtStack ${this.dataIfPath}`, true, this.log)
        );

        this.onInitializationCompleted = error => {

            this.atStack.evtTerminate.detach(Evt.getCtx(this));

            if (!!error) {

                const initializationError = new InitializationError(
                    error,
                    this.dataIfPath,
                    {
                        "successfullyRebooted": this.successfullyRebooted,
                        "hasSim": this.hasSim,
                        "imei": this.imei,
                        "manufacturer": this.manufacturer,
                        "model": this.model,
                        "firmwareVersion": this.firmwareVersion,
                        "iccid": this.iccid,
                        "iccidAvailableBeforeUnlock": this.iccidAvailableBeforeUnlock,
                        "validSimPin": this.validSimPin,
                        "lastPinTried": this.lastPinTried,
                        "imsi": this.imsi,
                        "serviceProviderName": this.serviceProviderName,
                        "isVoiceEnabled": this.isVoiceEnabled
                    }
                );

                this.debug(initializationError.toString().red);

                if (!!this.smsStack) {

                    this.smsStack.clearAllTimers();

                }

                this.atStack.terminate().then(
                    () => this.resolveConstructor(initializationError)
                );

                return;

            }

            this.atStack.evtTerminate.attach(async error => {

                this.debug(
                    !!error ?
                        `terminate with error: ${error}`.red :
                        `terminate without error`
                );

                if (!!this.smsStack) {

                    this.smsStack.clearAllTimers();

                }

                this.evtTerminate.post(error);

            });

            this.resolveConstructor(this);


        };

        //NOTE: A locked modem can be terminated by the user ( via the unlock code provider )
        //and if so the error object is null. But we don't want to throw an error in this case.
        this.atStack.evtTerminate.attachOnce(
            error => !!error,
            Evt.getCtx(this),
            error => this.onInitializationCompleted(error!) 
        );

        this.atStack.runCommand("AT+CGSN\r").then(({ resp }) => {
            /*
            NOTE: Here we perform this extra test because this is the first
            command issued that expect an output. It turns out that 
            we can have some leftover \r\nOK\r\n from previous command
            interpreted as a response to CGSN ( see Alan Ho logs ).
            Hopefully it will never happen as we increased the rewrite 
            timeout but if despite that it still happen it should not crash 
            the whole program.
            */
            try {
                this.imei = resp!.raw.match(/^\r\n(.*)\r\n$/)![1];
            } catch{
                this.imei = "ERROR";
            }

            if (this.imei.match(/^[0-9]{15}$/) === null) {
                this.onInitializationCompleted(
                    new Error("Something went wrong at the very beginning of modem initialization")
                );
                return;
            }

            this.debug(`IMEI: ${this.imei}`);
        });

        this.atStack.runCommand("AT+CGMI\r").then(({ resp }) => {
            this.manufacturer = resp!.raw.match(/^\r\n(.*)\r\n$/)![1];
            this.debug(`manufacturer: ${this.manufacturer}`);
        });

        this.atStack.runCommand("AT+CGMM\r").then(({ resp }) => {
            this.model = resp!.raw.match(/^\r\n(.*)\r\n$/)![1];
            this.debug(`model: ${this.model}`);
        });

        this.atStack.runCommand("AT+CGMR\r").then(({ resp }) => {
            this.firmwareVersion = resp!.raw.match(/^\r\n(.*)\r\n$/)![1];
            this.debug(`firmwareVersion: ${this.firmwareVersion}`);
        });

        this.systemState = new SystemState(
            this.atStack,
            logger.debugFactory(`SystemState ${this.dataIfPath}`, true, this.log)
        );

        this.hasSim = await this.systemState.prHasSim;

        this.debug(`SIM present: ${this.hasSim}`);

        if (!this.hasSim) {
            this.onInitializationCompleted(new Error("Modem has no SIM card"));
            return;
        }

        this.iccid = await this.readIccid();

        if (this.iccid) {
            this.debug(`ICCID: ${this.iccid}`);
        }

        this.initCardLockFacility();

    }

    private buildUnlockCodeProvider(unlockCode: UnlockCode): UnlockCodeProvider {

        return async (_modemInfos, _iccid, pinState, tryLeft, performUnlock) => {

            this.debug(`Sim locked...`);

            for (const pin of [unlockCode.pinFirstTry, unlockCode.pinSecondTry, undefined]) {

                if (!pin || pinState !== "SIM PIN") {
                    this.onInitializationCompleted(
                        new Error(`Unlock failed ${pinState}, ${tryLeft}`)
                    );
                    return;
                }

                if (tryLeft === 1) {
                    this.onInitializationCompleted(
                        new Error("Prevent unlock sim, only one try left")
                    );
                    return;
                }

                this.debug(`Attempting unlock with ${pin}`);

                let unlockResult = await performUnlock(pin);

                if (unlockResult.success) {
                    this.debug("Unlock success");
                    return;
                }

                pinState = unlockResult.pinState;
                tryLeft = unlockResult.tryLeft;

                this.debug(`Unlock attempt failed ${pinState}, ${tryLeft}`);

            }

        };

    }

    private async readIccid(): Promise<string> {

        let switchedIccid: string | undefined;

        const { resp, final } = await this.atStack.runCommand(
            "AT^ICCID?\r",
            { "recoverable": true }
        );

        if (final.isError) {

            const { resp, final } = await this.atStack.runCommand(
                "AT+CRSM=176,12258,0,0,10\r",
                { "recoverable": true }
            );

            if (final.isError) {
                switchedIccid = undefined;
            } else {
                switchedIccid = (resp as AtMessage.P_CRSM_SET).response!;
            }

        } else {

            switchedIccid = (resp as AtMessage.CX_ICCID_SET).iccid;

        }

        return (function unswitch(switched): string {

            let out = "";

            if (!switched) return out;

            for (let i = 0; i < switched.length; i += 2)
                out += switched[i + 1] + switched[i];

            if (out[out.length - 1].match(/^[Ff]$/))
                out = out.slice(0, -1);

            return out;

        })(switchedIccid);

    }


    public readonly runCommand = runExclusive.buildMethod(
        ((...inputs) => this.atStack.runCommand.apply(this.atStack, inputs)
        ) as typeof AtStack.prototype.runCommand
    );

    public get runCommand_isRunning(): boolean {
        return runExclusive.isRunning(this.runCommand, this);
    }

    public get runCommand_queuedCallCount(): number {
        return runExclusive.getQueuedCallCount(this.runCommand, this);
    }

    public runCommand_cancelAllQueuedCalls(): number {
        return runExclusive.cancelAllQueuedCalls(this.runCommand, this);
    }

    public terminate(): Promise<void> {

        if (!!this.smsStack) {

            this.smsStack.clearAllTimers();

        }

        return this.atStack.terminate();

    }

    public get terminateState() {
        return this.atStack.terminateState;
    }

    public get evtUnsolicitedAtMessage(): typeof AtStack.prototype.evtUnsolicitedMessage {
        return this.atStack.evtUnsolicitedMessage;
    }

    public lastPinTried: string | undefined = undefined;
    public validSimPin: string | undefined = undefined;

    private async initCardLockFacility(): Promise<void> {

        let cardLockFacility = new CardLockFacility(
            this.atStack,
            logger.debugFactory(`CardLockFacility ${this.dataIfPath}`, true, this.log)
        );

        cardLockFacility.evtUnlockCodeRequest.attachOnce(
            ({ pinState, times }) => {

                const iccid = this.iccid || undefined;

                this.iccidAvailableBeforeUnlock = !!iccid;

                if (!this.unlockCodeProvider) {

                    this.onInitializationCompleted(
                        new Error("SIM card is pin locked but no code was provided")
                    );

                    return;

                }

                this.unlockCodeProvider(
                    {
                        "imei": this.imei,
                        "manufacturer": this.manufacturer,
                        "model": this.model,
                        "firmwareVersion": this.firmwareVersion
                    },
                    iccid,
                    pinState,
                    times,
                    async (...inputs) => {

                        if (!!this.atStack.terminateState) {
                            throw new Error("This modem is no longer available");
                        }

                        switch (pinState) {
                            case "SIM PIN":
                                this.lastPinTried = inputs[0];
                                cardLockFacility.enterPin(inputs[0]);
                                break;
                            case "SIM PUK":
                                this.lastPinTried = inputs[1];
                                cardLockFacility.enterPuk(inputs[0], inputs[1]);
                                break;
                            case "SIM PIN2":
                                cardLockFacility.enterPin2(inputs[0]);
                                break;
                            case "SIM PUK2":
                                cardLockFacility.enterPuk2(inputs[0], inputs[1]);
                                break;
                        }

                        const ctx= Evt.newCtx();

                        const _result = await Promise.race([
                            new Promise<{ type: "SUCCESS"; }>(
                                resolve => cardLockFacility.evtPinStateReady.attachOnce(
                                    ctx,
                                    () => resolve({ "type": "SUCCESS" })
                                )
                            ),
                            new Promise<{ type: "FAILED"; unlockCodeRequest: UnlockCodeRequest }>(
                                resolve => cardLockFacility.evtUnlockCodeRequest.attachOnce(
                                    ctx,
                                    unlockCodeRequest => resolve({ "type": "FAILED", unlockCodeRequest })
                                )
                            ),
                            new Promise<{ type: "TERMINATE"; error: UnpackEvt<typeof AtStack.prototype.evtTerminate>; }>(
                                resolve => this.atStack.evtTerminate.attachOnce(
                                    ctx,
                                    error => resolve({ "type": "TERMINATE", error })
                                )
                            )
                        ]);

                        ctx.done();


                        switch (_result.type) {
                            case "SUCCESS":

                                const resultSuccess: UnlockResult.Success = {
                                    "success": true
                                };

                                return resultSuccess;

                            case "FAILED":

                                const resultFailed: UnlockResult.Failed = {
                                    "success": false,
                                    "pinState": _result.unlockCodeRequest.pinState,
                                    "tryLeft": _result.unlockCodeRequest.times
                                };

                                return resultFailed;

                            case "TERMINATE":

                                throw (
                                    _result.error ||
                                    new Error("Terminate have been called while the modem was being unlocked")
                                );

                        }


                    },
                    () => this.atStack.terminate()
                );


            }
        );

        await cardLockFacility.evtPinStateReady.waitFor();

        if (this.lastPinTried) {
            this.validSimPin = this.lastPinTried;
        }

        this.debug("SIM unlocked");

        switch (await Promise.race((() => {

            const ctx = Evt.newCtx();

            return [
                this.atStack.evtTerminate.attachOnce(
                    ctx,
                    45000,
                    () => { }
                )
                    .then(() => "TERMINATED" as const)
                    .catch(() => "TIMEOUT" as const),
                this.systemState.prValidSim
                    .then(() => {
                        ctx.done();
                        return "VALID SIM" as const;
                    })

            ];

        })())) {
            case "TIMEOUT":
                this.onInitializationCompleted(
                    new Error([
                        `timeout waiting for the sim to be deemed valid, `,
                        `current SIM state: ${AtMessage.SimState[this.systemState.getCurrentState().simState]}`
                    ].join(" "))
                );
            case "TERMINATED":
                await new Promise(() => { });
            case "VALID SIM": break;
        }

        this.debug("SIM valid");

        {

            const { resp: cx_SPN_SET } = await this.atStack.runCommand(
                "AT^SPN=0\r",
                { "recoverable": true }
            );

            if (cx_SPN_SET) {
                this.serviceProviderName = (cx_SPN_SET as AtMessage.CX_SPN_SET).serviceProviderName;
            }

        }

        this.debug(`Service Provider name: ${this.serviceProviderName}`);

        if (!this.iccidAvailableBeforeUnlock) {

            this.iccid = await this.readIccid();

            this.debug(`ICCID ( read after unlock ): ${this.iccid}`);

        }

        {

            const { resp } = await this.atStack.runCommand("AT+CIMI\r");

            this.imsi = resp!.raw.split("\r\n")[1];

            this.debug(`IMSI: ${this.imsi}`);

        }

        let resp_CX_CVOICE_SET = await this.atStack.runCommand(
            "AT^CVOICE=0\r",
            { "recoverable": true }
        );

        if (!resp_CX_CVOICE_SET.final.isError) {

            let { resp: cx_CVOICE_READ } = await this.atStack.runCommand(
                "AT^CVOICE?\r",
                { "recoverable": true }
            );

            if (cx_CVOICE_READ) {
                this.isVoiceEnabled = (cx_CVOICE_READ as AtMessage.CX_CVOICE_READ).isEnabled;
            }

        }

        this.debug("VOICE ENABLED: ", this.isVoiceEnabled);

        if (this.enableSmsStack) this.initSmsStack();

        if (this.enableCardStorage) this.initCardStorage();
        else this.onInitializationCompleted();

    }

    private smsStack!: SmsStack;

    public readonly evtMessage = new Evt<Message>();
    public readonly evtMessageStatusReport = new Evt<StatusReport>();

    private initSmsStack(): void {

        this.smsStack = new SmsStack(
            this.atStack,
            logger.debugFactory(`SmsStack ${this.dataIfPath}`, true, this.log)
        );

        this.smsStack.evtMessage.attach(async message => {

            this.debug("MESSAGE RECEIVED", message);

            if (!this.evtMessage.getEvtAttach().postCount) {
                await this.evtMessage.getEvtAttach().waitFor();
            }

            this.evtMessage.post(message);

        });

        this.smsStack.evtMessageStatusReport.attach(async statusReport => {

            this.debug("STATUS REPORT RECEIVED", statusReport);

            if (!this.evtMessageStatusReport.getEvtAttach().postCount) {
                await this.evtMessageStatusReport.getEvtAttach().waitFor();
            }

            this.evtMessageStatusReport.post(statusReport);

        });

    }

    public sendMessage = runExclusive.buildMethod(
        (async (...inputs) => {

            if (!this.systemState.isGsmConnectivityOk()) {
                await this.systemState.evtGsmConnectivityChange.waitFor();
            }

            return this.smsStack.sendMessage.apply(this.smsStack, inputs);

        }) as typeof SmsStack.prototype.sendMessage
    );

    private cardStorage!: CardStorage;

    private async initCardStorage(): Promise<void> {

        this.cardStorage = new CardStorage(
            this.atStack,
            logger.debugFactory(`CardStorage ${this.dataIfPath}`, true, this.log)
        );

        await this.cardStorage.evtReady.waitFor();

        this.onInitializationCompleted();

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


    public createContact: typeof CardStorage.prototype.createContact =
        (...inputs) => this.cardStorage.createContact.apply(this.cardStorage, inputs);

    public updateContact: typeof CardStorage.prototype.updateContact =
        (...inputs) => this.cardStorage.updateContact.apply(this.cardStorage, inputs);

    public deleteContact: typeof CardStorage.prototype.deleteContact =
        (...inputs) => this.cardStorage.deleteContact.apply(this.cardStorage, inputs);

    public writeNumber: typeof CardStorage.prototype.writeNumber =
        (...inputs) => this.cardStorage.writeNumber.apply(this.cardStorage, inputs);


    /** Issue AT\r command */
    public async ping() {

        await this.atStack.runCommand("AT\r");

    }

}