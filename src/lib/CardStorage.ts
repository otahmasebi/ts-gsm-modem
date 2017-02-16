
import { AtStack, CommandResp } from "./AtStack";
import { 
    AtImps, 
    NumberingPlanIdentification, 
    TypeOfNumber
} from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import { execStack } from "ts-exec-stack";
import * as pr from "ts-promisify";

import * as encoding from "legacy-encoding";


export type Encoding = "IRA" | "GSM" | "UCS2";


export type Action = "UPDATE" | "CREATE";

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

        let out: Contact[]= [];

        for( let indexStr of Object.keys(this.contactMap) ){

            let index= parseInt(indexStr);

            let contact= Object.assign({}, this.contactMap[index])

            delete contact.encoding;
            
            out.push(contact);
        }

        return out;

    }

    public getContact(index: number): Contact {

        let out= Object.assign({}, this.contactMap[index]);

        delete out.encoding;

        return out;
    }

    public get contactNameMaxLength(): number {
        return this.p_CPBR_TEST.tLength;
    }


    public get numberMaxLength(): number {
        return this.p_CPBR_TEST.nLength;
    }

    private p_CPBR_TEST: AtImps.P_CPBR_TEST;

    constructor(private readonly atStack: AtStack) {

        this.init(()=>{
            this.isReady= true;
            this.evtReady.post()
        });

    }

    public get storageLeft(): number {

        let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

        let total= maxIndex - minIndex;

        return total - Object.keys(this.contactMap).length;

    }

    private getFreeIndex(): number {

        let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

        for (let index = minIndex; index <= maxIndex; index++)
            if (!this.contactMap[index]) return index;

        return NaN;

    }

    public createContact= execStack("WRITE", ( params: { 
        number: string, 
        name?: string 
    }, callback?: (contact: Contact)=> void): void =>{
        
        let index= this.getFreeIndex();

        if( isNaN(index) )
            throw new Error("Memory full");

        let contactName= "";

        if( params.name && typeof(params.name) === "string" )
            contactName= this.generateSafeContactName(params.name);

        let number= params.number;

        if( number.length > this.numberMaxLength )
            throw new Error("Number too long");

        this.atStack.runCommand(`AT+CSCS="GSM"\r`);

        this.atStack.runCommand(`AT+CPBW=${index},"${number}",,"${contactName}"\r`, output => {

            this.atStack.runCommand(`AT+CSCS="GSM"\r`);

            this.atStack.runCommand(`AT+CPBR=${index}\r`, output => {

                let p_CPBR_EXEC = output.atMessage as AtImps.P_CPBR_EXEC;

                let contact = {
                    "index": index,
                    "number": p_CPBR_EXEC.number,
                    "name": p_CPBR_EXEC.text,
                    "numberingPlanId": p_CPBR_EXEC.numberingPlanId,
                    "typeOfNumber": p_CPBR_EXEC.typeOfNumber
                };

                if( !contact.name )
                    delete contact.name;

                this.contactMap[contact.index] = Object.assign({"encoding": "GSM" as Encoding}, contact);

                callback(contact);

            });

        });

    });


    public updateContact= execStack("WRITE", (index: number, params: { 
        number?: string, 
        name?: string 
    }, callback?: (contact: Contact)=>void):void =>{

        if( !this.contactMap[index] )
            throw new Error("Contact does not eexist");
        
        if( !params.name && !params.number )
            throw new Error("name and contact can not be both null");
        
        let contact= this.contactMap[index];

        let number= "";

        if( typeof(params.number) === "string" ){
            number= params.number;
            if( number.length > this.numberMaxLength )
                throw new Error("Number too long");
        }else number= contact.number;

        let contactName= "";
        let enc: Encoding;

        if( typeof(params.name) === "string" ){
            enc= "GSM";
            contactName= this.generateSafeContactName(params.name);
        }else{
            enc= contact.encoding;
            contactName= contact.name || "";
            if( enc === "UCS2" )
                contactName= CardStorage.encodeUCS2(contactName);
        }

        this.atStack.runCommand(`AT+CSCS="${enc}"\r`);

        this.atStack.runCommand(`AT+CPBW=${index},"${number}",,"${contactName}"\r`, output => {

            this.atStack.runCommand(`AT+CSCS="${enc}"\r`);

            this.atStack.runCommand(`AT+CPBR=${index}\r`,  output  => {

                let p_CPBR_EXEC = output.atMessage as AtImps.P_CPBR_EXEC;

                let contactName= p_CPBR_EXEC.text || "";

                if( !contactName )
                    enc= "GSM";
                else if( enc === "UCS2" )
                    contactName= CardStorage.decodeUCS2(contactName);

                let contact = {
                    "index": index,
                    "number": number,
                    "name": contactName,
                    "numberingPlanId": p_CPBR_EXEC.numberingPlanId,
                    "typeOfNumber": p_CPBR_EXEC.typeOfNumber
                };

                if( !contactName )
                    delete contact.name;

                this.contactMap[contact.index] = Object.assign({"encoding": enc }, contact);

                callback(contact);

            });
        });

    });

    public deleteContact= execStack("WRITE", (index: number, callback?: ()=> void): void =>{

        if( !this.contactMap[index] )
            throw new Error("Contact does not exists");

        this.atStack.runCommand(`AT+CPBW=${index}\r`, () => {
            delete this.contactMap[index];
            callback();
        });
        
    });



    public generateSafeContactName(contactName: string): string {

        // cSpell:disable
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
        // cSpell:enable

        contactName = contactName.replace(/[\[{]/g, "(");
        contactName = contactName.replace(/[\]}]/g, ")");
        contactName = contactName.replace(/_/g, "-");
        contactName = contactName.replace(/@/g, "At");
        contactName = contactName.replace(/["`]/g, "'");

        contactName = contactName.replace(/[^a-zA-Z0-9\ <>!\&\*#%,;\.'\(\)\?-]/g, " ");

        //TODO if tLength not even

        contactName = contactName.substring(0, this.contactNameMaxLength);

        if (contactName.length % 2 === 1)
            contactName += " ";

        return contactName;

    }


    private readonly contactMap: {
        [index: number]: { encoding: Encoding } & Contact;
    } = {};

    private init(callback: () => void): void {

        let encodings: Encoding[] = ["IRA", "GSM", "UCS2"];

        let encErrorMap: {
            [index: number]: {
                contact: Contact;
                scores: { [enc: string]: [string, number] };
            };
        } = {};

        (async () => {

            let [output] = await pr.generic(
                this.atStack,
                this.atStack.runCommand
            )("AT+CPBR=?\r") as [CommandResp];

            this.p_CPBR_TEST = output.atMessage as AtImps.P_CPBR_TEST;

            let [minIndex, maxIndex] = this.p_CPBR_TEST.range;

            for (let enc of encodings) {

                for (let index = minIndex; index <= maxIndex; index++) {

                    if (this.contactMap[index]) continue;

                    //TODO retry if specific error code
                    //TODO sore debug mode on the go
                    //TODO run this command with debug enable

                    this.atStack.runCommand(`AT+CSCS="${enc}"\r`);

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
                            "encoding": enc,
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


            for (let indexStr of Object.keys(encErrorMap)) {

                let index = parseInt(indexStr);

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

                this.contactMap[index] = Object.assign({
                    "encoding": minEnc || "GSM" as Encoding
                }, encErrorMap[index].contact);

                if (minEnc)
                    this.contactMap[index].name = scores[minEnc][0];

            }

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