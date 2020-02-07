import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { Evt, VoidEvt } from "ts-evt";
import "colors";
export declare class SystemState {
    private readonly atStack;
    private readonly debug;
    readonly prHasSim: Promise<boolean>;
    private resolvePrValidSim;
    readonly prValidSim: Promise<void>;
    /** Posted when isGsmConnectivityOk() change value */
    readonly evtGsmConnectivityChange: VoidEvt;
    readonly evtCellSignalStrengthTierChange: Evt<{
        previousRssi: number;
    }>;
    private isRoaming;
    private serviceStatus;
    private sysMode;
    private simState;
    private networkRegistrationState;
    private rssi;
    isGsmConnectivityOk(): boolean;
    private isValidSim;
    /** Assert prValidSim has resolved */
    getCurrentState(): {
        "isRoaming": boolean;
        "serviceStatus": AtMessage.ServiceStatus;
        "sysMode": AtMessage.SysMode;
        "simState": AtMessage.SimState;
        "networkRegistrationState": AtMessage.NetworkRegistrationState;
        "cellSignalStrength": {
            "rssi": number;
            "tier": AtMessage.GsmOrUtranCellSignalStrengthTier;
        };
    };
    getCurrentStateHumanlyReadable(): {
        "isRoaming": boolean;
        "serviceStatus": string;
        "sysMode": string;
        "simState": string;
        "networkRegistrationState": string;
        "cellSignalStrength": string;
    };
    constructor(atStack: AtStack, debug: typeof console.log);
    private update;
}
