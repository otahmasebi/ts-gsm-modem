
import { AtStack } from "./AtStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";

export interface Contact {
    number: string;
    name?: string,
}

export class CardStorage {

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