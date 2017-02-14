
import { AtStack, CommandResp } from "./AtStack";
import { 
    AtImps, 
    NumberingPlanIdentification, 
    TypeOfNumber
} from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import * as pr from "ts-promisify";

import * as encoding from "legacy-encoding";


export type Encoding = "IRA" | "GSM" | "UCS2";



export interface Contact {
    index: number;
    number: string;
    name?: string;
    numberingPlanId?: NumberingPlanIdentification;
    typeOfNumber?: TypeOfNumber;
}

export class CardStorage {


    public isReady= false;
    public readonly evtReady = new VoidSyncEvent();

    public get contacts(): Contact[] {

        let out= [] as Contact[];

        for( let index of Object.keys(this.contactMap) )
            out.push(this.contactMap[index]);

        return out;

    }

    public getContact(index: number): Contact {
        return this.contactMap[index];
    }

    public get tLength(): number {
        return this.p_CPBR_TEST.tLength;
    }

    private p_CPBR_TEST: AtImps.P_CPBR_TEST;

    constructor(private readonly atStack: AtStack) {

        this.init(()=>{
            this.isReady= true;
            this.evtReady.post()
        });

    }

    public storeContact(param: {
        index?: number;
        name?: string
        number?: string,
    }, callback: (error: Error, contact: Contact) => void): void{

        let indexStr= "";

        if( typeof(param.index) === "number" )
            indexStr= param.index.toString();

        let contactName= "";

        if( typeof(param.name) === "string" )
            contactName= this.generateSafeContactName(param.name);

        let number= "";

        //TODO what if index and only name?

        if( !indexStr && !number ) throw new Error();

        if( typeof(param.number) === "string" )
            number= param.number;

        //TODO

        this.atStack.runCommand(`AT+CSCS="GSM"\r`);

        this.atStack.runCommand(`AT+CPBW=${indexStr},"${number}",,"${contactName}"\r`, {
            "retryCount": 0
        }, output => {

            if (!output.isSuccess) {

                callback(new Error((output.finalAtMessage as AtImps.P_CME_ERROR).verbose), null);
                return;

            }

            let p_CPBR_EXEC= output.atMessage as AtImps.P_CPBR_EXEC;

            let contact= {
                "index": p_CPBR_EXEC.index,
                "number": p_CPBR_EXEC.number,
                "name": p_CPBR_EXEC.text,
                "numberingPlanId": p_CPBR_EXEC.numberingPlanId,
                "typeOfNumber": p_CPBR_EXEC.typeOfNumber
            } as Contact;

            this.contactMap[contact.index]= contact;

            callback(null, contact);

        });

    }

    public generateSafeContactName(contactName: string): string {

        contactName = contactName.replace(/[ÀÁÂÃÄ]/g, "A");
        contactName = contactName.replace(/[àáâãä]/g, "a");
        contactName = contactName.replace(/[ÈÉÊË]/g, "E");
        contactName = contactName.replace(/[èéêë]/g, "e");
        contactName = contactName.replace(/[ÌÍÎÏ]/g, "I");
        contactName = contactName.replace(/[ìíîï]/g, "i");
        contactName = contactName.replace(/[ÒÓÔÕÖ]/g, "O");
        contactName = contactName.replace(/[òóôõö]/g, "o");
        contactName = contactName.replace(/[ÙÚÛÜ]/g, "U");
        contactName = contactName.replace(/[ùúûü]/g, "u");
        contactName = contactName.replace(/[ÝŸ]/g, "Y");
        contactName = contactName.replace(/[ýÿ]/g, "y");
        contactName = contactName.replace(/[Ñ]/g, "N");
        contactName = contactName.replace(/[ñ]/g, "n");

        contactName = contactName.replace(/[\[{]/g, "(");
        contactName = contactName.replace(/[\]}]/g, ")");
        contactName = contactName.replace(/_/g, "-");
        contactName = contactName.replace(/@/g, "At");
        contactName = contactName.replace(/["`]/g, "'");

        contactName = contactName.replace(/[^a-zA-Z0-9\ <>!\&\*#%,;\.'\(\)\?-]/g, " ");

        //TODO if tLength not even

        contactName = contactName.substring(0, this.tLength);

        if( contactName.length %2 === 1 )
            contactName+= " ";

        return contactName;

    }


    private contactMap: {
        [index: number]: Contact;
    };

    private init(callback: () => void): void {

        console.log("on est dans init");

        let encodings: Encoding[] = ["IRA", "GSM", "UCS2"];

        let encErrorMap: {
            [index: number]: {
                contact: Contact;
                scores: { [enc: string]: [string, number] };
            };
        } = {};

        this.contactMap = {};

        (async () => {

            let [output] = await pr.generic(
                this.atStack,
                this.atStack.runCommand
            )("AT+CPBR=?\r") as [CommandResp];

            this.p_CPBR_TEST = output.atMessage as AtImps.P_CPBR_TEST;

            let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

            for (let enc of encodings) {

                this.atStack.runCommand(`AT+CSCS="${enc}"\r`);

                for (let index = minIndex; index <= maxIndex; index++) {

                    if (this.contactMap[index]) continue;

                    //TODO retry if specific error code
                    //TODO sore debug mode on the go
                    //TODO run this command with debug enable

                    let [output] = await pr.generic(
                        this.atStack,
                        this.atStack.runCommand
                    )(`AT+CPBR=${index}\r`, {
                        "unrecoverable": false,
                        "retryCount": 0
                    }) as [CommandResp];

                    if (!output.isSuccess) continue;

                    let p_CPBR_EXEC = output.atMessage as AtImps.P_CPBR_EXEC;

                    let text = p_CPBR_EXEC.text;

                    if (enc === "UCS2")
                        text = CardStorage.decodeUCS2(text);

                    let score = CardStorage.computeScore(text);

                    if (score < 0) {

                        if (encErrorMap[index])
                            delete encErrorMap[index];

                        this.contactMap[index] = {
                            "index": index,
                            "number": p_CPBR_EXEC.number,
                            "name": text,
                            "numberingPlanId": p_CPBR_EXEC.numberingPlanId,
                            "typeOfNumber": p_CPBR_EXEC.typeOfNumber
                        };

                        continue;

                    }

                    if (!encErrorMap[index])
                        encErrorMap[index] = {
                            "contact": {
                                "index": index,
                                "number": p_CPBR_EXEC.number,
                                "numberingPlanId": p_CPBR_EXEC.numberingPlanId,
                                "typeOfNumber": p_CPBR_EXEC.typeOfNumber
                            },
                            "scores": {}
                        };

                    if (text)
                        encErrorMap[index].scores[enc] = [text, score];

                }
            }


            for (let index of Object.keys(encErrorMap)) {

                let contact = encErrorMap[index].contact;

                let scores = encErrorMap[index].scores;

                let minScore = Number.MAX_SAFE_INTEGER;
                let minEnc: Encoding = undefined;

                for (let enc of encodings) {

                    if (typeof (scores[enc]) !== "object")
                        continue;

                    if (scores[enc][1] < minScore) {
                        minEnc = enc;
                        minScore = scores[enc][1];
                    }

                }

                this.contactMap[index] = encErrorMap[index].contact;

                if (minEnc)
                    this.contactMap[index].name = scores[minEnc][0];

            }

            console.log("ici contactMap", this.contactMap);

            callback();

        })();
    }

    public static encodeUCS2(text: string): string {

        if (typeof (text) !== "string")
            return null;


        let buffer = encoding.encode(text, "ucs2") as Buffer;

        let hexStr = buffer.toString("hex");

        let length = hexStr.length;

        if (length >= 4)
            hexStr = hexStr.substring(length - 2, length) + hexStr.substring(0, length - 2);

        return hexStr;

    }

    public static decodeUCS2(hexStr: string): string {


        if (typeof (hexStr) !== "string")
            return null;

        let length = hexStr.length;

        if (length >= 4)
            hexStr = hexStr.substring(2, length) + hexStr.substring(0, 2);

        let buffer = new Buffer(hexStr, "hex");

        return encoding.decode(buffer, "ucs2");

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

    private static computeScore(text: string): number {

        if (!text) return Number.MAX_SAFE_INTEGER;

        return 100 * (this.countFFFD(text) + this.countUnprintableChar(text)) - text.length;

    }




}