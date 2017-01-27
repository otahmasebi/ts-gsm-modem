import { AtStack } from "./AtStack";
import { SyncEvent, VoidSyncEvent } from "ts-events";
import {
    atIds,
    AtMessage,
    AtMessageImplementations,
    ServiceStatus,
    ServiceDomain,
    SysMode,
    SimState
} from "at-messages-parser";

export class StatusStack {

    public readonly evtHasSim= new SyncEvent<boolean>();
    public readonly evtReady= new VoidSyncEvent();
    public readonly evtAlertRoaming= new VoidSyncEvent();

    public isReady: boolean= false;


    public serviceStatus: ServiceStatus;
    //public serviceDomain: ServiceDomain;
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
            //this.serviceDomain= atMessageHuaweiSYSINFO.serviceDomain;
            this.sysMode= atMessageHuaweiSYSINFO.sysMode;
            this.simState= atMessageHuaweiSYSINFO.simState;

            this.evtHasSim.post(this.simState !== SimState.NO_SIM );

            if( atMessageHuaweiSYSINFO.isRoaming ) this.evtAlertRoaming.post();

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
                default: return;
            }

            this.checks();

        });

    }

    

    private checks(): void{

        this.isReady= false;

        if( this.serviceStatus !== ServiceStatus.VALID_SERVICES ) return;
        //if( this.serviceDomain !== ServiceDomain.PS_AND_CS_SERVICES ) return;
        if( this.sysMode === SysMode.NO_SERVICES ) return;
        if( this.simState !== SimState.VALID_SIM ) return;

        this.isReady= true;

        this.evtReady.post();

    }


}