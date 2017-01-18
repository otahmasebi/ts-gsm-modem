import { ModemWatcher } from "gsm-modem-connection";

import {
    ModemInterface,
    PinManager,
    AtMessageId,
    AtMessageList,
    AtMessageImplementations,
    ReportMode,
    PinState,
    SimState
} from "../lib/index";


let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtConnect.attach(modem => {

    console.log("CONNECTION=>", modem.infos);

    let modemInterface = new ModemInterface(modem.atInterface, {
        "reportMode": ReportMode.DEBUG_INFO_CODE
    });


    let pinManager = new PinManager(modemInterface);

    pinManager.evtRequestCode.attach((request) => {

        console.log("=>REQUEST CODE<=", pinManager.getState());

        switch (request.pinState) {
            case PinState.SIM_PIN:

                console.log("SIM PIN requested");

                switch (request.times) {
                    case 3:
                        console.log("3 try left, entering 0001");
                        pinManager.enterPin("0001");
                        break;
                    case 2:
                        console.log("2 try left, entering 1234");
                        pinManager.enterPin("1234");
                        break;
                    case 1:
                        console.log("1 try left, entering pin 0000");
                        pinManager.enterPin("0000");
                        break;
                    default:
                }

                break;
            case PinState.SIM_PUK:

                console.log("sim locked, PUK requested");

                switch (request.times) {
                    case 10:
                        console.log("10 try left entering wrong puk 12345678");
                        pinManager.enterPuk("12345678", "0000");
                        break;
                    case 9:
                        console.log("9 try left, Finally, entering the true PUK code, 89390485 and set pin to 0001");
                        pinManager.enterPuk("89390485", "0001");
                    default:
                }

                break;
            default:
        }

    });

    pinManager.evtNoSim.attach(() => {

        console.log("=>NO SIM<=", pinManager.getState());

        process.exit(0);

    });

    pinManager.evtSimValid.attach(() => {

        console.log("=>SIM VALID<=", pinManager.getState());

    });


});

modemWatcher.evtDisconnect.attach(modem => console.log("DISCONNECT", modem.infos));