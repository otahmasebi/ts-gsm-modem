import {
    Modem, InitializationError, AccessPoint, ConnectionMonitor 
} from "../lib/index";
import { Evt } from "evt";
import * as logger from "logger";


const debug = logger.debugFactory();

const evtScheduleRetry = new Evt<AccessPoint["id"]>();

async function launch() {

    debug("Started!");

    const monitor = ConnectionMonitor.getInstance();

    monitor.evtModemConnect.attach(accessPoint => {

        debug(accessPoint);

        createModem(accessPoint)

    });

    monitor.evtModemDisconnect.attach(accessPoint=> debug(accessPoint));

    evtScheduleRetry.attach(accessPointId => {

        const accessPoint = Array.from(monitor.connectedModems).find(({ id })=> id === accessPointId);

        if( !accessPoint ){
            return;
        }

        monitor.evtModemDisconnect
            .waitFor(ap => ap === accessPoint, 2000)
            .catch(() => createModem(accessPoint, "REBOOT"))
            ;

    });

};

async function createModem(accessPoint: AccessPoint, reboot?: undefined | "REBOOT" ) {

    debug(`Create modem ${!!reboot?" (reboot first)":""}}`);

    let modem: Modem;

    try {

        modem = await Modem.create({
            "dataIfPath": accessPoint.dataIfPath,
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
            "log": console.log.bind(console),
            "rebootFirst": !!reboot
        });

    } catch (error) {

        onModemInitializationFailed(
            accessPoint,
            error as InitializationError
        );

        return;

    }

    onModem(accessPoint, modem);

}

function onModemInitializationFailed(
    accessPoint: AccessPoint,
    initializationError: InitializationError
) {

    if( initializationError instanceof InitializationError.DidNotTurnBackOnAfterReboot ){

        debug("Modem has been detected as failing to reboot, TEST SUCCESS");

        process.exit(0);

    }
    
    if( initializationError.modemInfos.hasSim === false ){
        debug("Modem has no sim");
        return;
    }

    evtScheduleRetry.post(accessPoint.id);

}

function onModem(
    accessPoint: AccessPoint,
    modem: Modem
) {

    debug("Modem successfully initialized".green);

    modem.evtTerminate.attachOnce(
        error => {


            debug(`Modem terminate... ${error ? error.message : "No internal error"}`);

            evtScheduleRetry.post(accessPoint.id);

        }
    );

    debug(`Making the modem reboot until it crashes`);

    modem.terminate();

}

launch();