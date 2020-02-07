import { AtStack } from "./AtStack";
import { AtMessage } from "at-messages-parser";
import { Evt, VoidEvt } from "ts-evt";

import "colors";

type RelevantUrcs =
    AtMessage.CX_RSSI_URC |
    AtMessage.CX_SRVST_URC |
    AtMessage.CX_MODE_URC |
    AtMessage.P_CREG_URC |
    AtMessage.CX_SIMST_URC
    ;

export class SystemState {

    public readonly prHasSim!: Promise<boolean>;

    private resolvePrValidSim!: () => void;
    public readonly prValidSim = new Promise<void>(resolve => this.resolvePrValidSim = resolve);

    /** Posted when isGsmConnectivityOk() change value */
    public readonly evtGsmConnectivityChange = new VoidEvt();

    public readonly evtCellSignalStrengthTierChange = new Evt<{ previousRssi: number; }>();

    private isRoaming: boolean | undefined = undefined;

    private serviceStatus: AtMessage.ServiceStatus | undefined = undefined;
    private sysMode: AtMessage.SysMode | undefined = undefined;
    private simState: AtMessage.SimState | undefined = undefined;
    private networkRegistrationState: AtMessage.NetworkRegistrationState | undefined = undefined;

    private rssi = 99;

    public isGsmConnectivityOk(): boolean {
        return (
            this.isValidSim() &&
            this.serviceStatus === AtMessage.ServiceStatus.VALID_SERVICES &&
            this.sysMode !== undefined &&
            this.sysMode !== AtMessage.SysMode.NO_SERVICES &&
            this.networkRegistrationState !== undefined &&
            [
                AtMessage.NetworkRegistrationState.REGISTERED_HOME_NETWORK,
                AtMessage.NetworkRegistrationState.REGISTERED_ROAMING
            ].indexOf(this.networkRegistrationState) >= 0
        );
    }


    private isValidSim(): boolean {
        return (
            this.simState === AtMessage.SimState.VALID_SIM ||
            this.simState === AtMessage.SimState.INVALID_SIM_PS
        );
    }

    /** Assert prValidSim has resolved */
    public getCurrentState() {
        return {
            "isRoaming": this.isRoaming!,
            "serviceStatus": this.serviceStatus!,
            "sysMode": this.sysMode!,
            "simState": this.simState!,
            "networkRegistrationState": this.networkRegistrationState!,
            "cellSignalStrength": {
                "rssi": this.rssi,
                "tier": AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(this.rssi)
            }
        };
    }

    public getCurrentStateHumanlyReadable() {

        const state = this.getCurrentState();

        return {
            "isRoaming": state.isRoaming,
            "serviceStatus": AtMessage.ServiceStatus[state.serviceStatus],
            "sysMode": AtMessage.SysMode[state.sysMode],
            "simState": AtMessage.SimState[state.simState],
            "networkRegistrationState": AtMessage.NetworkRegistrationState[state.networkRegistrationState],
            "cellSignalStrength": (() => {
                const rssi = state.cellSignalStrength.rssi;
                switch (AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(state.cellSignalStrength.rssi)) {
                    case "<=-113 dBm": return `${rssi}, Very weak`;
                    case "-111 dBm": return `${rssi}, Weak`;
                    case "–109 dBm to –53 dBm": return `${rssi}, Good`;
                    case "≥ –51 dBm": return `${rssi} Excellent`;
                    case "Unknown or undetectable": return `${rssi} Unknown or undetectable`;
                }
            })()
        };
    }


    constructor(
        private readonly atStack: AtStack,
        private readonly debug: typeof console.log
    ) {

        this.debug("Initialization");

        this.atStack.evtUnsolicitedMessage.attach(
            (atMessage): atMessage is RelevantUrcs => (
                atMessage instanceof AtMessage.CX_RSSI_URC ||
                atMessage instanceof AtMessage.CX_SRVST_URC ||
                atMessage instanceof AtMessage.CX_MODE_URC ||
                atMessage instanceof AtMessage.P_CREG_URC ||
                atMessage instanceof AtMessage.CX_SIMST_URC
            ),
            atMessage => this.update(atMessage)
        );

        let resolvePrHasSim!: (hasSim: boolean) => void;

        this.prHasSim = new Promise(resolve => resolvePrHasSim = resolve);

        (async () => {

            await this.atStack.runCommand(
                "AT^SYSCFG=2,0,3FFFFFFF,2,4\r",
                { "recoverable": true }
            ).then(({ final }) => {
                if (!!final.isError) {
                    debug("AT^SYSCFG command failed".red);
                } else {
                    debug("AT^SYSCFG success, dongle can connect to either 2G or 3G network");
                }
            });

            {

                const cx_SYSINFO_EXEC = (await this.atStack.runCommand("AT^SYSINFO\r"))
                    .resp as AtMessage.CX_SYSINFO_EXEC;

                this.isRoaming = cx_SYSINFO_EXEC.isRoaming;

                this.update(
                    new AtMessage.CX_SIMST_URC(
                        "",
                        cx_SYSINFO_EXEC.simState,
                        cx_SYSINFO_EXEC.cardLock //NOTE: Unused
                    )
                );

                this.update(
                    new AtMessage.CX_SRVST_URC(
                        "",
                        cx_SYSINFO_EXEC.serviceStatus
                    )
                );

                this.update(
                    new AtMessage.CX_MODE_URC(
                        "",
                        cx_SYSINFO_EXEC.sysMode,
                        cx_SYSINFO_EXEC.sysSubMode //NOTE: Unused
                    )
                );

            }

            resolvePrHasSim(
                this.simState !== AtMessage.SimState.NO_SIM
            );

        })();

    }



    private update(atMessage: RelevantUrcs) {

        if (atMessage instanceof AtMessage.CX_RSSI_URC) {

            const previousRssi = this.rssi;

            const previousTier = AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(previousRssi);

            this.rssi = atMessage.rssi;

            if (
                previousTier
                !==
                AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(this.rssi)
            ) {

                this.debug([
                    `Signal strength tier change:`,
                    `${previousRssi}, "${previousTier}" ->`,
                    `${this.rssi}, "${this.getCurrentState().cellSignalStrength.tier}"`
                ].join(" "));

                this.evtCellSignalStrengthTierChange.post({ previousRssi });
            }

            return;

        }

        const wasGsmConnectivityOk = this.isGsmConnectivityOk();

        if (atMessage instanceof AtMessage.CX_SIMST_URC) {

            this.simState = atMessage.simState;

            if (this.isValidSim()) {



                (async () => {

                    await this.atStack.runCommand("AT+CREG=2\r");

                    const cx_CREG_READ = (await this.atStack.runCommand("AT+CREG?\r"))
                        .resp as AtMessage.P_CREG_READ
                        ;

                    this.update(
                        new AtMessage.P_CREG_URC(
                            "",
                            cx_CREG_READ.stat
                        )
                    );

                })();

                (async () => {

                    const p_CSQ_EXEC = (await this.atStack.runCommand("AT+CSQ\r"))
                        .resp as AtMessage.P_CSQ_EXEC;

                    this.update(
                        new AtMessage.CX_RSSI_URC(
                            "",
                            p_CSQ_EXEC.rssi
                        )
                    );

                })();

                this.resolvePrValidSim();

            }

        } else if (atMessage instanceof AtMessage.CX_SRVST_URC) {

            this.serviceStatus = atMessage.serviceStatus;

        } else if (atMessage instanceof AtMessage.CX_MODE_URC) {

            this.sysMode = atMessage.sysMode;

        } else if (atMessage instanceof AtMessage.P_CREG_URC) {

            this.networkRegistrationState = atMessage.stat;

        }

        if (wasGsmConnectivityOk !== this.isGsmConnectivityOk()) {

            this.debug(
                `GSM connectivity state change: ${JSON.stringify(this.getCurrentStateHumanlyReadable(), null, 2)}`
            );

            this.evtGsmConnectivityChange.post();

        }

    }

}