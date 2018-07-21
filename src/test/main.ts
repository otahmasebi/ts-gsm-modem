import { Modem, ConnectionMonitor } from "../lib/index";
//@ts-ignore: we may un comment
import * as repl from "repl";
import * as logger from "logger";

process.on("unhandledRejection", error=> { throw error; });

const debug= logger.debugFactory();

(async () => {

    debug("Started, looking for connected modem...");

    let accessPoint = await ConnectionMonitor.getInstance().evtModemConnect.waitFor();

    let modem: Modem;

    try {

        modem = await Modem.create({
            "dataIfPath": accessPoint.dataIfPath,
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" },
            "log": logger.log
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
        `Inventa pour punir les crimes de la terre,`,
        `La Peste (puisqu’il faut l’appeler par son nom),`,
        `Capable d’enrichir en un jour l’Achéron,`,
        `Faisait aux Animaux la guerre.`,
        `Ils ne mouraient pas tous, mais tous étaient frappés :`,
        `On n’en voyait point d’occupés`,
        `À chercher le soutien d’une mourante vie ;`,
        `Nul mets n’excitait leur envie ;`,
        `Ni Loups ni Renards n’épiaient`,
        `La douce et l’innocente proie ;`,
        `Les Tourterelles se fuyaient :`,
        `Plus d’amour, partant plus de joie.`,
        `Le Lion tint conseil, et dit : « Mes chers amis,`,
        `Je crois que le Ciel a permis`,
        `Pour nos péchés cette infortune.`,
        `Que le plus coupable de nous`,
        `Se sacrifie aux traits du céleste courroux ;`,
        `Peut-être il obtiendra la guérison commune.`,
        `L’histoire nous apprend qu’en de tels accidents`,
        `On fait de pareils dévouements.`,
        `Ne nous flattons donc point, voyons sans indulgence`,
        `L’état de notre conscience.`,
        `Pour moi, satisfaisant mes appétits gloutons,`,
        `J’ai dévoré force moutons.`,
        `Que m’avaient-ils fait ? nulle offense ;`,
        `Même il m’est arrivé quelquefois de manger`,
        `Le berger.`
    ].join("\n");
    /* spell-checker: enable */

    const joseph = "0636786385";

    const sentMessageId = await modem.sendMessage(joseph, messageText);

    debug("SendDate( used as id): ", sentMessageId);

    const contact = await modem.createContact("007", "James Bond");

    console.assert( modem.getContact(contact.index)!.name === contact.name);
    console.assert( modem.getContact(contact.index)!.number === contact.number);

    await modem.deleteContact(contact.index);

    console.assert( modem.getContact(contact.index) === undefined );

    await new Promise(resolve => setTimeout(resolve, 35000));

    debug("Manual termination of the modem");

    modem.terminate().then(()=>{

        console.assert(modem.terminateState === "TERMINATED");

    });

    console.assert(modem.terminateState === "TERMINATING");


})();
