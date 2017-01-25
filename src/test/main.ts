import { ModemWatcher } from "gsm-modem-connection";

import {
    ModemInterface,
    PinManager,
    ReportMode,
    PinState,
    SmsStack
} from "../lib/index";

require("colors");


let modemWatcher = new ModemWatcher();

console.log("Awaiting GSM modem connections...");

modemWatcher.evtDisconnect.attach(modem => console.log("DISCONNECT", modem.infos));
modemWatcher.evtConnect.attach(modem => {

    console.log("CONNECTION=>", modem.infos);

    let modemInterface = new ModemInterface(modem.atInterface, {
        "reportMode": ReportMode.DEBUG_INFO_CODE
    });

    let pinManager = new PinManager(modemInterface);

    pinManager.evtRequestCode.attach((request) => {

        console.log("=>REQUEST CODE<=", pinManager.state);

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

                console.log("sim locked, PUK requested", request.times);

                switch (request.times) {
                    case 10:
                        console.log("10 try left entering wrong puk 62217721");
                        pinManager.enterPuk("62217721", "1234");
                        break;
                    case 9:
                        console.log("9 try left, Finally, entering the true PUK code, 89390485 and set pin to 0001");
                        pinManager.enterPuk("89390485", "0001");
                        break;
                    case 8:
                        console.log("9 try left, Finally, entering the true PUK code, 62217721 and set pin to 0001");
                        pinManager.enterPuk("62217721", "1234");
                        break;
                    default:
                }

                break;
            default:
        }

    });

    pinManager.evtNoSim.attach(() => {

        console.log("=>NO SIM<=", pinManager.state);

        process.exit(0);

    });

    pinManager.evtSimValid.attach(() => {

        console.log("=>SIM VALID<=", pinManager.state);

        let smsStack= new SmsStack(modemInterface);

        smsStack.evtMessage.attach(message=> console.log("NEW MESSAGE: ".green,message));
        smsStack.evtMessageStatusReport.attach( statusReport => console.log("status report received".yellow, statusReport));

        console.log("now send message =>".yellow);

        let messageText = "He ho!\n";

        for (let i = 0; i < 3; i++) messageText += messageText;

        console.log(`Sending message : ${JSON.stringify(messageText)}`);

        smsStack.sendMessage("+33636786385", messageText, messageId => console.log("message id: ".red, messageId));

    });

});