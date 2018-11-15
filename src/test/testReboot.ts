import {
    Modem, InitializationError, AccessPoint, ConnectionMonitor 
} from "../lib/index";
import { SyncEvent } from "ts-events-extended";
import * as logger from "logger";


/*
(async ()=>{

    while(true){

        await new Promise(resolve=> setTimeout(resolve,1000));

        console.log("tick");

    }

})();
*/

const debug = logger.debugFactory();


const evtScheduleRetry = new SyncEvent<AccessPoint["id"]>();

async function launch() {

    debug("Started!");

    const monitor = ConnectionMonitor.getInstance();

    monitor.evtModemConnect.attach(accessPoint => {

        debug(`(Monitor) Connect: ${accessPoint}`);

        createModem(accessPoint)

    });

    monitor.evtModemDisconnect.attach(
        accessPoint=> debug(`(Monitor) Disconnect: ${accessPoint}`)
    );

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

    debug("Create Modem");

    let modem: Modem;

    try {

        modem = await Modem.create({
            "dataIfPath": accessPoint.dataIfPath,
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
            //"log": logger.log,
            "log": console.log.bind(console),
            "rebootFirst": !!reboot
        });

    } catch (error) {

        onModemInitializationFailed(
            accessPoint,
            (error as InitializationError).modemInfos
        );

        return;

    }

    onModem(accessPoint, modem);

}

function onModemInitializationFailed(
    accessPoint: AccessPoint,
    modemInfos: InitializationError["modemInfos"]
) {

    if( !!modemInfos.haveFailedToReboot ){

        debug("Modem has been detected as failing to reboot, TEST SUCCESS");

        process.exit(0);

    }

    
    if( modemInfos.hasSim === false ){
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