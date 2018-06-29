import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import "colors";
export declare class SystemState {
    private readonly atStack;
    private readonly debug;
    readonly evtReportSimPresence: any;
    isRoaming: boolean | undefined;
    constructor(atStack: AtStack, debug: typeof console.log);
    serviceStatus: AtMessage.ServiceStatus;
    sysMode: AtMessage.SysMode;
    simState: AtMessage.SimState;
    readonly isNetworkReady: boolean;
    readonly evtNetworkReady: any;
    readonly isValidSim: boolean;
    readonly evtValidSim: any;
    private update;
}
