import { AtStack } from "./AtStack";
import {
    atIdDict,
    AtMessage,
    AtImps,
    ServiceStatus,
    SysMode,
    SimState
} from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events-extended";

export class SystemState {

    public readonly evtReportSimPresence= new SyncEvent<boolean>();
    public readonly evtNetworkReady= new VoidSyncEvent();

    public isNetworkReady: boolean= false;
    public isRoaming: boolean= undefined;

    public serviceStatus: ServiceStatus;
    public sysMode: SysMode;
    public simState: SimState;

    constructor( private readonly atStack: AtStack ){

        this.retrieveHuaweiSYSINFO();

        this.registerListeners();

    }


    private retrieveHuaweiSYSINFO(): void {

        this.atStack.runCommand("AT^SYSINFO\r", output => {

            let cx_SYSINFO_EXEC = output.atMessage as AtImps.CX_SYSINFO_EXEC;

            this.serviceStatus= cx_SYSINFO_EXEC.serviceStatus;
            this.sysMode= cx_SYSINFO_EXEC.sysMode;
            this.simState= cx_SYSINFO_EXEC.simState;
            this.isRoaming= cx_SYSINFO_EXEC.isRoaming;

            this.evtReportSimPresence.post(this.simState !== SimState.NO_SIM );

            this.checkIfReady();

        });

    }



    private registerListeners(): void {

        this.atStack.evtUnsolicitedMessage.attach(atMessage => {

            switch (atMessage.id) {
                case atIdDict.CX_SIMST_URC:
                    this.simState = (atMessage as AtImps.CX_SIMST_URC).simState
                    break;
                case atIdDict.CX_SRVST_URC:
                    this.serviceStatus = (atMessage as AtImps.CX_SRVST_URC).serviceStatus;
                    break;
                case atIdDict.CX_MODE_URC:
                    this.sysMode = (atMessage as AtImps.CX_MODE_URC).sysMode;
                    break;
                default: return;
            }

            console.log({
                "simState": SimState[this.simState],
                "serviceStatus": ServiceStatus[this.serviceStatus],
                "sysMode": SysMode[this.sysMode]
            });

            this.checkIfReady();

        });

    }

    private checkIfReady(): void {

        if (this.simState !== SimState.VALID_SIM) {
            this.isNetworkReady = false;
            return;
        }

        if (this.serviceStatus !== ServiceStatus.VALID_SERVICES) {
            this.isNetworkReady = false;
            return;
        }


        if (this.sysMode === SysMode.NO_SERVICES) {
            this.isNetworkReady = false;
            return;
        }


        if (!this.isNetworkReady) {

            this.isNetworkReady = true;
            this.evtNetworkReady.post();


        }

    }

}