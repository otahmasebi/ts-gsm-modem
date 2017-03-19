import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { execStack, ExecStack } from "ts-exec-stack";
import * as pr from "ts-promisify";

import * as encoding from "legacy-encoding";

import * as _debug from "debug";
let debug= _debug("_CardStorage");


export type Encoding = "IRA" | "GSM" | "UCS2";

export type Action = "UPDATE" | "CREATE";


export interface Contact {
    index: number;
    number: string;
    name: string;
}

//TODO: CNUM 

export class CardStorage {

    public readonly evtReady = new VoidSyncEvent();

    public get isReady(): boolean {
        return this.evtReady.postCount === 1;
    }

    public get contacts(): Contact[] {

        let out: Contact[] = [];

        for (let indexStr of Object.keys(this.contactByIndex)) {

            let index = parseInt(indexStr);

            let contact= { ...this.contactByIndex[index] };

            out.push(contact);
        }

        return out;

    }

    public getContact(index: number): Contact | undefined {

        let contact = this.contactByIndex[index];

        return contact?{...contact}:undefined;

    }

    public get contactNameMaxLength(): number {
        return this.p_CPBR_TEST.tLength;
    }


    public get numberMaxLength(): number {
        return this.p_CPBR_TEST.nLength;
    }

    public get storageLeft(): number {

        let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

        let total = maxIndex - minIndex;

        return total - Object.keys(this.contactByIndex).length;

    }

    // cSpell:disable
    private static readonly replaceArray: [RegExp, string][] = [
        [/[ÀÁÂÃÄ]/g, "A"],
        [/[àáâãä]/g, "a"],
        [/[ÈÉÊË]/g, "E"],
        [/[èéêë]/g, "e"],
        [/[ÌÍÎÏ]/g, "I"],
        [/[ìíîï]/g, "i"],
        [/[ÒÓÔÕÖ]/g, "O"],
        [/[òóôõö]/g, "o"],
        [/[ÙÚÛÜ]/g, "U"],
        [/[ùúûü]/g, "u"],
        [/[ÝŸ]/g, "Y"],
        [/[ýÿ]/g, "y"],
        [/[Ñ]/g, "N"],
        [/[ñ]/g, "n"],
        [/[\[{]/g, "("],
        [/[\]}]/g, ")"],
        [/_/g, "-"],
        [/@/g, "At"],
        [/["`]/g, "'"],
        [/[^a-zA-Z0-9\ <>!\&\*#%,;\.'\(\)\?-]/g, " "]
    ];
    // cSpell:enable

    public generateSafeContactName(contactName: string): string {

        for (let [match, replaceBy] of CardStorage.replaceArray)
            contactName = contactName.replace(match, replaceBy);

        //TODO if tLength not even

        contactName = contactName.substring(0, this.contactNameMaxLength);

        if (contactName.length % 2 === 1)
            contactName += " ";

        return contactName;

    }


    constructor(private readonly atStack: AtStack) {

        this.init(() => this.evtReady.post());

    }

    private p_CPBR_TEST: AtMessage.P_CPBR_TEST;

    private getFreeIndex(): number {

        let [minIndex, maxIndex] = this.p_CPBR_TEST!.range;

        for (let index = minIndex; index <= maxIndex; index++)
            if (!this.contactByIndex[index]) return index;

        return NaN;

    }

    public createContact = execStack("WRITE",
        (number: string, name: string, callback?: (contact: Contact) => void): Promise<[Contact]> => {

            let contact: Contact = {
                "index": this.getFreeIndex(),
                "name": this.generateSafeContactName(name),
                number
            };

            if (isNaN(contact.index)) {
                this.atStack.evtError.post(new Error("Memory full"));
                return null as any;
            }

            //TODO check number valid

            if (contact.number.length > this.numberMaxLength) {
                this.atStack.evtError.post(Error("Number too long"));
                return null as any;
            }

            this.atStack.runCommand(`AT+CPBS="SM"\r`);

            this.atStack.runCommand(`AT+CSCS="IRA"\r`);

            this.atStack.runCommand(`AT+CPBW=${contact.index},"${contact.number}",,"${contact.name}"\r`,
                () => {

                    this.contactByIndex[contact.index] = contact;

                    callback!(this.getContact(contact.index)!);
                }
            );

            return null as any;

        }
    );


    public updateContact = execStack("WRITE",
        (index: number, params: {
            number?: string,
            name?: string
        }, callback?: (contact: Contact) => void): Promise<[Contact]> => {

            if (!this.contactByIndex[index]) {
                this.atStack.evtError.post(new Error("Contact does not exist"));
                return null as any;
            }

            if (typeof params.name === "undefined" && typeof params.number === "undefined") {
                this.atStack.evtError.post(new Error("name and contact can not be both null"));
                return null as any;
            }

            let contact = this.contactByIndex[index];

            let number = "";

            if (params.number !== undefined) {
                number = params.number;
                if (number.length > this.numberMaxLength) {
                    this.atStack.evtError.post(new Error("Number too long"));
                    return null as any;
                }
            } else number = contact.number;

            let contactName = "";
            let enc: Encoding;

            if (params.name !== undefined) {
                enc = "IRA";
                contactName = this.generateSafeContactName(params.name);
            } else {
                if (CardStorage.hasExtendedChar(contact.name)) {
                    enc = "UCS2";
                    contactName = CardStorage.encodeUCS2(contact.name);
                } else {
                    enc = "IRA";
                    contactName = this.generateSafeContactName(contact.name);
                }
            }

            this.atStack.runCommand(`AT+CPBS="SM"\r`);

            this.atStack.runCommand(`AT+CSCS="${enc}"\r`);

            this.atStack.runCommand(`AT+CPBW=${index},"${number}",,"${contactName}"\r`,
                () => {

                    this.contactByIndex[index] = {
                        ...this.contactByIndex[index],
                        number,
                        "name": (enc === "UCS2") ? CardStorage.decodeUCS2(contactName) : contactName
                    };

                    callback!(this.getContact(index)!);
                }
            );

            return null as any;

        }
    );

    public deleteContact = execStack("WRITE",
        (index: number, callback?: () => void): Promise<void> => {

            if (!this.contactByIndex[index]) {
                this.atStack.evtError.post(new Error("Contact does not exists"));
                return null as any;
            }

            this.atStack.runCommand(`AT+CPBS="SM"\r`);

            this.atStack.runCommand(`AT+CPBW=${index}\r`,
                () => {
                    delete this.contactByIndex[index];
                    callback!();
                }
            );

            return null as any;
        }
    );


    public number: string | undefined = undefined;

    public writeNumber = execStack("WRITE",
        (number: string, callback?: () => void): Promise<void> => {

            this.number = number;

            this.atStack.runCommand(`AT+CPBS="ON"\r`);

            this.atStack.runCommand(`AT+CPBW=1,"${number}"\r`);

            this.atStack.runCommand(`AT+CPBS="SM"\r`, () => callback!());

            return null as any;

        }
    );

    private readonly contactByIndex: {
        [index: number]: Contact;
    } = {};


    private init(callback: () => void): void {
        (async () => {

            debug("Init");

            this.atStack.runCommand(`AT+CSCS="UCS2"\r`);

            let [resp] = await this.atStack.runCommand("AT+CNUM\r");

            let atMessageList = resp as AtMessage.LIST;

            if (atMessageList.atMessages.length) {

                let p_CNUM_EXEC = atMessageList.atMessages[0] as AtMessage.P_CNUM_EXEC;

                this.number = p_CNUM_EXEC.number;

            }

            debug(`number: ${this.number}`);

            this.atStack.runCommand(`AT+CPBS="SM"\r`);

            resp = (await this.atStack.runCommand("AT+CPBR=?\r"))[0];

            this.p_CPBR_TEST = resp as AtMessage.P_CPBR_TEST;

            let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

            for (let index = minIndex; index <= maxIndex; index++) {

                this.atStack.runCommand(`AT+CSCS="IRA"\r`);

                let [resp, final] = await this.atStack.runCommand(
                    `AT+CPBR=${index}\r`,
                    { "recoverable": true }
                );

                if (final.isError && (final as AtMessage.P_CME_ERROR).code === 22)
                    continue;

                let name = "\uFFFD";
                let number = "";

                if (resp) {

                    let p_CPBR_EXEC = resp as AtMessage.P_CPBR_EXEC;

                    name = p_CPBR_EXEC.text;
                    number = p_CPBR_EXEC.number;

                }

                if (!resp || CardStorage.countFFFD(name)) {

                    this.atStack.runCommand(`AT+CSCS="UCS2"\r`);

                    let [resp, final] = await this.atStack.runCommand(
                        `AT+CPBR=${index}\r`,
                        { "recoverable": true }
                    );

                    if (!resp && !number) continue;

                    if (resp) {

                        let p_CPBR_EXEC = resp as AtMessage.P_CPBR_EXEC;

                        let nameAsUcs2 = CardStorage.decodeUCS2(p_CPBR_EXEC.text);
                        if (!number) number = p_CPBR_EXEC.number;

                        if (CardStorage.printableLength(nameAsUcs2) > CardStorage.printableLength(name))
                            name = nameAsUcs2;

                    }

                }

                this.contactByIndex[index] = { index, number, name };

            }

            debug("Contacts ready");

            callback();

        })();
    }


    private static encodeUCS2(text: string): string {

        let buffer = encoding.encode(text, "ucs2") as Buffer;

        let hexStr = buffer.toString("hex");

        let length = hexStr.length;

        if (length >= 4)
            hexStr = hexStr.substring(length - 2, length) + hexStr.substring(0, length - 2);

        return hexStr;

    }

    private static decodeUCS2(hexStr: string): string {

        let length = hexStr.length;

        if (length >= 4)
            hexStr = hexStr.substring(2, length) + hexStr.substring(0, 2);

        let buffer = new Buffer(hexStr, "hex");

        return encoding.decode(buffer, "ucs2") || "";

    }

    private static printableLength(text: string): number {

        return text.length - this.countFFFD(text) - this.countUnprintableChar(text);

    }

    private static countFFFD(text: string): number {

        let match = text.match(/\uFFFD/g);

        if (!match) return 0;
        else return match.length;

    }

    private static countUnprintableChar(text: string): number {

        let tmp = JSON.stringify(text);

        tmp = tmp.substring(1, tmp.length - 1);

        tmp = tmp.replace(/\\\\/g, "");

        let match = tmp.match(/\\/g);

        if (!match) return 0;
        else return match.length;

    }

    private static hasExtendedChar(text: string): boolean {

        return text.match(/[^a-zA-Z0-9\ <>!\&\*#"%,;\.'\(\)\?-\uFFFD]/) !== null;

    }


}