import { AtStack } from "./AtStack";
import "colors";
export interface Message {
    number: string;
    date: Date;
    text: string;
}
export interface StatusReport {
    sendDate: Date;
    dischargeDate: Date;
    isDelivered: boolean;
    recipient: string;
    status: string;
}
export declare class SmsStack {
    private readonly atStack;
    private readonly debug;
    readonly evtMessage: any;
    readonly evtMessageStatusReport: any;
    private evtSmsDeliver;
    private evtSmsStatusReport;
    private readonly uncompletedMultipartSms;
    constructor(atStack: AtStack, debug: typeof console.log);
    private retrieveUnreadSms;
    private readonly statusReportMap;
    private readonly mrMessageIdMap;
    private sendPdu;
    private readonly maxTrySendPdu;
    /** Return sendDate or undefined if send fail */
    sendMessage: any;
    private registerListeners;
    private retrievePdu;
}
