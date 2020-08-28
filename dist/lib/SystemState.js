"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemState = void 0;
var at_messages_parser_1 = require("at-messages-parser");
var evt_1 = require("evt");
require("colors");
var SystemState = /** @class */ (function () {
    function SystemState(atStack, debug) {
        var _this = this;
        this.atStack = atStack;
        this.debug = debug;
        this.prValidSim = new Promise(function (resolve) { return _this.resolvePrValidSim = resolve; });
        /** Posted when isGsmConnectivityOk() change value */
        this.evtGsmConnectivityChange = evt_1.Evt.create();
        this.evtCellSignalStrengthTierChange = new evt_1.Evt();
        this.isRoaming = undefined;
        this.serviceStatus = undefined;
        this.sysMode = undefined;
        this.simState = undefined;
        this.networkRegistrationState = undefined;
        this.rssi = 99;
        this.debug("Initialization");
        this.atStack.evtUnsolicitedMessage.attach(function (atMessage) { return (atMessage instanceof at_messages_parser_1.AtMessage.CX_RSSI_URC ||
            atMessage instanceof at_messages_parser_1.AtMessage.CX_SRVST_URC ||
            atMessage instanceof at_messages_parser_1.AtMessage.CX_MODE_URC ||
            atMessage instanceof at_messages_parser_1.AtMessage.P_CREG_URC ||
            atMessage instanceof at_messages_parser_1.AtMessage.CX_SIMST_URC); }, function (atMessage) { return _this.update(atMessage); });
        var resolvePrHasSim;
        this.prHasSim = new Promise(function (resolve) { return resolvePrHasSim = resolve; });
        (function () { return __awaiter(_this, void 0, void 0, function () {
            var cx_SYSINFO_EXEC;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.atStack.runCommand("AT^SYSCFG=2,0,3FFFFFFF,2,4\r", { "recoverable": true }).then(function (_a) {
                            var final = _a.final;
                            if (!!final.isError) {
                                debug("AT^SYSCFG command failed".red);
                            }
                            else {
                                debug("AT^SYSCFG success, dongle can connect to either 2G or 3G network");
                            }
                        })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.atStack.runCommand("AT^SYSINFO\r")];
                    case 2:
                        cx_SYSINFO_EXEC = (_a.sent())
                            .resp;
                        this.isRoaming = cx_SYSINFO_EXEC.isRoaming;
                        this.update(new at_messages_parser_1.AtMessage.CX_SIMST_URC("", cx_SYSINFO_EXEC.simState, cx_SYSINFO_EXEC.cardLock //NOTE: Unused
                        ));
                        this.update(new at_messages_parser_1.AtMessage.CX_SRVST_URC("", cx_SYSINFO_EXEC.serviceStatus));
                        this.update(new at_messages_parser_1.AtMessage.CX_MODE_URC("", cx_SYSINFO_EXEC.sysMode, cx_SYSINFO_EXEC.sysSubMode //NOTE: Unused
                        ));
                        resolvePrHasSim(this.simState !== at_messages_parser_1.AtMessage.SimState.NO_SIM);
                        return [2 /*return*/];
                }
            });
        }); })();
    }
    SystemState.prototype.isGsmConnectivityOk = function () {
        return (this.isValidSim() &&
            this.serviceStatus === at_messages_parser_1.AtMessage.ServiceStatus.VALID_SERVICES &&
            this.sysMode !== undefined &&
            this.sysMode !== at_messages_parser_1.AtMessage.SysMode.NO_SERVICES &&
            this.networkRegistrationState !== undefined &&
            [
                at_messages_parser_1.AtMessage.NetworkRegistrationState.REGISTERED_HOME_NETWORK,
                at_messages_parser_1.AtMessage.NetworkRegistrationState.REGISTERED_ROAMING
            ].indexOf(this.networkRegistrationState) >= 0);
    };
    SystemState.prototype.isValidSim = function () {
        return (this.simState === at_messages_parser_1.AtMessage.SimState.VALID_SIM ||
            this.simState === at_messages_parser_1.AtMessage.SimState.INVALID_SIM_PS);
    };
    /** Assert prValidSim has resolved */
    SystemState.prototype.getCurrentState = function () {
        return {
            "isRoaming": this.isRoaming,
            "serviceStatus": this.serviceStatus,
            "sysMode": this.sysMode,
            "simState": this.simState,
            "networkRegistrationState": this.networkRegistrationState,
            "cellSignalStrength": {
                "rssi": this.rssi,
                "tier": at_messages_parser_1.AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(this.rssi)
            }
        };
    };
    SystemState.prototype.getCurrentStateHumanlyReadable = function () {
        var state = this.getCurrentState();
        return {
            "isRoaming": state.isRoaming,
            "serviceStatus": at_messages_parser_1.AtMessage.ServiceStatus[state.serviceStatus],
            "sysMode": at_messages_parser_1.AtMessage.SysMode[state.sysMode],
            "simState": at_messages_parser_1.AtMessage.SimState[state.simState],
            "networkRegistrationState": at_messages_parser_1.AtMessage.NetworkRegistrationState[state.networkRegistrationState],
            "cellSignalStrength": (function () {
                var rssi = state.cellSignalStrength.rssi;
                switch (at_messages_parser_1.AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(state.cellSignalStrength.rssi)) {
                    case "<=-113 dBm": return rssi + ", Very weak";
                    case "-111 dBm": return rssi + ", Weak";
                    case "–109 dBm to –53 dBm": return rssi + ", Good";
                    case "≥ –51 dBm": return rssi + " Excellent";
                    case "Unknown or undetectable": return rssi + " Unknown or undetectable";
                }
            })()
        };
    };
    SystemState.prototype.update = function (atMessage) {
        var _this = this;
        if (atMessage instanceof at_messages_parser_1.AtMessage.CX_RSSI_URC) {
            var previousRssi = this.rssi;
            var previousTier = at_messages_parser_1.AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(previousRssi);
            this.rssi = atMessage.rssi;
            if (previousTier
                !==
                    at_messages_parser_1.AtMessage.GsmOrUtranCellSignalStrengthTier.getForRssi(this.rssi)) {
                this.debug([
                    "Signal strength tier change:",
                    previousRssi + ", \"" + previousTier + "\" ->",
                    this.rssi + ", \"" + this.getCurrentState().cellSignalStrength.tier + "\""
                ].join(" "));
                this.evtCellSignalStrengthTierChange.post({ previousRssi: previousRssi });
            }
            return;
        }
        var wasGsmConnectivityOk = this.isGsmConnectivityOk();
        if (atMessage instanceof at_messages_parser_1.AtMessage.CX_SIMST_URC) {
            this.simState = atMessage.simState;
            if (this.isValidSim()) {
                (function () { return __awaiter(_this, void 0, void 0, function () {
                    var cx_CREG_READ;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.atStack.runCommand("AT+CREG=2\r")];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, this.atStack.runCommand("AT+CREG?\r")];
                            case 2:
                                cx_CREG_READ = (_a.sent())
                                    .resp;
                                this.update(new at_messages_parser_1.AtMessage.P_CREG_URC("", cx_CREG_READ.stat));
                                return [2 /*return*/];
                        }
                    });
                }); })();
                (function () { return __awaiter(_this, void 0, void 0, function () {
                    var p_CSQ_EXEC;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this.atStack.runCommand("AT+CSQ\r")];
                            case 1:
                                p_CSQ_EXEC = (_a.sent())
                                    .resp;
                                this.update(new at_messages_parser_1.AtMessage.CX_RSSI_URC("", p_CSQ_EXEC.rssi));
                                return [2 /*return*/];
                        }
                    });
                }); })();
                this.resolvePrValidSim();
            }
        }
        else if (atMessage instanceof at_messages_parser_1.AtMessage.CX_SRVST_URC) {
            this.serviceStatus = atMessage.serviceStatus;
        }
        else if (atMessage instanceof at_messages_parser_1.AtMessage.CX_MODE_URC) {
            this.sysMode = atMessage.sysMode;
        }
        else if (atMessage instanceof at_messages_parser_1.AtMessage.P_CREG_URC) {
            this.networkRegistrationState = atMessage.stat;
        }
        if (wasGsmConnectivityOk !== this.isGsmConnectivityOk()) {
            this.debug("GSM connectivity state change: " + JSON.stringify(this.getCurrentStateHumanlyReadable(), null, 2));
            this.evtGsmConnectivityChange.post();
        }
    };
    return SystemState;
}());
exports.SystemState = SystemState;
