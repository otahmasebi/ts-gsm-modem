
import { AtStack } from "./AtStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";

import * as encoding from "legacy-encoding";

export interface Contact {
    number: string;
    name?: string,
}

export class CardStorage {

    public static encodeUCS2(text: string): string{

        let buffer= encoding.encode(text, "ucs2") as Buffer;

        let hexStr= buffer.toString("hex");

        let length = hexStr.length;

        if( length >= 4 )
            hexStr= hexStr.substring(length-2, length) + hexStr.substring(0, length-2);

        return hexStr;

    }

    public static decodeUCS2(hexStr: string): string{


        let length = hexStr.length;

        if( length >= 4 )
            hexStr= hexStr.substring(0, length-2) + hexStr.substring(length-2, length);


        let buffer= new Buffer(hexStr, "hex");

        return encoding.decode(buffer, "ucs2");


    }


    public readonly evtReady= new VoidSyncEvent();


    constructor(private readonly atStack: AtStack){

        this.retrieve();
    }

    public contacts: Contact[];
    public storageLeft: number;

    private retrieve(): void{

        this.storageLeft= 40;
        this.contacts= [];

    }

    public storeContact(contact){
        if( !this.storageLeft ) throw Error("memory full");

        this.atStack.runCommand("", output => {

            this.storageLeft--;

            this.contacts.push(contact);

        });


    }


    

}