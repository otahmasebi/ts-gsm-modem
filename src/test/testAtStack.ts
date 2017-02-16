import { AtStack } from "../lib/AtStack";


import { ModemWatcher, Modem as ModemAccessPoint} from "gsm-modem-connection";
import { MessageStat, AtMessageList, AtImps } from "at-messages-parser";
require("colors");



let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtConnect.attach(accessPoint => {

    console.log("CONNECTION".green, accessPoint.infos);

    let modem = new AtStack(accessPoint.atInterface);

    modem.evtError.attach(error=> {

        console.log(`ERROR AT STACK ${JSON.stringify(error, null, 2)}`.red);

    });


    

    modem.runCommand("AT+CPIN\r",
    (atList: AtMessageList, final, raw)=>{

        console.log(JSON.stringify({
            "resp": atList,
            "final": final,
            "raw": String.raw`${raw}`
        }, null, 2).blue);


    });

    

    /*
    modem.runCommand("ATI\r", 
    (resp, final, raw)=>{

        console.log("Call".yellow);

        console.log(JSON.stringify({
            "resp": resp,
            "final": final,
            "raw": String.raw`${raw}`
        }, null, 2));


    });
    */



    


});