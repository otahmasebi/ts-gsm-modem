import { AtStack } from "./AtStack";
import { ExecQueue } from "ts-exec-queue";
import { SyncEvent } from "ts-events-extended";
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
export declare class SmsStack {
    private readonly atStack;
    readonly evtMessage: SyncEvent<Message>;
    readonly evtMessageStatusReport: SyncEvent<StatusReport>;
    private evtSmsDeliver;
    private evtSmsStatusReport;
    private readonly uncompletedMultipartSms;
    constructor(atStack: AtStack);
    private retrieveUnreadSms(used, capacity);
    private readonly statusReportMap;
    private readonly mrMessageIdMap;
    private sendPdu(pduLength, pdu);
    private readonly maxTrySendPdu;
    sendMessage: ((number: string, text: string, callback?: ((messageId: number) => void) | undefined) => Promise<number>) & ExecQueue;
    private registerListeners();
    private retrieveSms(index);
}
