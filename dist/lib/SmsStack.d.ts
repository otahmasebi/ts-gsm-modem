import { AtStack } from "./AtStack";
import { Evt } from "ts-evt";
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
    readonly evtMessage: Evt<Message>;
    readonly evtMessageStatusReport: Evt<StatusReport>;
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
    sendMessage: (number: string, text: string) => Promise<Date | undefined>;
    private readonly timers;
    /** To call before stop */
    clearAllTimers(): void;
    private registerListeners;
    private retrievePdu;
}
