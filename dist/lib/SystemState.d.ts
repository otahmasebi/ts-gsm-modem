import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";
import "colors";
export declare class SystemState {
    private readonly atStack;
    private readonly debug;
    readonly evtReportSimPresence: SyncEvent<boolean>;
    isRoaming: boolean | undefined;
    constructor(atStack: AtStack, debug: typeof console.log);
    serviceStatus: AtMessage.ServiceStatus;
    sysMode: AtMessage.SysMode;
    simState: AtMessage.SimState;
    readonly isNetworkReady: boolean;
    readonly evtNetworkReady: VoidSyncEvent;
    readonly isValidSim: boolean;
    readonly evtValidSim: VoidSyncEvent;
    private update;
}
