"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var index_1 = require("../lib/index");
require("colors");
var _debug = require("debug");
var debug = _debug("main");
debug.enabled = true;
process.on("unhandledRejection", function (error) {
    throw error;
});
(function () { return __awaiter(_this, void 0, void 0, function () {
    var accessPoint, modem, error_1, initializationError, messageText, joseph, sentMessageId;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                debug("Started, looking for connected modem...");
                return [4 /*yield*/, index_1.ConnectionMonitor.getInstance().evtModemConnect.waitFor()];
            case 1:
                accessPoint = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, 4, , 5]);
                return [4 /*yield*/, index_1.Modem.create({
                        "dataIfPath": accessPoint.dataIfPath,
                        "unlock": { "pinFirstTry": "0000", "pinSecondTry": "1234" }
                    })];
            case 3:
                modem = _a.sent();
                return [3 /*break*/, 5];
            case 4:
                error_1 = _a.sent();
                initializationError = error_1;
                debug(initializationError);
                return [2 /*return*/];
            case 5:
                modem.evtTerminate.attachOnce(function (error) {
                    debug("Modem terminate", { error: error });
                    index_1.ConnectionMonitor.getInstance().stop();
                });
                messageText = [
                    "Un mal qui r\u00E9pand la terreur,",
                    "Mal que le Ciel en sa fureur",
                    "Inventa pour punir les crimes de la terre,",
                    "La Peste (puisqu\u2019il faut l\u2019appeler par son nom),",
                    "Capable d\u2019enrichir en un jour l\u2019Ach\u00E9ron,",
                    "Faisait aux Animaux la guerre.",
                    "Ils ne mouraient pas tous, mais tous \u00E9taient frapp\u00E9s :",
                    "On n\u2019en voyait point d\u2019occup\u00E9s",
                    "\u00C0 chercher le soutien d\u2019une mourante vie ;",
                    "Nul mets n\u2019excitait leur envie ;",
                    "Ni Loups ni Renards n\u2019\u00E9piaient",
                    "La douce et l\u2019innocente proie ;",
                    "Les Tourterelles se fuyaient :",
                    "Plus d\u2019amour, partant plus de joie.",
                    "Le Lion tint conseil, et dit : \u00AB Mes chers amis,",
                    "Je crois que le Ciel a permis",
                    "Pour nos p\u00E9ch\u00E9s cette infortune.",
                    "Que le plus coupable de nous",
                    "Se sacrifie aux traits du c\u00E9leste courroux ;",
                    "Peut-\u00EAtre il obtiendra la gu\u00E9rison commune.",
                    "L\u2019histoire nous apprend qu\u2019en de tels accidents",
                    "On fait de pareils d\u00E9vouements.",
                    "Ne nous flattons donc point, voyons sans indulgence",
                    "L\u2019\u00E9tat de notre conscience.",
                    "Pour moi, satisfaisant mes app\u00E9tits gloutons,",
                    "J\u2019ai d\u00E9vor\u00E9 force moutons.",
                    "Que m\u2019avaient-ils fait ? nulle offense ;",
                    "M\u00EAme il m\u2019est arriv\u00E9 quelquefois de manger",
                    "Le berger."
                ].join("\n");
                joseph = "0636786385";
                return [4 /*yield*/, modem.sendMessage(joseph, messageText)];
            case 6:
                sentMessageId = _a.sent();
                debug("SendDate( used as id): ", sentMessageId);
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 60000); })];
            case 7:
                _a.sent();
                debug("Manual termination of the modem");
                modem.terminate();
                console.assert(modem.isTerminated === true);
                return [2 /*return*/];
        }
    });
}); })();
