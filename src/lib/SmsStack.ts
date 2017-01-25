import { ModemInterface, RunCommandOutput } from "./ModemInterface";
import { 
    AtMessageId, 
    AtMessage, 
    AtMessageList,
    AtMessageImplementations,
    MessageStat
} from "at-messages-parser";
import { SyncEvent } from "ts-events";
import { 
    decodePdu , 
    buildSmsSubmitPdus, 
    Sms, 
    TP_ST, 
    TP_MTI,
    ST_CLASS,
    stClassOf
} from "node-python-messaging";

import * as promisify from "ts-promisify";

require("colors");

export interface Message{
    number: string;
    date: Date;
    text: string;
}

export class SmsStack{

    public evtMessage= new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<{ 
        messageId: number, 
        dischargeTime: Date, 
        isDelivered: boolean,
        status: string
    }>();

    private evtSmsDeliver= new SyncEvent<Sms>();
    private evtSmsStatusReport= new SyncEvent<Sms>();
    private readonly concatenatedSmsMap: { 
        [ref: number]: { 
            [seq: number]: Sms 
        } 
    } = {};

    constructor(private readonly modemInterface: ModemInterface) {

        modemInterface.runCommand('AT+CPMS="SM","SM","SM"\r');
        modemInterface.runCommand('AT+CNMI=1,1,0,2,0\r');


        this.registerListeners();
        this.retrieveUnreadSms();

    }

    private retrieveUnreadSms(): void{

        this.modemInterface.runCommand(`AT+CMGL=${MessageStat.RECEIVED_UNREAD}\r`, output => {

            let atMessageList = <AtMessageList>output.atMessage;

            if (!atMessageList) return;

            for (let atMessage of atMessageList.atMessages) {

                let atMessageCMGL = <AtMessageImplementations.CMGL>atMessage;

                decodePdu(atMessageCMGL.pdu, (error, sms) => {

                    if (sms.type === TP_MTI.SMS_DELIVER) this.evtSmsDeliver.post(sms);

                });
                this.modemInterface.runCommand(`AT+CMGD=${atMessageCMGL.index}\r`);

            }

        });
    }


    private generateMessageId: () => number = (() => {
        let id = 0;
        return () => { return id++; }
    })();

    private readonly statusReportMap: {
        [messageId: number]: {
            cnt: number,
            completed: number
        }
    } = {};

    private readonly mrMessageIdMap: {
        [mr: number]: number;
    } = {};

    public sendMessage(
        number: string,
        text: string,
        callback?: (messageId: number) => void
    ): void {
        (async () => {

                callback = callback || function () { };

                let [error, pdus] = await promisify.typed(buildSmsSubmitPdus)({
                    "number": number,
                    "text": text,
                    "request_status": true
                });

                if (error) throw error;

                let messageId = this.generateMessageId();

                this.statusReportMap[messageId] = {
                    "cnt": pdus.length,
                    "completed": 0
                };

                for (let pduWrap of pdus) {

                    this.modemInterface.runCommand(`AT+CMGS=${pduWrap.length}\r`);

                    let [output] = <[RunCommandOutput]>await promisify.generic(
                        this.modemInterface,
                        this.modemInterface.runCommand
                    )(`${pduWrap.pdu}\u001a`);

                    let atMessageCMGS = <AtMessageImplementations.CMGS>output.atMessage;

                    this.mrMessageIdMap[atMessageCMGS.mr] = messageId;

                }

                callback(messageId);

        })();
    }


    private registerListeners(): void {

        this.evtSmsStatusReport.attach(sms => {

            let messageId = this.mrMessageIdMap[sms.ref];


            switch (stClassOf(sms.sr.status)) {
                case ST_CLASS.RESERVED:
                case ST_CLASS.STILL_TRYING: return;
                case ST_CLASS.PERMANENT_ERROR:
                case ST_CLASS.TEMPORARY_ERROR:
                case ST_CLASS.SPECIFIC_TO_SC:
                    this.evtMessageStatusReport.post({
                        "messageId": messageId,
                        "dischargeTime": sms.sr.dt,
                        "isDelivered": false,
                        "status": TP_ST[sms.sr.status]
                    });
                    delete this.statusReportMap[messageId];
                    return;
                case ST_CLASS.COMPLETED:
                    if (++this.statusReportMap[messageId].completed !== this.statusReportMap[messageId].cnt) return;
                    this.evtMessageStatusReport.post({
                        "messageId": messageId,
                        "dischargeTime": sms.sr.dt,
                        "isDelivered": true,
                        "status": TP_ST[sms.sr.status]
                    });
                    delete this.statusReportMap[messageId];
            }

        });

        this.evtSmsDeliver.attach(sms => {

            let message: Message = {
                "number": sms.number,
                "date": sms.date,
                "text": ""
            };

            if (typeof (sms.ref) !== "number") {

                message.text = sms.text;
                this.evtMessage.post(message);
                return;

            }

            if (!this.concatenatedSmsMap[sms.ref]) this.concatenatedSmsMap[sms.ref] = {};

            this.concatenatedSmsMap[sms.ref][sms.seq] = sms;

            if (Object.keys(this.concatenatedSmsMap[sms.ref]).length !== sms.cnt) return;

            for (let seq = 1; seq <= sms.cnt; seq++) message.text += this.concatenatedSmsMap[sms.ref][seq].text;

            this.evtMessage.post(message);

            delete this.concatenatedSmsMap[sms.ref];

        });

        this.modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

            switch (atMessage.id) {
                case AtMessageId.CMTI:
                    let atMessageCMTI = <AtMessageImplementations.CMTI>atMessage;
                    this.retrieveSms(atMessageCMTI.index);
                    break;
                case AtMessageId.CDSI:
                    let atMessageCDSI = <AtMessageImplementations.CDSI>atMessage;
                    this.retrieveSms(atMessageCDSI.index);
                    break;
            }

        });

    }

    private retrieveSms(index: number): void {

        this.modemInterface.runCommand(`AT+CMGR=${index}\r`, output => {

            let atMessageCMGR = <AtMessageImplementations.CMGR>output.atMessage;

            if (atMessageCMGR.stat !== MessageStat.RECEIVED_UNREAD) return;

            decodePdu(atMessageCMGR.pdu, (error, sms) => {

                switch (sms.type) {
                    case TP_MTI.SMS_DELIVER: return this.evtSmsDeliver.post(sms);
                    case TP_MTI.SMS_STATUS_REPORT: return this.evtSmsStatusReport.post(sms);
                }

            });

        });
        this.modemInterface.runCommand(`AT+CMGD=${index}\r`, { "unrecoverable": false });

    }

}
