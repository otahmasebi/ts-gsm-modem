import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import {
    SmsDeliver, 
    SmsDeliverPart, 
    SmsStatusReport, 
    TP_MTI,
    TP_ST, 
    ST_CLASS, 
    decodePdu, 
    buildSmsSubmitPdus 
} from "node-python-messaging";
import { execStack, ExecStack } from "ts-exec-stack";
import { SyncEvent } from "ts-events-extended";
import { Timer, setTimeout } from "timer-extended";
import { TrackableMap } from "trackable-map"

import * as pr from "ts-promisify";

require("colors");

export interface Message {
    number: string;
    date: Date;
    text: string;
}

export interface StatusReport {
    messageId: number;
    dischargeTime: Date;
    isDelivered: boolean;
    status: string;
}

export class SmsStack {

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

        atStack.runCommand('AT+CPMS="SM","SM","SM"\r');
        atStack.runCommand('AT+CNMI=1,1,0,2,0\r');

        this.registerListeners();
        this.retrieveUnreadSms();

    }

    private retrieveUnreadSms(): void {

        this.atStack.runCommand(`AT+CMGL=${AtMessage.MessageStat.ALL}\r`,
            (atList: AtMessage.LIST | undefined) => {

                if (!atList) return;

                for (let p_CMGL_SET of atList.atMessages as AtMessage.P_CMGL_SET[]) {

                    if (
                        p_CMGL_SET.stat !== AtMessage.MessageStat.REC_READ &&
                        p_CMGL_SET.stat !== AtMessage.MessageStat.REC_UNREAD
                    ) {
                        this.atStack.runCommand(`AT+CMGD=${p_CMGL_SET.index}\r`);
                        return;
                    }

                    decodePdu(p_CMGL_SET.pdu, (error, sms) => {

                        if (error) {
                            console.log("PDU not decrypted: ".red, p_CMGL_SET.pdu, error);
                            this.atStack.runCommand(`AT+CMGD=${p_CMGL_SET.index}\r`);
                            return;
                        }

                        if (sms instanceof SmsStatusReport) {
                            this.atStack.runCommand(`AT+CMGD=${p_CMGL_SET.index}\r`);
                            return;
                        }

                        this.evtSmsDeliver.post([p_CMGL_SET.index, sms as SmsDeliver | SmsDeliverPart]);

                    });

                }

            });


    }

    private generateMessageId: () => number = (() => {
        let id = 1;
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

    private sendPdu(pduLength: number, pdu: string): Promise<{
        error: AtMessage.P_CMS_ERROR | null;
        mr: number;
    }> {

        return new Promise( resolve => {

            this.atStack.runCommand(`AT+CMGS=${pduLength}\r`);

            this.atStack.runCommand(`${pdu}\u001a`, {
                        "recoverable": true,
                        "retryOnErrors": false
            }, (resp: AtMessage.P_CMGS_SET | undefined, final)=> {

                if( !resp ) 
                    resolve({ "error": final, "mr": NaN });
                else 
                    resolve({ "error": null, "mr": resp.mr });

            });


        });

    }

    private readonly maxTrySendPdu = 5;

    //TODO: More test for when message fail

    public sendMessage = execStack(
        (number: string,
            text: string,
            callback?: (messageId: number) => void
        ): void => {
            (async () => {

                let [error, pdus] = await pr.typed(buildSmsSubmitPdus)({
                    "number": number,
                    "text": text,
                    "request_status": true
                });

                if (error) {
                    this.atStack.evtError.post(error);
                    return;
                }

                let messageId = this.generateMessageId();

                this.statusReportMap[messageId] = {
                    "cnt": pdus.length,
                    "completed": 0
                };

                for (let { length, pdu } of pdus) {

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

                        callback!(NaN);

                        return;
                    }

                    this.mrMessageIdMap[mr] = messageId;

                }


                callback!(messageId);

            })();

        }
    );

    private registerListeners(): void {

        this.atStack.evtUnsolicitedMessage.attach(urc => {

            switch (urc.id) {
                case AtMessage.idDict.P_CMTI_URC:
                    this.retrieveSms((urc as AtMessage.P_CMTI_URC).index);
                    break;
                case AtMessage.idDict.P_CDSI_URC:
                    this.retrieveSms((urc as AtMessage.P_CDSI_URC).index);
                    break;
            }

        });

        this.evtSmsStatusReport.attach(smsStatusReport => {

            //console.log(JSON.stringify(smsStatusReport, null,2).blue);

            let messageId = this.mrMessageIdMap[smsStatusReport.ref];

            if (!messageId) return;

            let isDelivered: boolean = true;

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
                "status": TP_ST[smsStatusReport.sr.status]
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

                timer = this.atStack.timers.add(setTimeout((logMessage: string) => {

                    //console.log(logMessage);

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

                }, 60000, "missing parts"));


                this.uncompletedMultipartSms[messageRef] = { timer, parts };

            } else {
                timer = this.uncompletedMultipartSms[messageRef].timer;
                parts = this.uncompletedMultipartSms[messageRef].parts;
            }

            parts[partRef] = { "storageIndex": index, "text": smsDeliver.text };

            if (Object.keys(parts).length === totalPartInMessage)
                timer.runNow("message complete");
            else
                timer.resetDelay();

        });


    }

    private retrieveSms(index: number): void {

        this.atStack.runCommand(`AT+CMGR=${index}\r`,
            (resp: AtMessage.P_CMGR_SET | undefined) => {

                if (!resp) return;

                if (resp.stat !== AtMessage.MessageStat.REC_UNREAD) return;

                decodePdu(resp.pdu, (error, sms) => {

                    if (error) {
                        console.log("PDU not decrypted: ".red, resp.pdu, error);
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

                });

            });

    }

}