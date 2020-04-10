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
    readonly evtMessage: import("evt/dist/lib/types").Evt<Message>;
    readonly evtMessageStatusReport: import("evt/dist/lib/types").Evt<StatusReport>;
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
