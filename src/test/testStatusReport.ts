import { Modem, ConnectionMonitor } from "../lib/index";
import * as logger from "logger";

process.on("unhandledRejection", error => { throw error; });

const debug = logger.debugFactory();

(async () => {

    debug("Started, looking for connected modem...");

    let accessPoint = await ConnectionMonitor.getInstance().evtModemConnect.waitFor();

    let modem: Modem;

    try {

        modem = await Modem.create({
            "dataIfPath": accessPoint.dataIfPath,
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
            "log": false
        });

    } catch {

        debug("Modem initialization error");

        return;

    }

    modem.evtTerminate.attachOnce(error => {

        debug("Modem terminate");

        ConnectionMonitor.getInstance().stop();

    });

    //let messageText= "foo bar";

    // cSpell:disable
    const messageText = [
        `Un mal qui répand la terreur,`,
        `Mal que le Ciel en sa fureur`,
        `Inventa pour punir les crimes de la terre,`
    ].join("\n");
    /* spell-checker: enable */

    const joseph = "0636786385";

    const sentMessageId = await modem.sendMessage(joseph, messageText);

    debug("SendDate( used as id): ", sentMessageId);

    modem.evtMessageStatusReport.attachOnce((statusReport) => {

        debug(statusReport);

        debug("Manual termination of the modem");

        modem.terminate().then(() => {

            console.assert(modem.terminateState === "TERMINATED");

        });

        console.assert(modem.terminateState === "TERMINATING");

    });



})();
