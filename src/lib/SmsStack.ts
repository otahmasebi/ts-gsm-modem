
import { ModemInterface, RunAtCommandError } from "./ModemInterface";
import { AtMessageId, AtMessage, AtMessageImplementations, PinState, SimState } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events";

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR PIN MANAGER");
    console.log(error);
    throw error; 
});


export class SmsStack{

    public readonly evtNewSms= new SyncEvent<{pinState: PinState, times: number}>();

    constructor(private readonly modemInterface: ModemInterface) {

        //'AT+CPMS="SM","SM","SM"\r' //Set memory storage, unrecovrable, warning sim busy.
        // 'AT+CNMI=2,1,0,0,0\r' //Indicate new message to TE

        this.registerListeners();
    }


    private registerListeners(): void {

        this.modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

            if (atMessage.id === AtMessageId.CMTI) {

                let atMessageCMTI = <AtMessageImplementations.CMTI>atMessage;

                this.modemInterface.runAtCommand(`AT+CMGR=${atMessageCMTI.index}\r`, output => {

                    let atMessageCMGR = <AtMessageImplementations.CMGR>output.atMessage;

                    console.log("new message received: ", atMessageCMGR);

                });

            }

        });

    }



}