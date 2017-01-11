
import { ModemInterface, RunAtCommandError } from "./ModemInterface";
import { AtMessageId, AtMessage, AtMessageImplementations, PinState, SimState } from "at-messages-parser";
import { SyncEvent, VoidSyncEvent } from "ts-events";

process.on("unhandledRejection", error=> { 
    console.log("INTERNAL ERROR");
    console.log(error);
    throw error; 
});

export class PinManager{

    public get hasSim(): boolean{ return this.atMessageHuaweiSYSINFO.simState !== SimState.NO_SIM; }

    public get isSimReady(): boolean{ return this.simState === SimState.VALID_SIM; }

    public get simState(): SimState{ return this.atMessageHuaweiSYSINFO.simState; }

    public get pinState(): PinState{ return this.atMessageHuaweiCPIN.pinState; }

    public get times(): number{ return this.atMessageHuaweiCPIN.times; }


    private unlocking= false;

    private __enterPin__(pin: string): void{

        if( this.retrieving ) throw new Error();
        if( !this.hasSim ) throw new Error();
        if( this.unlocking ) throw new Error();
        if (!pin.match(/^[0-9]{4}$/)) throw new Error();

        this.unlocking= true;

        let rawAtCommand= `AT+CPIN=${pin}\r`;

        this.modemInterface.runAtCommand(rawAtCommand, output => {

                if( !output ) return;

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

        let rawAtCommand= `AT+CPIN=${puk},${newPin}\r`;

        this.modemInterface.runAtCommand(rawAtCommand, output => {

                if( !output ) return;

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
    public readonly evtSimReady= new VoidSyncEvent();

    constructor(private readonly modemInterface: ModemInterface) {
        this.retrieve();
        this.registerListeners();
    }

    private registerListeners(): void{

        this.modemInterface.evtUnsolicitedAtMessage.attach(atMessage => {

            if (atMessage.id === AtMessageId.HUAWEI_SIMST ) {

                this.retrieve();
            }

        });

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

            if( this.isSimReady ) this.evtSimReady.post();

        })();
    }


    public atMessageHuaweiSYSINFO: AtMessageImplementations.HUAWEI_SYSINFO;

    public retrieveHuaweiSYSINFO(): Promise<void> {
        return new Promise<void>(resolve=>{

            let rawAtCommand= "AT^SYSINFO\r";

            this.modemInterface.runAtCommand(rawAtCommand, output => {

                if( !output ) return resolve();

                if( !output.isSuccess ) throw new RunAtCommandError(rawAtCommand, output.finalAtMessage);

                this.atMessageHuaweiSYSINFO= <AtMessageImplementations.HUAWEI_SYSINFO>output.atMessage;

                resolve();

            });
        });
    }

    public atMessageHuaweiCPIN: AtMessageImplementations.HUAWEI_CPIN;

    private retrieveHuaweiCPIN(): Promise<void> {
        return new Promise<void>(resolve=>{

            let rawAtCommand= "AT^CPIN?\r";

            this.modemInterface.runAtCommand(rawAtCommand, output => {

                if( !output ) return resolve();

                if( !output.isSuccess ) throw new RunAtCommandError(rawAtCommand, output.finalAtMessage);

                this.atMessageHuaweiCPIN= <AtMessageImplementations.HUAWEI_CPIN>output.atMessage;

                resolve();

            });

        });
    }

}