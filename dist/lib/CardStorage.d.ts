import { AtStack } from "./AtStack";
import { VoidEvt } from "ts-evt";
export declare type Encoding = "IRA" | "GSM" | "UCS2";
export interface Contact {
    index: number;
    number: string;
    name: string;
}
export declare class CardStorage {
    private readonly atStack;
    private readonly debug;
    readonly evtReady: VoidEvt;
    get isReady(): boolean;
    get contacts(): Contact[];
    getContact(index: number): Contact | undefined;
    get contactNameMaxLength(): number;
    get numberMaxLength(): number;
    get storageLeft(): number;
    generateSafeContactName(contactName: string): string;
    constructor(atStack: AtStack, debug: typeof console.log);
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
