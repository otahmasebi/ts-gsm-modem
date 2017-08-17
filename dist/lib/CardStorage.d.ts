import { AtStack } from "./AtStack";
import { VoidSyncEvent } from "ts-events-extended";
export declare type Encoding = "IRA" | "GSM" | "UCS2";
export interface Contact {
    index: number;
    number: string;
    name: string;
}
export declare class CardStorage {
    private readonly atStack;
    readonly evtReady: VoidSyncEvent;
    readonly isReady: boolean;
    readonly contacts: Contact[];
    getContact(index: number): Contact | undefined;
    readonly contactNameMaxLength: number;
    readonly numberMaxLength: number;
    readonly storageLeft: number;
    generateSafeContactName(contactName: string): string;
    constructor(atStack: AtStack);
    private p_CPBR_TEST;
    private getFreeIndex();
    private storageAccessGroupRef;
    createContact: (number: string, name: string, callback?: ((contact: Contact) => void) | undefined) => Promise<Contact>;
    updateContact: (index: number, params: {
        number?: string | undefined;
        name?: string | undefined;
    }, callback?: ((contact: Contact) => void) | undefined) => Promise<Contact>;
    deleteContact: (index: number, callback?: (() => void) | undefined) => Promise<void>;
    number: string | undefined;
    writeNumber: (number: string, callback?: (() => void) | undefined) => Promise<void>;
    private readonly contactByIndex;
    private init();
    private static encodeUCS2(text);
    private static decodeUCS2(hexStr);
    private static printableLength(text);
    private static countFFFD(text);
    private static countUnprintableChar(text);
    private static hasExtendedChar(text);
}
