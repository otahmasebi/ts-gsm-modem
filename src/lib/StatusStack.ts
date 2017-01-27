
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


/*
import { SyncEvent, VoidSyncEvent } from "ts-events";
import { AtStack } from "./AtStack";

export interface PinManagerState {
    hasSim: boolean,
    simState?: string,
    pinState?: string,
    times?: number
}


export class SimLockStack {



    public get state(): PinManagerState {

        let pinManagerState: PinManagerState = {
            "hasSim": this.hasSim
        };

        if (this.hasSim) {
            Object.assign(pinManagerState, {
                "simState": SimState[this.simState],
                "pinState": this.pinState,
            });

            if (typeof (this.times) === "number") pinManagerState.times = this.times;
        }

        return pinManagerState;
    }



    public readonly evtNoSim = new VoidSyncEvent();
    public readonly evtUnlockCodeRequest = new SyncEvent<UnlockCodeRequest>();
    public readonly evtSimValid = new VoidSyncEvent();

    //TODO
    public readonly evtPinStateReady= new VoidSyncEvent();

    constructor(private readonly atStack: AtStack) {
        this.retrieve();
        this.registerListeners();
    }

    private retrieving = true;
    private retrieve(): void {
        (async () => {

            this.retrieving = true;

            await this.retrieveHuaweiSYSINFO();

            if (!this.hasSim) {
                this.retrieving = false;
                this.evtNoSim.post();
                return;
            }

            await this.retrieveHuaweiCPIN();
            this.retrieving = false;

            if (this.pinState !== "READY") {
                this.evtUnlockCodeRequest.post({
                    "pinState": this.pinState,
                    "times": this.times
                });
                return;
            }

            if (this.simState === SimState.VALID_SIM) this.evtSimValid.post();

        })();
    }

    private registerListeners(): void {

        this.atStack.evtUnsolicitedMessage.attach(atMessage => {

            if (atMessage.id === atIds.HUAWEI_SIMST) {

                if (this.retrieving) {
                    console.log("============================================>regarde là");
                    return;
                }

                this.retrieve();

            }

        });

    }






}
*/