import { AtStack } from "./AtStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";
import {
    atIds,
    AtMessage,
    AtMessageImplementations,
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

            let atMessageHuaweiSYSINFO = output.atMessage as AtMessageImplementations.HUAWEI_SYSINFO;

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
                case atIds.HUAWEI_SRVST:
                    this.serviceStatus = (atMessage as AtMessageImplementations.HUAWEI_SRVST).serviceStatus;
                    break;
                case atIds.HUAWEI_SIMST:
                    this.simState = (atMessage as AtMessageImplementations.HUAWEI_SIMST).simState
                    break;
                case atIds.HUAWEI_MODE:
                    this.sysMode = (atMessage as AtMessageImplementations.HUAWEI_MODE).sysMode;
                    break;
                default: return;
            }

            this.checks();

        });

    }

    private checks(): void{

        this.isReady= false;

        if( this.serviceStatus !== ServiceStatus.VALID_SERVICES ) return;
        if( this.sysMode === SysMode.NO_SERVICES ) return;
        if( this.simState !== SimState.VALID_SIM ) return;

        this.isReady= true;

        this.evtReady.post();

    }


}