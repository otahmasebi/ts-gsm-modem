import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import {
    SmsDeliver, 
    SmsDeliverPart, 
    SmsStatusReport, 
    Sms,
    Pdu,
    TP_MTI,
    TP_ST, 
    ST_CLASS, 
    decodePdu, 
    buildSmsSubmitPdus 
} from "node-python-messaging";
import * as runExclusive from "run-exclusive";
import { SyncEvent } from "ts-events-extended";
import { Timer } from "timer-extended";
import { TrackableMap } from "trackable-map"


import * as debug from "debug";

import "colors";

export interface Message {
    number: string;
    date: Date;
    text: string;
}

export interface StatusReport {
    messageId: number;
    dischargeTime: Date;
    isDelivered: boolean;
    recipient: string;
    status: string;
}


export class SmsStack {

    private debug: debug.IDebugger= debug("SmsStack");

    public readonly evtMessage = new SyncEvent<Message>();
    public readonly evtMessageStatusReport = new SyncEvent<StatusReport>();

    private evtSmsDeliver = new SyncEvent<[number, SmsDeliver | SmsDeliverPart]>();
    private evtSmsStatusReport = new SyncEvent<SmsStatusReport>();
    private readonly uncompletedMultipartSms: {
        [messageRef: number]: {
            timer: Timer<void>;
            parts: {
                [partRef: number]: {
                    storageIndex: number,
                    text: string
                };
            };
        };
    } = {};

    constructor(private readonly atStack: AtStack) {

        if( atStack.debugPrefix !== undefined ){
            this.debug.namespace= `${atStack.debugPrefix} ${this.debug.namespace}`;
            this.debug.enabled= true;
        }

        this.debug("Initialization");

        atStack.runCommand('AT+CPMS="SM","SM","SM"\r', (resp: AtMessage.P_CPMS_SET) => {

            let { used, capacity } = resp.readingAndDeleting;

            this.retrieveUnreadSms(used, capacity);

        });

        atStack.runCommand('AT+CNMI=1,1,0,2,0\r');

        this.registerListeners();

    }

    private async retrieveUnreadSms(used: number, capacity: number) {

        this.debug(`${used} PDU in sim memory`);

        let messageLeft = used;

        for (let index = 0; index < capacity; index++) {

            if (!messageLeft) break;

            let [resp] = await this.atStack.runCommand(`AT+CMGR=${index}\r`);

            if (!resp) continue;

            messageLeft--;

            let p_CMGR_SET = resp as AtMessage.P_CMGR_SET;

            if (
                p_CMGR_SET.stat !== AtMessage.MessageStat.REC_READ &&
                p_CMGR_SET.stat !== AtMessage.MessageStat.REC_UNREAD
            ) {

                this.debug(`PDU ${AtMessage.MessageStat[p_CMGR_SET.stat]}, deleting...`);

                this.atStack.runCommand(`AT+CMGD=${index}\r`);
                continue;
            }

            let sms: Sms;

            try {

                sms = await decodePdu(p_CMGR_SET.pdu);

            } catch (error) {

                this.debug("PDU not decrypted: ".red, p_CMGR_SET.pdu, error);
                this.atStack.runCommand(`AT+CMGD=${index}\r`);
                continue;

            }

            if (sms instanceof SmsStatusReport) {

                this.atStack.runCommand(`AT+CMGD=${index}\r`);
                continue;

            }

            this.evtSmsDeliver.post([index, sms as SmsDeliver | SmsDeliverPart]);


        }


    }




    private readonly statusReportMap: {
        [messageId: number]: {
            cnt: number;
            completed: number;
        }
    } = {};

    private readonly mrMessageIdMap: {
        [mr: number]: number;
    } = {};

    private sendPdu(pduLength: number, pdu: string): Promise<{
        error: AtMessage.P_CMS_ERROR | null;
        mr: number;
    }> {

        return new Promise(resolve => {

            this.atStack.runCommand(`AT+CMGS=${pduLength}\r`);

            this.atStack.runCommand(`${pdu}\u001a`, {
                "recoverable": true,
                "retryOnErrors": false
            }, (resp: AtMessage.P_CMGS_SET | undefined, final) => {

                if (!resp)
                    resolve({ "error": final as AtMessage.P_CMS_ERROR, "mr": NaN });
                else
                    resolve({ "error": null, "mr": resp.mr });

            });


        });

    }

    private readonly maxTrySendPdu = 5;

    //TODO: More test for when message fail to send
    public sendMessage = runExclusive.buildMethodCb(
        async (number: string,
            text: string,
            callback?: (messageId: number | undefined) => void
        ): Promise<number | undefined> => {

            let pdus: Pdu[];

            try {

                pdus = await buildSmsSubmitPdus({ number, text, "request_status": true });

            } catch (error) {


                this.debug([
                    "Can't build SMS PDU for message: \n".red,
                    `number: ${number}\n`,
                    `text: ${JSON.stringify(text)}`,
                    `error: ${error.message}`
                ].join(""));

                callback!(undefined);

                return null as any;

            }


            let messageId = Date.now();

            this.statusReportMap[messageId] = {
                "cnt": pdus.length,
                "completed": 0
            };

            let i = 1;

            for (let { length, pdu } of pdus) {

                this.debug(`Sending Message part ${i++}/${pdus.length} of message id: ${messageId}`);

                let mr = NaN;
                let error: AtMessage.P_CMS_ERROR | null = null;

                let tryLeft = this.maxTrySendPdu;

                while (tryLeft-- && isNaN(mr)) {

                    if (tryLeft < this.maxTrySendPdu - 1)
                        console.log("Retry sending PDU".red);


                    let result = await this.sendPdu(length, pdu);

                    mr = result.mr;
                    error = result.error;

                }


                if (error) {

                    console.log(`Send Message Error after ${this.maxTrySendPdu}, attempt: ${error.verbose}`.red);

                    for (let mr of Object.keys(this.mrMessageIdMap))
                        if (this.mrMessageIdMap[mr] === messageId)
                            delete this.mrMessageIdMap[mr];

                    callback!(undefined);

                    return null as any;
                }

                this.mrMessageIdMap[mr] = messageId;

            }


            callback!(messageId);

            return null as any;

        }
    );

    private registerListeners(): void {

        this.atStack.evtUnsolicitedMessage.attach(
            (urc: AtMessage): urc is (AtMessage.P_CMTI_URC | AtMessage.P_CDSI_URC) =>
                (urc instanceof AtMessage.P_CMTI_URC) || (urc instanceof AtMessage.P_CDSI_URC),
            ({index}) => this.retrievePdu(index)
        );

        this.evtSmsStatusReport.attach(smsStatusReport => {

            let messageId = this.mrMessageIdMap[smsStatusReport.ref];

            if (!messageId) return;

            //console.log(JSON.stringify(smsStatusReport, null,2).blue);

            let isDelivered: boolean= true;

            switch (smsStatusReport._stClass) {
                case "RESERVED":
                case "STILL TRYING": return;
                case "PERMANENT ERROR":
                case "TEMPORARY ERROR":
                case "SPECIFIC TO SC":
                    isDelivered = false;
                    break;
                case "COMPLETED":
                    let elem = this.statusReportMap[messageId];
                    if (++elem.completed !== elem.cnt) return;
                    isDelivered = true;
                    break;
            }


            for (let mr of Object.keys(this.mrMessageIdMap))
                if (this.mrMessageIdMap[mr] === messageId)
                    delete this.mrMessageIdMap[mr];

            delete this.statusReportMap[messageId];

            this.evtMessageStatusReport.post({
                messageId,
                "dischargeTime": smsStatusReport.sr.dt,
                isDelivered,
                "status": smsStatusReport._status,
                "recipient": smsStatusReport.sr.recipient
            });


        });


        this.evtSmsDeliver.attach(([index, smsDeliver]) => {

            if (!(smsDeliver instanceof SmsDeliverPart)) {

                let { number, date, text } = smsDeliver;

                this.evtMessage.post({ number, date, text });

                this.atStack.runCommand(`AT+CMGD=${index}\r`);

                return;

            }

            let messageRef = smsDeliver.ref;
            let partRef = smsDeliver.seq;
            let totalPartInMessage = smsDeliver.cnt;

            let timer: Timer<void>;
            let parts: typeof SmsStack.prototype.uncompletedMultipartSms[number]['parts'];

            if (!this.uncompletedMultipartSms[messageRef]) {

                parts = {};

                timer = this.atStack.timers.add(
                    (logMessage: string) => {

                        this.debug(logMessage);

                        let partRefs = TrackableMap.intKeyAsSortedArray(parts);
                        let partRefPrev = 0;
                        let concatenatedText = "";
                        let partLeft = totalPartInMessage;

                        for (let partRef of partRefs) {

                            let { storageIndex, text } = parts[partRef];

                            for (let ref = partRefPrev + 1; ref < partRef; ref++) {
                                partLeft--;
                                concatenatedText += " *** Missing part *** ";
                            }

                            partLeft--;
                            concatenatedText += text;

                            this.atStack.runCommand(`AT+CMGD=${storageIndex}\r`);
                            partRefPrev = partRef;

                        }

                        while (partLeft-- > 0)
                            concatenatedText += " *** Missing part *** ";

                        delete this.uncompletedMultipartSms[messageRef];

                        let { number, date } = smsDeliver;

                        this.evtMessage.post({ number, date, "text": concatenatedText });

                    },
                    240000,
                    "missing parts"
                );

                this.uncompletedMultipartSms[messageRef] = { timer, parts };

            } else {
                timer = this.uncompletedMultipartSms[messageRef].timer;
                parts = this.uncompletedMultipartSms[messageRef].parts;
            }

            parts[partRef] = { "storageIndex": index, "text": smsDeliver.text };

            if (Object.keys(parts).length === totalPartInMessage)
                timer.runNow("message complete");
            else {
                this.debug(`Received part n°${partRef} of message ref: ${messageRef}, ${Object.keys(parts).length}/${totalPartInMessage} completed`);
                timer.resetDelay();
            }

        });


    }

    private async retrievePdu(index: number) {

        let [resp] = await this.atStack.runCommand(`AT+CMGR=${index}\r`);

        if (!resp) return;

        let p_CMGR_SET = resp as AtMessage.P_CMGR_SET;

        if (p_CMGR_SET.stat !== AtMessage.MessageStat.REC_UNREAD) return;

        let sms: Sms;

        try {

            sms = await decodePdu(p_CMGR_SET.pdu);

        } catch (error) {

            this.debug("PDU not decrypted: ".red, p_CMGR_SET.pdu, error);
            this.atStack.runCommand(`AT+CMGD=${index}\r`);
            return;

        }

        switch (sms.type) {
            case TP_MTI.SMS_DELIVER:
                this.evtSmsDeliver.post([index, sms as SmsDeliver | SmsDeliverPart]);
                return;
            case TP_MTI.SMS_STATUS_REPORT:
                this.evtSmsStatusReport.post(sms as SmsStatusReport);
                this.atStack.runCommand(`AT+CMGD=${index}\r`);
                return;
        }


    }


}