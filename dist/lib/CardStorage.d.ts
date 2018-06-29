import { AtStack } from "./AtStack";
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
    readonly evtReady: any;
    readonly isReady: boolean;
    readonly contacts: Contact[];
    getContact(index: number): Contact | undefined;
    readonly contactNameMaxLength: number;
    readonly numberMaxLength: number;
    readonly storageLeft: number;
    generateSafeContactName(contactName: string): string;
    constructor(atStack: AtStack, debug: typeof console.log);
    private p_CPBR_TEST;
    private getFreeIndex;
    createContact: any;
    updateContact: any;
    deleteContact: any;
    number: string | undefined;
    writeNumber: any;
    private readonly contactByIndex;
    private init;
    private static encodeUCS2;
    private static decodeUCS2;
    private static printableLength;
    private static countFFFD;
    private static countUnprintableChar;
    private static hasExtendedChar;
}
