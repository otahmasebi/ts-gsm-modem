import { AtStack } from "./AtStack";
import {
    AtId,
    atIdDict,
    AtMessage,
    AtImps,
    ServiceStatus,
    SysMode,
    SimState
} from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";

export class SystemState {

    public readonly evtReportSimPresence = new SyncEvent<boolean>();
    public isRoaming: boolean = undefined;

    constructor(private readonly atStack: AtStack) {

        this.atStack.evtUnsolicitedMessage.attach(atMessage => this.update(atMessage as any));

        this.atStack.runCommand("AT^SYSINFO\r", output => {

            let cx_SYSINFO_EXEC = output.atMessage as AtImps.CX_SYSINFO_EXEC;

            this.isRoaming = cx_SYSINFO_EXEC.isRoaming;

            this.evtReportSimPresence.post(cx_SYSINFO_EXEC.simState !== SimState.NO_SIM);

            this.update({
                "id": atIdDict.CX_SIMST_URC,
                "simState": cx_SYSINFO_EXEC.simState
            } as any);

            this.update({
                "id": atIdDict.CX_SRVST_URC,
                "serviceStatus": cx_SYSINFO_EXEC.serviceStatus
            } as any);

            this.update({
                "id": atIdDict.CX_MODE_URC,
                "sysMode": cx_SYSINFO_EXEC.sysMode
            } as any);

        });

    }

    public serviceStatus: ServiceStatus;
    public sysMode: SysMode;
    public simState: SimState;

    public get isNetworkReady(): boolean {
        return this.isValidSim && 
        this.serviceStatus === ServiceStatus.VALID_SERVICES &&
        this.sysMode !== SysMode.NO_SERVICES;
    }

    public readonly evtNetworkReady = new VoidSyncEvent();

    public get isValidSim(): boolean { 
        return this.simState === SimState.VALID_SIM; 
    }
    public readonly evtValidSim = new VoidSyncEvent();

    private update(atMessage: AtMessage) {

        switch (atMessage.id) {
            case atIdDict.CX_SIMST_URC:
                let simState = (atMessage as AtImps.CX_SIMST_URC).simState
                if (!this.isValidSim) {
                    this.simState = simState;
                    if (this.isValidSim)
                        this.evtValidSim.post();
                } else this.simState = simState;
                break;
            case atIdDict.CX_SRVST_URC:
                let serviceStatus = (atMessage as AtImps.CX_SRVST_URC).serviceStatus;
                if (!this.isNetworkReady) {
                    this.serviceStatus = serviceStatus;
                    if (this.isNetworkReady)
                        this.evtNetworkReady.post();
                } else this.serviceStatus = serviceStatus;
                break;
            case atIdDict.CX_MODE_URC:
                let sysMode = (atMessage as AtImps.CX_MODE_URC).sysMode;
                if (!this.isNetworkReady) {
                    this.sysMode = sysMode;
                    if (this.isNetworkReady)
                        this.evtNetworkReady.post();
                } else this.sysMode = sysMode;
                break;
            default: return;
        }

        /*
        console.log(JSON.stringify({
            "atMessage": atMessage,
            "isValidSim": this.isValidSim,
            "isNetworkReady": this.isNetworkReady,
            "simState": SimState[this.simState],
            "serviceStatus": ServiceStatus[this.serviceStatus],
            "sysMode": SysMode[this.sysMode]
        }, null, 2));
        */

    }

}