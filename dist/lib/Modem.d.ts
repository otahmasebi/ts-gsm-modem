import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { CardStorage } from "./CardStorage";
import { Message, StatusReport } from "./SmsStack";
import { SyncEvent } from "ts-events-extended";
import "colors";
export declare type UnlockResult = UnlockResult.Success | UnlockResult.Failed;
export declare namespace UnlockResult {
    type Success = {
        success: true;
    };
    type Failed = {
        success: false;
        pinState: AtMessage.LockedPinState;
        tryLeft: number;
    };
}
export interface PerformUnlock {
    (pin: string): Promise<UnlockResult>;
    (puk: string, newPin: string): Promise<UnlockResult>;
}
export interface UnlockCodeProvider {
    (modemInfos: {
        imei: string;
        manufacturer: string;
        model: string;
        firmwareVersion: string;
    }, iccid: string | undefined, pinState: AtMessage.LockedPinState, tryLeft: number, performUnlock: PerformUnlock, terminate: () => Promise<void>): void;
}
export interface UnlockCode {
    pinFirstTry: string;
    pinSecondTry?: string;
}
export declare class InitializationError extends Error {
    readonly srcError: Error;
    readonly dataIfPath: string;
    readonly modemInfos: Partial<{
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
    }>;
    constructor(srcError: Error, dataIfPath: string, modemInfos: Partial<{
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
    }>);
    toString(): string;
}
export declare namespace InitializationError {
    class DidNotTurnBackOnAfterReboot extends InitializationError {
        constructor(dataIfPath: string);
    }
}
export declare class Modem {
    private dataIfPath;
    private readonly enableSmsStack;
    private readonly enableCardStorage;
    private readonly log;
    private readonly resolveConstructor;
    /**
     * Note: if no log is passed then console.log is used.
     * If log is false no log.
     * throw InitializationError
     * rebootFist default to false
     */
    static create(params: {
        dataIfPath: string;
        unlock?: UnlockCode | UnlockCodeProvider;
        disableSmsFeatures?: boolean;
        disableContactsFeatures?: boolean;
        rebootFirst?: boolean;
        log?: typeof console.log | false;
    }): Promise<Modem>;
    private atStack;
    private systemState;
    imei: string;
    manufacturer: string;
    model: string;
    firmwareVersion: string;
    iccid: string;
    iccidAvailableBeforeUnlock: boolean | undefined;
    imsi: string;
    serviceProviderName: string | undefined;
    isVoiceEnabled: boolean | undefined;
    readonly evtTerminate: SyncEvent<Error | null>;
    private readonly unlockCodeProvider;
    private onInitializationCompleted;
    private hasSim;
    private debug;
    private constructor();
    private initAtStack;
    private buildUnlockCodeProvider;
    private readIccid;
    readonly runCommand: {
        (command: string): Promise<import("./AtStack").RunOutputs>;
        (command: String, params: {
            recoverable?: boolean | undefined;
            reportMode?: AtMessage.ReportMode | undefined;
            retryOnErrors?: boolean | number[] | undefined;
        }): Promise<import("./AtStack").RunOutputs>;
    };
    readonly runCommand_isRunning: boolean;
    readonly runCommand_queuedCallCount: number;
    runCommand_cancelAllQueuedCalls(): number;
    terminate(): Promise<void>;
    readonly terminateState: "TERMINATED" | "TERMINATING" | undefined;
    readonly evtUnsolicitedAtMessage: typeof AtStack.prototype.evtUnsolicitedMessage;
    lastPinTried: string | undefined;
    validSimPin: string | undefined;
    private initCardLockFacility;
    private smsStack;
    readonly evtMessage: SyncEvent<Message>;
    readonly evtMessageStatusReport: SyncEvent<StatusReport>;
    private initSmsStack;
    sendMessage: (number: string, text: string) => Promise<Date | undefined>;
    private cardStorage;
    private initCardStorage;
    readonly number: typeof CardStorage.prototype.number;
    readonly contacts: typeof CardStorage.prototype.contacts;
    readonly contactNameMaxLength: typeof CardStorage.prototype.contactNameMaxLength;
    readonly numberMaxLength: typeof CardStorage.prototype.contactNameMaxLength;
    readonly storageLeft: typeof CardStorage.prototype.storageLeft;
    generateSafeContactName: typeof CardStorage.prototype.generateSafeContactName;
    getContact: typeof CardStorage.prototype.getContact;
    createContact: typeof CardStorage.prototype.createContact;
    updateContact: typeof CardStorage.prototype.updateContact;
    deleteContact: typeof CardStorage.prototype.deleteContact;
    writeNumber: typeof CardStorage.prototype.writeNumber;
    /** Issue AT\r command */
    ping(): Promise<void>;
}
