
import { ModemInterface, RunAtCommandError } from "./ModemInterface";
import { AtMessageId, AtMessage, AtMessageImplementations, PinState, SimState } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events";

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR PIN MANAGER");
    console.log(error);
    throw error; 
});

export interface PinManagerState {
        hasSim: boolean,
        simState?: string,
        pinState?: string,
        times?: number
}

export class PinManager{

    public get hasSim(): boolean{ return this.atMessageHuaweiSYSINFO.simState !== SimState.NO_SIM; }

    public get simState(): SimState{ return this.atMessageHuaweiSYSINFO.simState; }

    public get pinState(): PinState{ return this.atMessageHuaweiCPIN.pinState; }

    public get times(): number{ return this.atMessageHuaweiCPIN.times; }

    public getState(): PinManagerState{

        let pinManagerState: PinManagerState= {
            "hasSim": this.hasSim
        };

        if( this.hasSim ){
            Object.assign(pinManagerState, {
                "simState": SimState[this.simState],
                "pinState": PinState[this.pinState],
            });

            if( typeof(this.times) === "number" ) pinManagerState.times= this.times;
        }

        return pinManagerState;
    }


    private unlocking= false;

    private __enterPin__(pin: string): void{

        if( this.retrieving ) throw new Error();
        if( !this.hasSim ) throw new Error();
        if( this.unlocking ) throw new Error();
        if (!pin.match(/^[0-9]{4}$/)) throw new Error();

        this.unlocking= true;

        this.modemInterface.runAtCommand(`AT+CPIN=${pin}\r`, output => {

                this.unlocking= false;

                this.retrieve();

        });

    }

    private __enterPuk__(puk: string, newPin: string){

        if( this.retrieving ) throw new Error();
        if (!this.hasSim ) throw new Error();
        if( this.unlocking ) throw new Error();
        if (!puk.match(/^[0-9]{8}$/)) throw new Error();
        if (!newPin.match(/^[0-9]{4}$/)) throw new Error();

        this.unlocking= true;

        this.modemInterface.runAtCommand(`AT+CPIN=${puk},${newPin}\r`, output => {

                this.unlocking= false;

                this.retrieve();

        });

    }

    public enterPin(pin: string): void{ 

        if( this.pinState !== PinState.SIM_PIN ) throw new Error();

        this.__enterPin__(pin); 

    }
    public enterPin2(pin2: string): void{ 

        if( this.pinState !== PinState.SIM_PIN2 ) throw new Error();

        this.__enterPin__(pin2); 

    }


    public enterPuk(puk: string, newPin: string): void{

        if( this.pinState !== PinState.SIM_PUK ) throw new Error();

        this.__enterPuk__(puk, newPin);

    }


    public enterPuk2(puk: string, newPin2: string): void{

        if( this.pinState !== PinState.SIM_PUK2 ) throw new Error();

        this.__enterPuk__(puk, newPin2);

    }


    public readonly evtNoSim= new VoidSyncEvent();
    public readonly evtRequestCode= new SyncEvent<{pinState: PinState, times: number}>();
    public readonly evtSimValid= new VoidSyncEvent();

    constructor(private readonly modemInterface: ModemInterface) {
        this.retrieve();
        this.registerListeners();
    }

    private retrieving= true;
    private retrieve(): void{
        (async () => {

            this.retrieving= true;

            await this.retrieveHuaweiSYSINFO();

            if (!this.hasSim){
                this.retrieving= false;
                this.evtNoSim.post();
                return;
            }

            await this.retrieveHuaweiCPIN();
            this.retrieving = false;

            if (this.pinState !== PinState.READY){ 
                this.evtRequestCode.post({
                    "pinState": this.pinState,
                    "times": this.times
                });
                return;
            }

            if( this.simState === SimState.VALID_SIM ) this.evtSimValid.post();

        })();
    }

    private registerListeners(): void{

        this.modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

            if (atMessage.id === AtMessageId.HUAWEI_SIMST ){

                if( this.retrieving ){
                    console.log("============================================>regarde là");
                    return;
                }

                 this.retrieve();

            }

        });

    }




    private atMessageHuaweiSYSINFO: AtMessageImplementations.HUAWEI_SYSINFO;

    public retrieveHuaweiSYSINFO(): Promise<void> {
        return new Promise<void>(resolve=>{

            this.modemInterface.runAtCommandExt("AT^SYSINFO\r", output => {

                this.atMessageHuaweiSYSINFO = <AtMessageImplementations.HUAWEI_SYSINFO>output.atMessage;

                resolve();

            });

        });
    }

    private atMessageHuaweiCPIN: AtMessageImplementations.HUAWEI_CPIN;

    private retrieveHuaweiCPIN(): Promise<void> {
        return new Promise<void>(resolve => {

            this.modemInterface.runAtCommandExt("AT^CPIN?\r", output => {

                this.atMessageHuaweiCPIN = <AtMessageImplementations.HUAWEI_CPIN>output.atMessage;

                resolve();

            });


        });
    }

}