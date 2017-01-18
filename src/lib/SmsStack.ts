import { ModemInterface } from "./ModemInterface";
import { 
    AtMessageId, 
    AtMessage, 
    AtMessageImplementations 
} from "at-messages-parser";
import { SyncEvent } from "ts-events";
import { smsDeliver, smsSubmit, Sms } from "node-python-messaging";

export interface Message{
    number: string;
    date: Date;
    text: string;
}

export class SmsStack{

    private evtSms= new SyncEvent<Sms>();
    public evtMessage= new SyncEvent<Message>();
    private readonly setSms: { [ref: number]: { [seq: number]: Sms } } = {};

    constructor(private readonly modemInterface: ModemInterface) {
        //Assert sim ready

        modemInterface.runAtCommandExt('AT+CPMS="SM","SM","SM"\r');
        modemInterface.runAtCommandExt('AT+CNMI=2,1,0,0,0\r');

        this.registerListeners();

    }

    private registerListeners(): void {

        this.evtSms.attach(sms => {

            if (typeof (sms.ref) !== "number") return this.evtMessage.post({
                "number": sms.number,
                "date": sms.date,
                "text": sms.text
            });

            if (!this.setSms[sms.ref]) this.setSms[sms.ref] = {};

            this.setSms[sms.ref][sms.seq] = sms;

            if (Object.keys(this.setSms[sms.ref]).length !== sms.cnt) return;

            let message: Message = {
                "number": sms.number,
                "date": sms.date,
                "text": ""
            };

            for (let seq = 1; seq <= sms.cnt; seq++) message.text += this.setSms[sms.ref][seq].text;

            this.evtMessage.post(message);

        });

        this.modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

            if (atMessage.id === AtMessageId.CMTI) {

                let atMessageCMTI = <AtMessageImplementations.CMTI>atMessage;

                this.retrieveSms(atMessageCMTI.index);

            }

        });

    }

    private retrieveSms(index: number): void {

        this.modemInterface.runAtCommandExt(`AT+CMGR=${index}\r`, output => {

            let atMessageCMGR = <AtMessageImplementations.CMGR>output.atMessage;

            smsDeliver(atMessageCMGR.pdu, (error, sms) => this.evtSms.post(sms));

            this.modemInterface.runAtCommandExt(`AT+CMGD=${index}\r`);

        });

    }

}