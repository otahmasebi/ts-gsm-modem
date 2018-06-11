import { AtStack } from "./AtStack";
import { VoidSyncEvent } from "ts-events-extended";
import * as debug from "debug";
export declare type Encoding = "IRA" | "GSM" | "UCS2";
export interface Contact {
    index: number;
    number: string;
    name: string;
}
export declare class CardStorageError extends Error {
    constructor(message: string);
}
export declare class CardStorage {
    private readonly atStack;
    private readonly debug;
    readonly evtReady: VoidSyncEvent;
    readonly isReady: boolean;
    readonly contacts: Contact[];
    getContact(index: number): Contact | undefined;
    readonly contactNameMaxLength: number;
    readonly numberMaxLength: number;
    readonly storageLeft: number;
    generateSafeContactName(contactName: string): string;
    constructor(atStack: AtStack, debug: debug.IDebugger);
    private p_CPBR_TEST;
    private getFreeIndex;
    createContact: (number: string, name: string) => Promise<Contact>;
    updateContact: (index: number, params: {
        number?: string | undefined;
        name?: string | undefined;
    }) => Promise<Contact>;
    deleteContact: (index: number) => Promise<void>;
    number: string | undefined;
    writeNumber: (number: string) => Promise<void>;
    private readonly contactByIndex;
    private init;
    private static encodeUCS2;
    private static decodeUCS2;
    private static printableLength;
    private static countFFFD;
    private static countUnprintableChar;
    private static hasExtendedChar;
}
