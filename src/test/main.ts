import { Modem, InitializationError, ConnectionMonitor } from "../lib/index";
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
            "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" }
        });

    } catch (error) {

        let initializationError = error as InitializationError;

        debug(initializationError);

        return;

    }

    modem.evtTerminate.attachOnce(error => {

        debug("Modem terminate", { error });

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

    let joseph = "0636786385";

    let sentMessageId = await modem.sendMessage(joseph, messageText);

    debug("SendDate( used as id): ", sentMessageId);

    await new Promise(resolve => setTimeout(resolve, 60000));

    debug("Manual termination of the modem");

    modem.terminate().then(()=>{

        console.log("Resolve modem terminated");

    });

    console.assert(modem.isTerminated === true);

    /*

    let { context } = repl.start({
        "terminal": true,
        "prompt": "> "
    }) as any;

    Object.assign(context, {
        modem,
        run(command: string): string  {

            modem.runCommand(command + "\r", { "recoverable": true, "retryOnErrors": false }, (resp, final) => {

                if (resp)
                    console.log(JSON.stringify(resp, null, 2));

                if (final.isError)
                    console.log(JSON.stringify(final, null, 2).red);
                else
                    console.log(final.raw.green);

            });

            return "COMMAND QUEUED";

        }
    });

    Object.defineProperty(context, "exit", {
        "get": ()=> process.exit(0)
    });

    */

    /*
    ( async function keepAlive(){

        while( true ){

            if( modem.isTerminated ) return;

            await new Promise(resolve=>setTimeout(resolve,1000));

            await modem!.ping();

            console.log("PING");

        }

    });
    */

})();
