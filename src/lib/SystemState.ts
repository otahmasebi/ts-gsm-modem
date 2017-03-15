import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";

export class SystemState {

    public readonly evtReportSimPresence = new SyncEvent<boolean>();
    public isRoaming: boolean | undefined = undefined;

    constructor(private readonly atStack: AtStack) {

        this.atStack.evtUnsolicitedMessage.attach(atMessage => this.update(atMessage as any));

        this.atStack.runCommand("AT^SYSINFO\r", 
        (resp: AtMessage.CX_SYSINFO_EXEC) => {

            this.isRoaming = resp.isRoaming;

            this.evtReportSimPresence.post(resp.simState !== AtMessage.SimState.NO_SIM);

            this.update({
                "id": AtMessage.idDict.CX_SIMST_URC,
                "simState": resp.simState
            } as any);

            this.update({
                "id": AtMessage.idDict.CX_SRVST_URC,
                "serviceStatus": resp.serviceStatus
            } as any);

            this.update({
                "id": AtMessage.idDict.CX_MODE_URC,
                "sysMode": resp.sysMode
            } as any);

        });

    }

    public serviceStatus: AtMessage.ServiceStatus;
    public sysMode: AtMessage.SysMode;
    public simState: AtMessage.SimState;

    public get isNetworkReady(): boolean {
        return this.isValidSim && 
        this.serviceStatus === AtMessage.ServiceStatus.VALID_SERVICES &&
        this.sysMode !== AtMessage.SysMode.NO_SERVICES;
    }

    public readonly evtNetworkReady = new VoidSyncEvent();

    public get isValidSim(): boolean { 
        return this.simState === AtMessage.SimState.VALID_SIM; 
    }
    public readonly evtValidSim = new VoidSyncEvent();

    private update(atMessage: AtMessage) {

        switch (atMessage.id) {
            case AtMessage.idDict.CX_SIMST_URC:
                let simState = (atMessage as AtMessage.CX_SIMST_URC).simState
                if (!this.isValidSim) {
                    this.simState = simState;
                    if (this.isValidSim)
                        this.evtValidSim.post();
                } else this.simState = simState;
                break;
            case AtMessage.idDict.CX_SRVST_URC:
                let serviceStatus = (atMessage as AtMessage.CX_SRVST_URC).serviceStatus;
                if (!this.isNetworkReady) {
                    this.serviceStatus = serviceStatus;
                    if (this.isNetworkReady)
                        this.evtNetworkReady.post();
                } else this.serviceStatus = serviceStatus;
                break;
            case AtMessage.idDict.CX_MODE_URC:
                let sysMode = (atMessage as AtMessage.CX_MODE_URC).sysMode;
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