import { AtStack } from "./AtStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";
import {
    atIdDict,
    AtMessage,
    AtImps,
    ServiceStatus,
    SysMode,
    SimState
} from "at-messages-parser";

export class SystemState {

    public readonly evtHasSim= new SyncEvent<boolean>();
    public readonly evtReady= new VoidSyncEvent();

    public isReady: boolean= false;
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

            let atMessageHuaweiSYSINFO = output.atMessage as AtImps.CX_SYSINFO_EXEC;

            this.serviceStatus= atMessageHuaweiSYSINFO.serviceStatus;
            this.sysMode= atMessageHuaweiSYSINFO.sysMode;
            this.simState= atMessageHuaweiSYSINFO.simState;
            this.isRoaming= atMessageHuaweiSYSINFO.isRoaming;

            this.evtHasSim.post(this.simState !== SimState.NO_SIM );

            this.checks();

        });

    }

    private registerListeners(): void{

        this.atStack.evtUnsolicitedMessage.attach( atMessage => {

            switch( atMessage.id ){
                case atIdDict.CX_SRVST_URC:
                    this.serviceStatus = (atMessage as AtImps.CX_SRVST_URC).serviceStatus;
                    break;
                case atIdDict.CX_SIMST_URC:
                    this.simState = (atMessage as AtImps.CX_SIMST_URC).simState
                    break;
                case atIdDict.CX_MODE_URC:
                    this.sysMode = (atMessage as AtImps.CX_MODE_URC).sysMode;
                    break;
                default: return;
            }

            this.checks();

        });

    }

    private checks(): void {

        if (this.serviceStatus !== ServiceStatus.VALID_SERVICES) {
            this.isReady = false;
            return;
        }

        if (this.sysMode === SysMode.NO_SERVICES) {
            this.isReady = false;
            return;
        }

        if (this.simState !== SimState.VALID_SIM) {
            this.isReady = false;
            return;
        }

        if (!this.isReady) {

            this.isReady = true;
            this.evtReady.post();

        }

    }


}