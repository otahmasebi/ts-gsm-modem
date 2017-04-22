import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { CardStorage, Contact } from "./CardStorage";
import { Message, StatusReport } from "./SmsStack";
import { SyncEvent } from "ts-events-extended";
import { ExecQueue } from "ts-exec-queue";
export interface UnlockCodeProviderCallback {
    (pin: string): void;
    (puk: string, newPin: string): void;
}
export interface UnlockCodeProvider {
    handler(imei: string, iccid: string, pinState: AtMessage.LockedPinState, tryLeft: number, callback: UnlockCodeProviderCallback): void;
    explicit: {
        pinFirstTry: string;
        pinSecondTry?: string;
    };
}
export declare type CreateCallback = (error: null | Error, modem: Modem, hasSim: boolean) => void;
export declare class Modem {
    private readonly params;
    private readonly callback;
    private static getSafeUnlockCodeProvider(unlockCodeProvider);
    static create(params: {
        path: string;
        unlockCodeProvider?: UnlockCodeProvider['handler'] | UnlockCodeProvider['explicit'];
        disableSmsFeatures?: boolean;
        disableContactsFeatures?: boolean;
    }, callback?: CreateCallback): Promise<[null | Error, Modem, boolean]>;
    private readonly atStack;
    private readonly systemState;
    imei: string;
    iccid: string;
    iccidAvailableBeforeUnlock: boolean;
    imsi: string;
    serviceProviderName: string | undefined;
    private constructor(params, callback);
    private readIccid();
    readonly runCommand: {
        (command: string, callback?: ((resp: AtMessage | undefined, final: AtMessage, raw: string) => void) | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
        (command: String, params: {
            recoverable?: boolean | undefined;
            reportMode?: AtMessage.ReportMode | undefined;
            retryOnErrors?: boolean | number[] | undefined;
        }, callback?: ((resp: AtMessage | undefined, final: AtMessage, raw: string) => void) | undefined): Promise<[AtMessage | undefined, AtMessage, string]>;
    } & ExecQueue;
    terminate: typeof AtStack.prototype.terminate;
    readonly isTerminated: typeof AtStack.prototype.isTerminated;
    readonly evtTerminate: typeof AtStack.prototype.evtTerminate;
    readonly evtUnsolicitedAtMessage: typeof AtStack.prototype.evtUnsolicitedMessage;
    pin: string | undefined;
    private initCardLockFacility();
    private smsStack;
    readonly evtMessage: SyncEvent<Message>;
    readonly evtMessageStatusReport: SyncEvent<StatusReport>;
    private initSmsStack();
    sendMessage: ((number: string, text: string, callback?: ((messageId: number) => void) | undefined) => Promise<number>) & ExecQueue;
    private cardStorage;
    private initCardStorage();
    readonly number: typeof CardStorage.prototype.number;
    readonly contacts: typeof CardStorage.prototype.contacts;
    readonly contactNameMaxLength: typeof CardStorage.prototype.contactNameMaxLength;
    readonly numberMaxLength: typeof CardStorage.prototype.contactNameMaxLength;
    readonly storageLeft: typeof CardStorage.prototype.storageLeft;
    generateSafeContactName: typeof CardStorage.prototype.generateSafeContactName;
    getContact: typeof CardStorage.prototype.getContact;
    createContact: ((number: string, name: string, callback?: ((contact: Contact) => void) | undefined) => Promise<Contact>) & ExecQueue;
    updateContact: ((index: number, params: {
        number?: string | undefined;
        name?: string | undefined;
    }, callback?: ((contact: Contact) => void) | undefined) => Promise<Contact>) & ExecQueue;
    deleteContact: ((index: number, callback?: (() => void) | undefined) => Promise<void>) & ExecQueue;
    writeNumber: ((number: string, callback?: (() => void) | undefined) => Promise<void>) & ExecQueue;
}
